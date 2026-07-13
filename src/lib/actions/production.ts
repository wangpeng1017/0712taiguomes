"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { generateBatchNo } from "@/lib/batch-no";
import { MOLD_BLOCKED_STATUS } from "@/lib/constants";
import { evaluateMoldAlert, thisMoldCount, totalQty } from "@/lib/production-calc";

export type SubmitBatchInput = {
  type: "注塑" | "冲压";
  workOrderId: string;
  equipmentId: string;
  moldId: string;
  materialLotId: string;
  shift: "白班" | "夜班";
  operator: string;
  startTime: string;
  endTime: string;
  issuedWeight: number;
  goodQty: number;
  badQty: number;
  scrapWeight: number;
  returnWeight: number;
  defects: { reasonId: string; qty: number; responsible: string; action: string }[];
  confirmOverLife?: boolean;
  leaderConfirmedBy?: string;
};

export type SubmitBatchResult =
  | { ok: true; batchNo: string; moldLifeRatePct: number; enteredMaintenance: boolean }
  | { ok: false; error: string }
  | { ok: false; needOverLifeConfirm: true; lifeRatePct: number };

export async function submitProductionBatch(input: SubmitBatchInput): Promise<SubmitBatchResult> {
  const [workOrder, equipment, mold, materialLot] = await Promise.all([
    prisma.workOrder.findUniqueOrThrow({ where: { id: input.workOrderId } }),
    prisma.equipmentMaster.findUniqueOrThrow({ where: { id: input.equipmentId } }),
    prisma.moldMaster.findUniqueOrThrow({ where: { id: input.moldId } }),
    prisma.materialLot.findUniqueOrThrow({ where: { id: input.materialLotId } }),
  ]);

  if (!["已下达", "生产中"].includes(workOrder.status)) return { ok: false, error: `工单当前状态为「${workOrder.status}」，不可报工` };
  if (workOrder.type !== input.type) return { ok: false, error: "工单类型与当前报工类型不一致" };
  const expectedEquipmentType = input.type === "注塑" ? "注塑机" : "冲床";
  const expectedMoldType = input.type === "注塑" ? "注塑模" : "冲压模";
  const expectedMaterialType = input.type === "注塑" ? "塑料颗粒" : "金属卷材";
  if (equipment.type !== expectedEquipmentType || equipment.status !== "可用") return { ok: false, error: "设备类型或状态不允许开工" };
  if (mold.type !== expectedMoldType) return { ok: false, error: "模具类型与报工类型不一致" };
  if (workOrder.planEquipmentId && workOrder.planEquipmentId !== equipment.id) return { ok: false, error: "所选设备与工单计划设备不一致" };
  if (workOrder.planMoldId && workOrder.planMoldId !== mold.id) return { ok: false, error: "所选模具与工单计划模具不一致" };
  if (mold.applicableSkuId && mold.applicableSkuId !== workOrder.skuId) return { ok: false, error: "模具不适用于该工单产品" };
  if (mold.applicableEquipmentId && mold.applicableEquipmentId !== equipment.id) return { ok: false, error: "模具不适用于所选设备" };
  if (materialLot.inspectStatus !== "合格" || materialLot.stockStatus !== "可用") return { ok: false, error: "物料批次不是合格可用状态" };
  const material = await prisma.materialMaster.findUniqueOrThrow({ where: { id: materialLot.materialId } });
  if (material.type !== expectedMaterialType) return { ok: false, error: "原材料类型与报工类型不一致" };

  if (MOLD_BLOCKED_STATUS.includes(mold.status)) {
    return { ok: false, error: `模具当前状态为「${mold.status}」，不允许开工` };
  }

  const alertBefore = evaluateMoldAlert(mold);
  if (alertBefore.overLife && !input.confirmOverLife) {
    return { ok: false, needOverLifeConfirm: true, lifeRatePct: Math.round(alertBefore.lifeRate * 1000) / 10 };
  }
  if (alertBefore.overLife && !input.leaderConfirmedBy?.trim()) return { ok: false, error: "超寿命生产必须填写主管姓名" };

  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime()) || endTime <= startTime) return { ok: false, error: "结束时间必须晚于开始时间" };
  if (![input.issuedWeight, input.returnWeight, input.scrapWeight].every((value) => Number.isFinite(value) && value >= 0)) return { ok: false, error: "重量不可为负数" };
  if (input.issuedWeight <= 0) return { ok: false, error: "领用重量必须大于 0" };
  if (![input.goodQty, input.badQty].every((value) => Number.isInteger(value) && value >= 0)) return { ok: false, error: "良品和不良数量必须是非负整数" };
  if (input.goodQty + input.badQty <= 0) return { ok: false, error: "报工总数量必须大于 0" };
  if (input.returnWeight > input.issuedWeight) return { ok: false, error: "退料/剩余卷材重量不可超过领用重量" };
  if (input.scrapWeight > input.issuedWeight - input.returnWeight) return { ok: false, error: "水口料/边角料重量不可超过实际消耗重量" };

  if (input.issuedWeight > materialLot.remainingQty) {
    return { ok: false, error: `领用数量（${input.issuedWeight}）超过物料批次可用库存（${materialLot.remainingQty}）` };
  }

  const defectQtySum = input.defects.reduce((s, d) => s + d.qty, 0);
  if (input.defects.some((item) => !Number.isInteger(item.qty) || item.qty <= 0)) return { ok: false, error: "不良明细数量必须是正整数" };
  if (defectQtySum !== input.badQty) {
    return { ok: false, error: "不良明细数量之和必须等于报工不良数量" };
  }
  const reasonIds = [...new Set(input.defects.map((item) => item.reasonId))];
  if (reasonIds.length) {
    const validReasonCount = await prisma.defectReason.count({ where: { id: { in: reasonIds }, status: "启用", appliesTo: { in: [input.type, "通用"] } } });
    if (validReasonCount !== reasonIds.length) return { ok: false, error: "包含无效或不适用的不良原因" };
  }

  const total = totalQty(input.goodQty, input.badQty);
  const moldCountThisTime = thisMoldCount(total, mold.cavityCount);
  const batchNo = await generateBatchNo(input.type, new Date(input.startTime), input.shift, equipment.code);
  const previousGood = await prisma.productionBatch.aggregate({
    where: { workOrderId: workOrder.id, status: "已完工" },
    _sum: { goodQty: true },
  });
  const completesWorkOrder = (previousGood._sum.goodQty ?? 0) + input.goodQty >= workOrder.planQty;

  const newCurrentCount = mold.currentCount + moldCountThisTime;
  const alertAfter = evaluateMoldAlert({ ...mold, currentCount: newCurrentCount });
  const enteredMaintenance = mold.status === "可用" && alertAfter.dueForMaintenance;

  await prisma.$transaction([
    prisma.productionBatch.create({
      data: {
        batchNo,
        workOrderId: input.workOrderId,
        skuId: workOrder.skuId,
        type: input.type,
        equipmentId: input.equipmentId,
        moldId: input.moldId,
        materialLotId: input.materialLotId,
        shift: input.shift,
        operator: input.operator,
        startTime,
        endTime,
        issuedWeight: input.issuedWeight,
        goodQty: input.goodQty,
        badQty: input.badQty,
        scrapWeight: input.scrapWeight,
        returnWeight: input.returnWeight,
        thisMoldCount: moldCountThisTime,
        status: "已完工",
        confirmedByLeader: alertBefore.overLife && !!input.confirmOverLife,
        leaderConfirmedBy: alertBefore.overLife ? input.leaderConfirmedBy?.trim() : null,
        leaderConfirmedAt: alertBefore.overLife ? new Date() : null,
        defects: {
          create: input.defects
            .filter((d) => d.qty > 0)
            .map((d) => ({
              qty: d.qty,
              reasonId: d.reasonId,
              responsible: d.responsible,
              action: d.action,
              recordedBy: input.operator,
              recordedAt: endTime,
            })),
        },
      },
    }),
    prisma.materialIssue.create({
      data: {
        workOrderId: input.workOrderId,
        materialLotId: input.materialLotId,
        qty: input.issuedWeight,
        issuedBy: input.operator,
        issuedAt: startTime,
        equipmentId: input.equipmentId,
      },
    }),
    ...(input.returnWeight > 0
      ? [
          prisma.materialReturn.create({
            data: {
              workOrderId: input.workOrderId,
              materialLotId: input.materialLotId,
              qty: input.returnWeight,
              reason: input.type === "注塑" ? "报工退料" : "报工后剩余卷材",
              returnedAt: endTime,
              returnedBy: input.operator,
            },
          }),
        ]
      : []),
    prisma.materialLot.update({
      where: { id: input.materialLotId },
      data: { remainingQty: { decrement: input.issuedWeight - input.returnWeight } },
    }),
    prisma.moldMaster.update({
      where: { id: input.moldId },
      data: {
        currentCount: newCurrentCount,
        status: enteredMaintenance ? "待保养" : mold.status,
      },
    }),
    prisma.workOrder.update({
      where: { id: input.workOrderId },
      data: { status: completesWorkOrder ? "已完工" : "生产中" },
    }),
  ]);

  revalidatePath("/injection");
  revalidatePath("/stamping");
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  revalidatePath("/molds");
  revalidatePath("/materials");
  revalidatePath("/trace");
  revalidatePath("/report");

  return { ok: true, batchNo, moldLifeRatePct: Math.round(alertAfter.lifeRate * 1000) / 10, enteredMaintenance };
}
