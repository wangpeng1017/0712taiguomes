"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { generateBatchNo } from "@/lib/batch-no";
import { MOLD_BLOCKED_STATUS } from "@/lib/constants";
import { equivalentBomConsumption, validateFrozenBomConsumption } from "@/lib/bom-workflow";
import { assertBatchCanBeVoided, assertOperationTransition, isFinalOperationComplete } from "@/lib/operation-workflow";
import { evaluateMoldAlert, thisMoldCount, totalQty } from "@/lib/production-calc";

export type OperationMaterialInput = {
  materialLotId: string;
  qty: number;
  consumptionType?: string;
  requirementId?: string;
};

export type OperationSourceBatchInput = {
  batchId: string;
  qty: number;
  relationType?: "转序" | "拆批" | "合批" | "返工";
};

export type SubmitOperationReportInput = {
  workOrderOperationId: string;
  equipmentId?: string;
  moldId?: string;
  materialInputs?: OperationMaterialInput[];
  sourceBatchInputs?: OperationSourceBatchInput[];
  shift: "白班" | "夜班";
  operator: string;
  startTime: string;
  endTime: string;
  goodQty: number;
  badQty: number;
  scrapWeight?: number;
  returnWeight?: number;
  defects?: { reasonId: string; qty: number; responsible: string; action: string }[];
  note?: string;
  confirmOverLife?: boolean;
  leaderConfirmedBy?: string;
  reworkOrderId?: string;
};

export type SubmitOperationReportResult =
  | { ok: true; batchNo: string; operationStatus: string; workOrderCompleted: boolean; enteredMaintenance: boolean }
  | { ok: false; error: string }
  | { ok: false; needOverLifeConfirm: true; lifeRatePct: number };

function revalidateOperationPaths() {
  for (const path of ["/operations", "/quality", "/injection", "/stamping", "/work-orders", "/materials", "/molds", "/trace", "/report", "/dashboard"]) {
    revalidatePath(path);
  }
}

export async function submitOperationReport(input: SubmitOperationReportInput): Promise<SubmitOperationReportResult> {
  const operation = await prisma.workOrderOperation.findUniqueOrThrow({
    where: { id: input.workOrderOperationId },
    include: {
      workOrder: { include: {
        sku: true,
        materialRequirements: { include: { bomItem: { include: { substitutes: true } } } },
      } },
      planEquipment: true,
      planMold: true,
    },
  });
  const reworkOrder = input.reworkOrderId
    ? await prisma.reworkOrder.findUniqueOrThrow({ where: { id: input.reworkOrderId } })
    : null;
  if (!["已下达", "生产中"].includes(operation.workOrder.status)) {
    return { ok: false, error: `工单当前状态为「${operation.workOrder.status}」，不可报工` };
  }
  if (!reworkOrder && !["可开工", "生产中"].includes(operation.status)) {
    return { ok: false, error: `工序任务当前状态为「${operation.status}」，不可报工` };
  }
  if (!input.operator.trim()) return { ok: false, error: "操作员不能为空" };
  if (reworkOrder && reworkOrder.workOrderOperationId !== operation.id) return { ok: false, error: "返工任务与当前工序不一致" };
  if (reworkOrder && !["待处理", "处理中"].includes(reworkOrder.status)) return { ok: false, error: `返工任务当前状态为「${reworkOrder.status}」` };

  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(endTime.getTime()) || endTime <= startTime) {
    return { ok: false, error: "结束时间必须晚于开始时间" };
  }
  if (![input.goodQty, input.badQty].every((value) => Number.isInteger(value) && value >= 0)) {
    return { ok: false, error: "良品和不良数量必须是非负整数" };
  }
  const reportTotal = totalQty(input.goodQty, input.badQty);
  if (reportTotal <= 0) return { ok: false, error: "报工总数量必须大于 0" };

  const defects = input.defects ?? [];
  if (defects.some((item) => !Number.isInteger(item.qty) || item.qty <= 0)) return { ok: false, error: "不良明细数量必须是正整数" };
  if (defects.reduce((sum, item) => sum + item.qty, 0) !== input.badQty) return { ok: false, error: "不良明细数量之和必须等于报工不良数量" };
  if (defects.length) {
    const reasonIds = [...new Set(defects.map((item) => item.reasonId))];
    const validCount = await prisma.defectReason.count({ where: { id: { in: reasonIds }, status: "启用", appliesTo: { in: [operation.workOrder.type, "通用"] } } });
    if (validCount !== reasonIds.length) return { ok: false, error: "包含无效或不适用的不良原因" };
  }

  const previousOperation = await prisma.workOrderOperation.findFirst({
    where: { workOrderId: operation.workOrderId, sequence: { lt: operation.sequence } },
    orderBy: { sequence: "desc" },
  });
  const sourceInputs = input.sourceBatchInputs ?? [];
  const materialInputs = input.materialInputs ?? [];
  if (previousOperation && sourceInputs.length === 0 && !input.reworkOrderId) return { ok: false, error: "非首道工序必须选择上游生产批次" };
  if (!previousOperation && materialInputs.length === 0 && !input.reworkOrderId) return { ok: false, error: "首道工序必须登记原材料投入" };

  const sourceBatches = sourceInputs.length
    ? await prisma.productionBatch.findMany({
        where: { id: { in: sourceInputs.map((item) => item.batchId) } },
        include: { workOrderOperation: true, genealogySources: true },
      })
    : [];
  if (sourceBatches.length !== new Set(sourceInputs.map((item) => item.batchId)).size) return { ok: false, error: "包含无效的上游批次" };
  for (const sourceInput of sourceInputs) {
    if (!Number.isFinite(sourceInput.qty) || sourceInput.qty <= 0) return { ok: false, error: "上游批次投入数量必须大于 0" };
    const source = sourceBatches.find((batch) => batch.id === sourceInput.batchId)!;
    if (!reworkOrder && source.status !== "已完工") return { ok: false, error: `上游批次 ${source.batchNo} 尚未放行` };
    if (reworkOrder && source.id !== reworkOrder.sourceBatchId) return { ok: false, error: "返工投入批次与返工任务不一致" };
    if (source.workOrderId !== operation.workOrderId) return { ok: false, error: "上游批次不属于当前工单" };
    if (!input.reworkOrderId && source.workOrderOperationId !== previousOperation?.id) return { ok: false, error: "上游批次不是当前工序的直接前序产出" };
    const consumed = source.genealogySources
      .filter((edge) => edge.relationType !== "返工")
      .reduce((sum, edge) => sum + edge.qty, 0);
    const availableQty = reworkOrder ? reworkOrder.qty : source.goodQty - consumed;
    if (sourceInput.qty > availableQty) return { ok: false, error: `上游批次 ${source.batchNo} 可投入数量不足` };
  }
  const sourceInputQty = sourceInputs.reduce((sum, item) => sum + item.qty, 0);
  if (previousOperation && sourceInputQty < reportTotal) return { ok: false, error: "工序产出数量不能超过本次上游投入数量" };

  const lots = materialInputs.length
    ? await prisma.materialLot.findMany({ where: { id: { in: materialInputs.map((item) => item.materialLotId) } }, include: { material: true } })
    : [];
  if (lots.length !== new Set(materialInputs.map((item) => item.materialLotId)).size) return { ok: false, error: "包含无效的物料批次" };
  const hasFrozenBom = !!operation.workOrder.bomVersionId;
  const applicableRequirements = operation.workOrder.materialRequirements.filter((requirement) =>
    requirement.operationSequence === operation.sequence || (requirement.operationSequence == null && !previousOperation)
  );
  if (applicableRequirements.length > 0 && materialInputs.length === 0) {
    return { ok: false, error: "当前工序存在冻结 BOM 用料要求，必须登记物料投入" };
  }
  const resolvedRequirements: Array<{
    requirementId: string;
    materialName: string;
    requiredQty: number;
    isSubstitute: boolean;
    conversionRate: number;
  } | undefined> = [];
  for (const [materialIndex, materialInput] of materialInputs.entries()) {
    if (!Number.isFinite(materialInput.qty) || materialInput.qty <= 0) return { ok: false, error: "物料投入数量必须大于 0" };
    const lot = lots.find((item) => item.id === materialInput.materialLotId)!;
    if (!["合格", "让步接收"].includes(lot.inspectStatus) || lot.stockStatus !== "可用") return { ok: false, error: `物料批次 ${lot.lotNo} 当前不可用` };
    if (materialInput.qty > lot.remainingQty) return { ok: false, error: `物料批次 ${lot.lotNo} 可用库存不足` };
    if (hasFrozenBom) {
      if (!materialInput.requirementId) return { ok: false, error: `物料批次 ${lot.lotNo} 必须选择对应的工单用料要求` };
      const requirement = applicableRequirements.find((item) => item.id === materialInput.requirementId);
      if (!requirement) return { ok: false, error: `物料批次 ${lot.lotNo} 不属于当前工序的冻结 BOM 要求` };
      const isPrimary = requirement.materialId === lot.materialId;
      const now = startTime;
      const substitute = requirement.bomItem?.substitutes.find((item) => item.materialId === lot.materialId
        && item.status === "启用" && (!item.effectiveFrom || item.effectiveFrom <= now) && (!item.effectiveTo || item.effectiveTo >= now));
      if (!isPrimary && !substitute) return { ok: false, error: `物料 ${lot.material.name} 既非 BOM 标准料，也非当前有效替代料` };
      resolvedRequirements[materialIndex] = {
        requirementId: requirement.id,
        materialName: requirement.materialName,
        requiredQty: requirement.requiredQty,
        isSubstitute: !isPrimary,
        conversionRate: isPrimary ? 1 : substitute!.conversionRate,
      };
    }
  }
  if ((input.returnWeight ?? 0) < 0) return { ok: false, error: "退料数量不可为负数" };
  if ((input.returnWeight ?? 0) > (materialInputs[0]?.qty ?? 0)) return { ok: false, error: "退料数量不可超过首个物料批次的领用数量" };
  const issuedByLot = new Map<string, number>();
  for (const materialInput of materialInputs) {
    issuedByLot.set(materialInput.materialLotId, (issuedByLot.get(materialInput.materialLotId) ?? 0) + materialInput.qty);
  }
  for (const [materialLotId, issuedQty] of issuedByLot) {
    const lot = lots.find((item) => item.id === materialLotId)!;
    if (issuedQty > lot.remainingQty) return { ok: false, error: `物料批次 ${lot.lotNo} 累计投入数量超过可用库存` };
  }
  try {
    validateFrozenBomConsumption(
      applicableRequirements,
      materialInputs.flatMap((materialInput, materialIndex) => {
        const resolved = resolvedRequirements[materialIndex];
        if (!resolved) return [];
        const actualConsumedQty = materialInput.qty - (materialIndex === 0 ? (input.returnWeight ?? 0) : 0);
        return [{
          requirementId: resolved.requirementId,
          equivalentQty: equivalentBomConsumption(actualConsumedQty, resolved.conversionRate),
        }];
      }),
    );
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "BOM 用料校验失败" };
  }

  const [equipment, mold] = await Promise.all([
    input.equipmentId ? prisma.equipmentMaster.findUniqueOrThrow({ where: { id: input.equipmentId } }) : null,
    input.moldId ? prisma.moldMaster.findUniqueOrThrow({ where: { id: input.moldId } }) : null,
  ]);
  if (operation.requiresEquipment && !equipment) return { ok: false, error: "当前工序必须选择设备" };
  if (equipment && equipment.status !== "可用") return { ok: false, error: `设备当前状态为「${equipment.status}」，不可开工` };
  if (operation.planEquipmentId && equipment?.id !== operation.planEquipmentId) return { ok: false, error: "所选设备与工序计划设备不一致" };
  if (operation.requiresMold && !mold) return { ok: false, error: "当前工序必须选择模具" };
  if (mold && MOLD_BLOCKED_STATUS.includes(mold.status)) return { ok: false, error: `模具当前状态为「${mold.status}」，不可开工` };
  if (operation.planMoldId && mold?.id !== operation.planMoldId) return { ok: false, error: "所选模具与工序计划模具不一致" };
  if (mold?.applicableSkuId && mold.applicableSkuId !== operation.workOrder.skuId) return { ok: false, error: "模具不适用于当前产品" };
  if (mold?.applicableEquipmentId && equipment && mold.applicableEquipmentId !== equipment.id) return { ok: false, error: "模具不适用于所选设备" };

  const moldAlertBefore = mold ? evaluateMoldAlert(mold) : null;
  if (moldAlertBefore?.overLife && !input.confirmOverLife) {
    return { ok: false, needOverLifeConfirm: true, lifeRatePct: Math.round(moldAlertBefore.lifeRate * 1000) / 10 };
  }
  if (moldAlertBefore?.overLife && !input.leaderConfirmedBy?.trim()) return { ok: false, error: "超寿命生产必须填写主管姓名" };

  const equipmentCode = equipment?.code ?? operation.workCenter?.replace(/[^A-Za-z0-9]/g, "").slice(0, 12) ?? "MANUAL";
  const batchNo = await generateBatchNo(operation.workOrder.type as "注塑" | "冲压", startTime, input.shift, equipmentCode);
  const moldCount = mold ? thisMoldCount(reportTotal, mold.cavityCount) : 0;
  const nextMoldCount = mold ? mold.currentCount + moldCount : 0;
  const moldAlertAfter = mold ? evaluateMoldAlert({ ...mold, currentCount: nextMoldCount }) : null;
  const enteredMaintenance = !!mold && mold.status === "可用" && !!moldAlertAfter?.dueForMaintenance;
  const qualifiedAtReport = operation.qualityRequired ? 0 : input.goodQty;
  const nextInputQty = operation.inputQty + (previousOperation ? Math.trunc(sourceInputQty) : reportTotal);
  const nextGoodQty = operation.goodQty + qualifiedAtReport;
  const nextBadQty = operation.badQty + input.badQty;
  const scrapQty = defects.filter((item) => item.action === "报废").reduce((sum, item) => sum + item.qty, 0);
  const taskReachedPlan = nextInputQty >= operation.plannedQty;
  const operationStatus = taskReachedPlan ? (operation.qualityRequired ? "待检" : "已完成") : "生产中";
  const workOrderCompleted = operation.isFinal && !operation.qualityRequired && isFinalOperationComplete(nextGoodQty, operation.workOrder.planQty);

  await prisma.$transaction(async (tx) => {
    const batch = await tx.productionBatch.create({
      data: {
        batchNo,
        workOrderId: operation.workOrderId,
        workOrderOperationId: operation.id,
        skuId: operation.workOrder.skuId,
        type: operation.workOrder.type,
        equipmentId: equipment?.id ?? null,
        moldId: mold?.id ?? null,
        materialLotId: materialInputs[0]?.materialLotId ?? null,
        shift: input.shift,
        operator: input.operator.trim(),
        startTime,
        endTime,
        issuedWeight: materialInputs.reduce((sum, item) => sum + item.qty, 0) || null,
        goodQty: input.goodQty,
        badQty: input.badQty,
        scrapWeight: input.scrapWeight ?? 0,
        returnWeight: input.returnWeight ?? 0,
        thisMoldCount: mold ? moldCount : null,
        status: operation.qualityRequired ? "待检" : "已完工",
        confirmedByLeader: !!moldAlertBefore?.overLife && !!input.confirmOverLife,
        leaderConfirmedBy: moldAlertBefore?.overLife ? input.leaderConfirmedBy?.trim() : null,
        leaderConfirmedAt: moldAlertBefore?.overLife ? new Date() : null,
        note: input.note?.trim() || null,
        defects: { create: defects.map((item) => ({ ...item, recordedBy: input.operator.trim(), recordedAt: endTime })) },
      },
    });

    for (const [materialIndex, materialInput] of materialInputs.entries()) {
      const lot = lots.find((item) => item.id === materialInput.materialLotId)!;
      const consumedQty = materialInput.qty - (materialIndex === 0 ? (input.returnWeight ?? 0) : 0);
      const resolved = resolvedRequirements[materialIndex];
      const equivalentConsumedQty = resolved
        ? equivalentBomConsumption(consumedQty, resolved.conversionRate)
        : consumedQty;
      await tx.batchMaterialConsumption.create({
        data: {
          batchId: batch.id, materialLotId: lot.id, qty: consumedQty, unit: lot.unit,
          consumptionType: materialInput.consumptionType ?? "主料",
          workOrderMaterialRequirementId: resolved?.requirementId ?? null,
          isSubstitute: resolved?.isSubstitute ?? false,
        },
      });
      await tx.materialIssue.create({
        data: { workOrderId: operation.workOrderId, materialLotId: lot.id, qty: materialInput.qty, issuedBy: input.operator.trim(), issuedAt: startTime, equipmentId: equipment?.id ?? null, note: `工序 ${operation.operationCode}` },
      });
      await tx.materialLot.update({ where: { id: lot.id }, data: { remainingQty: { decrement: consumedQty } } });
      if (resolved) {
        const updated = await tx.workOrderMaterialRequirement.updateMany({
          where: {
            id: resolved.requirementId,
            consumedQty: { lte: resolved.requiredQty - equivalentConsumedQty + 1e-9 },
          },
          data: { issuedQty: { increment: materialInput.qty }, consumedQty: { increment: equivalentConsumedQty } },
        });
        if (updated.count !== 1) throw new Error(`物料 ${resolved.materialName} 累计等效消耗不可超过需求数量 ${resolved.requiredQty}`);
      }
    }
    if ((input.returnWeight ?? 0) > 0 && materialInputs[0]) {
      await tx.materialReturn.create({
        data: { workOrderId: operation.workOrderId, materialLotId: materialInputs[0].materialLotId, qty: input.returnWeight!, reason: `工序 ${operation.operationCode} 报工退料`, returnedAt: endTime, returnedBy: input.operator.trim() },
      });
    }

    for (const sourceInput of sourceInputs) {
      await tx.batchMaterialConsumption.create({
        data: { batchId: batch.id, sourceBatchId: sourceInput.batchId, qty: sourceInput.qty, unit: "PCS", consumptionType: input.reworkOrderId ? "返工料" : "半成品" },
      });
      await tx.batchGenealogy.create({
        data: { sourceBatchId: sourceInput.batchId, targetBatchId: batch.id, qty: sourceInput.qty, relationType: input.reworkOrderId ? "返工" : (sourceInput.relationType ?? (sourceInputs.length > 1 ? "合批" : "转序")), operator: input.operator.trim() },
      });
      const source = sourceBatches.find((item) => item.id === sourceInput.batchId)!;
      if (source.workOrderOperationId) {
        await tx.workOrderOperation.update({ where: { id: source.workOrderOperationId }, data: { transferredQty: { increment: Math.trunc(sourceInput.qty) } } });
      }
    }

    await tx.workOrderOperation.update({
      where: { id: operation.id },
      data: {
        status: operationStatus,
        inputQty: nextInputQty,
        goodQty: nextGoodQty,
        badQty: nextBadQty,
        scrapQty: operation.scrapQty + scrapQty,
        startedAt: operation.startedAt ?? startTime,
        completedAt: operationStatus === "已完成" ? endTime : null,
        qualityStatus: operation.qualityRequired ? "待检" : "不适用",
      },
    });
    if (!operation.qualityRequired && input.goodQty > 0) {
      const nextOperation = await tx.workOrderOperation.findFirst({ where: { workOrderId: operation.workOrderId, sequence: { gt: operation.sequence }, status: "等待前序" }, orderBy: { sequence: "asc" } });
      if (nextOperation) await tx.workOrderOperation.update({ where: { id: nextOperation.id }, data: { status: "可开工" } });
    }
    await tx.workOrder.update({ where: { id: operation.workOrderId }, data: { status: workOrderCompleted ? "已完工" : "生产中" } });
    if (mold) {
      await tx.moldMaster.update({ where: { id: mold.id }, data: { currentCount: nextMoldCount, status: enteredMaintenance ? "待保养" : mold.status } });
    }
    if (input.reworkOrderId) {
      await tx.reworkOrder.update({
        where: { id: input.reworkOrderId },
        data: { resultBatchId: batch.id, qualifiedQty: input.goodQty, scrapQty, status: "已完成", completedAt: endTime },
      });
    }
  });

  revalidateOperationPaths();
  return { ok: true, batchNo, operationStatus, workOrderCompleted, enteredMaintenance };
}

export async function recordOperationQuality(input: {
  batchId: string;
  result: "合格" | "不合格" | "让步接收";
  qualifiedQty: number;
  unqualifiedQty: number;
  sampleQty?: number;
  inspector: string;
  valuesJson?: string;
  note?: string;
}) {
  const batch = await prisma.productionBatch.findUniqueOrThrow({
    where: { id: input.batchId },
    include: { workOrderOperation: { include: { workOrder: true } }, qualityResults: true },
  });
  const operation = batch.workOrderOperation;
  if (!operation || !operation.qualityRequired) throw new Error("该批次不属于必检工序");
  if (!['待检', '质量冻结'].includes(batch.status)) throw new Error(`批次当前状态为「${batch.status}」，不可重复检验`);
  if (!input.inspector.trim()) throw new Error("检验员不能为空");
  if (![input.qualifiedQty, input.unqualifiedQty].every((value) => Number.isInteger(value) && value >= 0)) throw new Error("检验数量必须是非负整数");
  if (input.qualifiedQty + input.unqualifiedQty !== batch.goodQty) throw new Error("合格与不合格数量之和必须等于该批次待检数量");
  if (batch.qualityResults.length > 0 && batch.status === "待检") throw new Error("该批次已有检验记录");

  const released = input.result === "不合格" ? 0 : input.qualifiedQty;
  const nextGoodQty = operation.goodQty + released;
  const taskReachedPlan = operation.inputQty >= operation.plannedQty;
  const operationStatus = input.result === "不合格" ? "质量冻结" : taskReachedPlan ? "已完成" : "生产中";
  const workOrderCompleted = operation.isFinal && input.result !== "不合格" && isFinalOperationComplete(nextGoodQty, operation.workOrder.planQty);

  await prisma.$transaction(async (tx) => {
    await tx.operationQualityResult.create({
      data: {
        workOrderOperationId: operation.id,
        batchId: batch.id,
        result: input.result,
        sampleQty: input.sampleQty,
        qualifiedQty: input.qualifiedQty,
        unqualifiedQty: input.unqualifiedQty,
        inspector: input.inspector.trim(),
        valuesJson: input.valuesJson?.trim() || null,
        note: input.note?.trim() || null,
      },
    });
    await tx.productionBatch.update({ where: { id: batch.id }, data: { status: input.result === "不合格" ? "质量冻结" : "已完工" } });
    await tx.workOrderOperation.update({
      where: { id: operation.id },
      data: {
        goodQty: nextGoodQty,
        badQty: { increment: input.unqualifiedQty },
        status: operationStatus,
        qualityStatus: input.result,
        completedAt: operationStatus === "已完成" ? new Date() : null,
      },
    });
    if (released > 0) {
      const nextOperation = await tx.workOrderOperation.findFirst({ where: { workOrderId: operation.workOrderId, sequence: { gt: operation.sequence }, status: "等待前序" }, orderBy: { sequence: "asc" } });
      if (nextOperation) await tx.workOrderOperation.update({ where: { id: nextOperation.id }, data: { status: "可开工" } });
    }
    await tx.workOrder.update({ where: { id: operation.workOrderId }, data: { status: workOrderCompleted ? "已完工" : "生产中" } });
  });
  revalidateOperationPaths();
}

export async function createReworkOrder(input: {
  sourceBatchId: string;
  workOrderOperationId: string;
  routeVersionId: string;
  qty: number;
  reason: string;
  createdBy: string;
  approvedBy?: string;
  note?: string;
}) {
  if (!Number.isInteger(input.qty) || input.qty <= 0) throw new Error("返工数量必须是正整数");
  if (!input.reason.trim() || !input.createdBy.trim()) throw new Error("返工原因和创建人不能为空");
  const [batch, operation, routeVersion] = await Promise.all([
    prisma.productionBatch.findUniqueOrThrow({ where: { id: input.sourceBatchId } }),
    prisma.workOrderOperation.findUniqueOrThrow({ where: { id: input.workOrderOperationId } }),
    prisma.processRouteVersion.findUniqueOrThrow({ where: { id: input.routeVersionId } }),
  ]);
  if (batch.status === "已作废") throw new Error("已作废批次不可返工");
  if (operation.workOrderId !== batch.workOrderId) throw new Error("返工工序必须属于原生产工单");
  if (routeVersion.status !== "已发布") throw new Error("返工路线必须是已发布版本");
  const existing = await prisma.reworkOrder.aggregate({ where: { sourceBatchId: batch.id, status: { in: ["待处理", "处理中", "已完成"] } }, _sum: { qty: true } });
  if ((existing._sum.qty ?? 0) + input.qty > batch.badQty) throw new Error("返工数量超过批次可返工不良数量");
  const count = await prisma.reworkOrder.count();
  await prisma.reworkOrder.create({
    data: {
      no: `RW-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(count + 1).padStart(4, "0")}`,
      sourceBatchId: batch.id,
      workOrderOperationId: operation.id,
      routeVersionId: routeVersion.id,
      qty: input.qty,
      reason: input.reason.trim(),
      createdBy: input.createdBy.trim(),
      approvedBy: input.approvedBy?.trim() || null,
      note: input.note?.trim() || null,
    },
  });
  revalidateOperationPaths();
}

export async function setOperationStatus(id: string, status: string) {
  const operation = await prisma.workOrderOperation.findUniqueOrThrow({ where: { id } });
  assertOperationTransition(operation.status, status);
  await prisma.workOrderOperation.update({
    where: { id },
    data: {
      status,
      startedAt: status === "生产中" ? operation.startedAt ?? new Date() : operation.startedAt,
      completedAt: status === "已完成" ? new Date() : operation.completedAt,
    },
  });
  revalidateOperationPaths();
}

export async function voidOperationBatch(batchId: string, reason: string) {
  if (!reason.trim()) throw new Error("请填写作废原因");
  const batch = await prisma.productionBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: {
      stockIns: true,
      genealogySources: true,
      sourceReworkOrders: { where: { status: { in: ["待处理", "处理中"] } } },
      materialConsumptions: {
        include: {
          materialLot: true,
          workOrderMaterialRequirement: { include: { bomItem: { include: { substitutes: true } } } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
      genealogyTargets: { include: { sourceBatch: true } },
      qualityResults: true,
      workOrderOperation: true,
      mold: true,
    },
  });
  assertBatchCanBeVoided({
    stockInCount: batch.stockIns.length,
    downstreamConsumptionCount: batch.genealogySources.length,
    activeReworkCount: batch.sourceReworkOrders.length,
  });
  if (batch.status === "已作废") throw new Error("该批次已经作废");
  const returnedConsumptionId = batch.materialConsumptions.find((consumption) => consumption.materialLotId === batch.materialLotId)?.id;

  await prisma.$transaction(async (tx) => {
    for (const consumption of batch.materialConsumptions) {
      if (consumption.materialLotId) {
        await tx.materialLot.update({ where: { id: consumption.materialLotId }, data: { remainingQty: { increment: consumption.qty } } });
        await tx.materialIssue.deleteMany({
          where: { workOrderId: batch.workOrderId, materialLotId: consumption.materialLotId, issuedAt: batch.startTime },
        });
        if (batch.endTime) {
          await tx.materialReturn.deleteMany({
            where: { workOrderId: batch.workOrderId, materialLotId: consumption.materialLotId, returnedAt: batch.endTime },
          });
        }
      }
      if (consumption.workOrderMaterialRequirementId) {
        const substitute = consumption.isSubstitute
          ? consumption.workOrderMaterialRequirement?.bomItem?.substitutes.find((item) => item.materialId === consumption.materialLot?.materialId)
          : null;
        const equivalentConsumedQty = equivalentBomConsumption(consumption.qty, substitute?.conversionRate ?? 1);
        const issuedQty = consumption.qty
          + (consumption.id === returnedConsumptionId ? (batch.returnWeight ?? 0) : 0);
        await tx.workOrderMaterialRequirement.update({
          where: { id: consumption.workOrderMaterialRequirementId },
          data: { consumedQty: { decrement: equivalentConsumedQty }, issuedQty: { decrement: issuedQty } },
        });
      }
    }
    for (const edge of batch.genealogyTargets) {
      if (edge.sourceBatch.workOrderOperationId) {
        await tx.workOrderOperation.update({ where: { id: edge.sourceBatch.workOrderOperationId }, data: { transferredQty: { decrement: Math.trunc(edge.qty) } } });
      }
    }
    await tx.batchGenealogy.deleteMany({ where: { targetBatchId: batch.id } });
    await tx.batchMaterialConsumption.deleteMany({ where: { batchId: batch.id } });
    await tx.operationQualityResult.deleteMany({ where: { batchId: batch.id } });
    await tx.productionBatch.update({ where: { id: batch.id }, data: { status: "已作废", note: [batch.note, `作废原因：${reason.trim()}`].filter(Boolean).join("\n") } });
    if (batch.workOrderOperation) {
      const qualifiedGood = batch.workOrderOperation.qualityRequired
        ? batch.qualityResults.reduce((sum, result) => sum + (result.result === "不合格" ? 0 : (result.qualifiedQty ?? 0)), 0)
        : batch.goodQty;
      const operationInput = batch.genealogyTargets.length
        ? batch.genealogyTargets.reduce((sum, edge) => sum + Math.trunc(edge.qty), 0)
        : batch.goodQty + batch.badQty;
      await tx.workOrderOperation.update({
        where: { id: batch.workOrderOperation.id },
        data: {
          inputQty: { decrement: operationInput },
          goodQty: { decrement: qualifiedGood },
          badQty: { decrement: batch.badQty },
          status: "生产中",
          completedAt: null,
        },
      });
    }
    if (batch.mold && batch.thisMoldCount) {
      await tx.moldMaster.update({ where: { id: batch.mold.id }, data: { currentCount: Math.max(batch.mold.currentCount - batch.thisMoldCount, 0) } });
    }
  });
  revalidateOperationPaths();
}
