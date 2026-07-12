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

  if (workOrder.status === "未下达") return { ok: false, error: "工单未下达，不可开工" };
  if (workOrder.status === "已关闭") return { ok: false, error: "工单已关闭，不可继续报工" };

  if (MOLD_BLOCKED_STATUS.includes(mold.status)) {
    return { ok: false, error: `模具当前状态为「${mold.status}」，不允许开工` };
  }

  const alertBefore = evaluateMoldAlert(mold);
  if (alertBefore.overLife && !input.confirmOverLife) {
    return { ok: false, needOverLifeConfirm: true, lifeRatePct: Math.round(alertBefore.lifeRate * 1000) / 10 };
  }

  if (input.issuedWeight > materialLot.remainingQty) {
    return { ok: false, error: `领用数量（${input.issuedWeight}）超过物料批次可用库存（${materialLot.remainingQty}）` };
  }

  const defectQtySum = input.defects.reduce((s, d) => s + d.qty, 0);
  if (defectQtySum > input.badQty) {
    return { ok: false, error: "不良明细数量之和不可超过报工不良数量" };
  }

  const total = totalQty(input.goodQty, input.badQty);
  const moldCountThisTime = thisMoldCount(total, mold.cavityCount);
  const batchNo = await generateBatchNo(input.type, new Date(input.startTime), input.shift, equipment.code);

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
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        issuedWeight: input.issuedWeight,
        goodQty: input.goodQty,
        badQty: input.badQty,
        scrapWeight: input.scrapWeight,
        returnWeight: input.returnWeight,
        thisMoldCount: moldCountThisTime,
        status: "已完工",
        confirmedByLeader: false,
        defects: {
          create: input.defects
            .filter((d) => d.qty > 0)
            .map((d) => ({
              qty: d.qty,
              reasonId: d.reasonId,
              responsible: d.responsible,
              action: d.action,
              recordedBy: input.operator,
              recordedAt: new Date(input.endTime),
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
        issuedAt: new Date(input.startTime),
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
              returnedAt: new Date(input.endTime),
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
    ...(workOrder.status === "已下达"
      ? [prisma.workOrder.update({ where: { id: input.workOrderId }, data: { status: "生产中" } })]
      : []),
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
