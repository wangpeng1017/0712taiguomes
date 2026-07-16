"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { WORK_ORDER_STATUS, WORK_ORDER_TRANSITIONS } from "@/lib/constants";
import { isFinalOperationComplete } from "@/lib/operation-workflow";
import { validateBomRouteCompatibility } from "@/lib/bom-workflow";

function nextWorkOrderNo(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `WO-${stamp}-${rand}`;
}

export async function createWorkOrder(input: {
  skuId: string;
  planQty: number;
  planStart: string;
  planEnd: string;
  planEquipmentId?: string;
  planMoldId?: string;
  bomVersion?: string;
  bomVersionId?: string;
  routeVersionId: string;
  note?: string;
}) {
  if (!input.bomVersionId) throw new Error("新建生产工单必须选择已发布 BOM 版本");
  const sku = await prisma.productSku.findUniqueOrThrow({ where: { id: input.skuId } });
  if (sku.status !== "启用" || !["注塑", "冲压"].includes(sku.type)) throw new Error("所选产品不可用于生产工单");
  if (!Number.isInteger(input.planQty) || input.planQty <= 0) throw new Error("计划数量必须是正整数");
  const planStart = new Date(input.planStart);
  const planEnd = new Date(input.planEnd);
  if (!Number.isFinite(planStart.getTime()) || !Number.isFinite(planEnd.getTime()) || planEnd < planStart) {
    throw new Error("计划结束日期不可早于开始日期");
  }

  const [equipment, mold, routeVersion, bomDefinition] = await Promise.all([
    input.planEquipmentId ? prisma.equipmentMaster.findUniqueOrThrow({ where: { id: input.planEquipmentId } }) : null,
    input.planMoldId ? prisma.moldMaster.findUniqueOrThrow({ where: { id: input.planMoldId } }) : null,
    prisma.processRouteVersion.findUniqueOrThrow({ where: { id: input.routeVersionId }, include: { route: true, operations: true } }),
    input.bomVersionId ? prisma.bomVersion.findUniqueOrThrow({ where: { id: input.bomVersionId }, include: { bom: true, items: { where: { status: "启用" } } } }) : null,
  ]);
  if (routeVersion.status !== "已发布" || routeVersion.route.status !== "启用") throw new Error("只能选择已发布且启用的工艺路线版本");
  if (routeVersion.route.skuId !== sku.id) throw new Error("所选工艺路线不适用于该产品 SKU");
  if (routeVersion.effectiveFrom && planStart < routeVersion.effectiveFrom) throw new Error("计划开始日期早于工艺版本生效日期");
  if (routeVersion.effectiveTo && planStart > routeVersion.effectiveTo) throw new Error("计划开始日期已超过工艺版本失效日期");
  if (routeVersion.operations.length === 0 || !routeVersion.operations.some((operation) => operation.isFinal)) {
    throw new Error("工艺路线必须配置工序并指定末道工序");
  }
  if (bomDefinition && (bomDefinition.status !== "已发布" || bomDefinition.bom.status !== "启用" || bomDefinition.bom.skuId !== sku.id)) {
    throw new Error("只能选择适用于当前产品的已发布 BOM 版本");
  }
  if (bomDefinition && bomDefinition.items.length === 0) throw new Error("BOM 版本没有可用物料项");
  if (bomDefinition) validateBomRouteCompatibility({ bom: bomDefinition, route: routeVersion, planDate: planStart });
  const expectedEquipmentType = sku.type === "注塑" ? "注塑机" : "冲床";
  const expectedMoldType = sku.type === "注塑" ? "注塑模" : "冲压模";
  if (equipment && (equipment.type !== expectedEquipmentType || equipment.status !== "可用")) throw new Error("计划设备类型或状态不符合要求");
  if (mold && (mold.type !== expectedMoldType || ["维修中", "停用", "报废"].includes(mold.status))) throw new Error("计划模具类型或状态不符合要求");
  if (mold?.applicableSkuId && mold.applicableSkuId !== sku.id) throw new Error("计划模具不适用于所选产品");
  if (mold?.applicableEquipmentId && equipment && mold.applicableEquipmentId !== equipment.id) throw new Error("计划模具不适用于所选设备");

  await prisma.workOrder.create({
    data: {
      no: nextWorkOrderNo(),
      skuId: input.skuId,
      type: sku.type,
      planQty: input.planQty,
      planStart,
      planEnd,
      planEquipmentId: input.planEquipmentId || null,
      planMoldId: input.planMoldId || null,
      bomVersion: bomDefinition?.version ?? input.bomVersion ?? "V1.0",
      bomVersionId: bomDefinition?.id ?? null,
      routeVersionId: routeVersion.id,
      route: `${routeVersion.route.name} ${routeVersion.version}`,
      note: input.note || null,
      status: "未下达",
    },
  });
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
}

export async function updateWorkOrder(id: string, input: {
  skuId: string; planQty: number; planStart: string; planEnd: string; planEquipmentId?: string;
  planMoldId?: string; bomVersion?: string; bomVersionId?: string; routeVersionId: string; note?: string;
}) {
  if (!input.bomVersionId) throw new Error("生产工单必须绑定 BOM 版本后才能保存");
  const current = await prisma.workOrder.findUniqueOrThrow({ where: { id }, include: { _count: { select: { batches: true, operations: true } } } });
  if (["已完工", "已关闭"].includes(current.status)) throw new Error(`「${current.status}」工单不可编辑`);
  if (current._count.batches > 0 && input.skuId !== current.skuId) throw new Error("已有生产批次后不可更换产品 SKU");
  if (current.status !== "未下达" && input.routeVersionId !== current.routeVersionId) throw new Error("工单下达后工艺路线版本已冻结，不可直接更换");
  if (current.status !== "未下达" && input.bomVersionId !== current.bomVersionId) throw new Error("工单下达后 BOM 版本已冻结，不可直接更换");
  const sku = await prisma.productSku.findUniqueOrThrow({ where: { id: input.skuId } });
  if (sku.status !== "启用" || !["注塑", "冲压"].includes(sku.type)) throw new Error("所选产品不可用于生产工单");
  if (!Number.isInteger(input.planQty) || input.planQty <= 0) throw new Error("计划数量必须是正整数");
  const planStart = new Date(input.planStart);
  const planEnd = new Date(input.planEnd);
  if (!Number.isFinite(planStart.getTime()) || !Number.isFinite(planEnd.getTime()) || planEnd < planStart) throw new Error("计划结束日期不可早于开始日期");
  if (current._count.batches > 0 && (input.planEquipmentId !== current.planEquipmentId || input.planMoldId !== current.planMoldId)) {
    throw new Error("已有生产批次后不可更换计划设备或模具");
  }
  const [equipment, mold, routeVersion, bomDefinition] = await Promise.all([
    input.planEquipmentId ? prisma.equipmentMaster.findUniqueOrThrow({ where: { id: input.planEquipmentId } }) : null,
    input.planMoldId ? prisma.moldMaster.findUniqueOrThrow({ where: { id: input.planMoldId } }) : null,
    prisma.processRouteVersion.findUniqueOrThrow({ where: { id: input.routeVersionId }, include: { route: true, operations: true } }),
    input.bomVersionId ? prisma.bomVersion.findUniqueOrThrow({ where: { id: input.bomVersionId }, include: { bom: true, items: { where: { status: "启用" } } } }) : null,
  ]);
  if (routeVersion.status !== "已发布" || routeVersion.route.status !== "启用") throw new Error("只能选择已发布且启用的工艺路线版本");
  if (routeVersion.route.skuId !== sku.id) throw new Error("所选工艺路线不适用于该产品 SKU");
  if (routeVersion.effectiveFrom && planStart < routeVersion.effectiveFrom) throw new Error("计划开始日期早于工艺版本生效日期");
  if (routeVersion.effectiveTo && planStart > routeVersion.effectiveTo) throw new Error("计划开始日期已超过工艺版本失效日期");
  if (!routeVersion.operations.some((operation) => operation.isFinal)) throw new Error("工艺路线尚未指定末道工序");
  if (bomDefinition && (bomDefinition.status !== "已发布" || bomDefinition.bom.status !== "启用" || bomDefinition.bom.skuId !== sku.id || bomDefinition.items.length === 0)) {
    throw new Error("所选 BOM 版本不可用或不适用于当前产品");
  }
  if (bomDefinition) validateBomRouteCompatibility({ bom: bomDefinition, route: routeVersion, planDate: planStart });
  const expectedEquipmentType = sku.type === "注塑" ? "注塑机" : "冲床";
  const expectedMoldType = sku.type === "注塑" ? "注塑模" : "冲压模";
  if (equipment && (equipment.type !== expectedEquipmentType || equipment.status !== "可用")) throw new Error("计划设备类型或状态不符合要求");
  if (mold && (mold.type !== expectedMoldType || ["维修中", "停用", "报废"].includes(mold.status))) throw new Error("计划模具类型或状态不符合要求");
  if (mold?.applicableSkuId && mold.applicableSkuId !== sku.id) throw new Error("计划模具不适用于所选产品");
  if (mold?.applicableEquipmentId && equipment && mold.applicableEquipmentId !== equipment.id) throw new Error("计划模具不适用于所选设备");
  await prisma.workOrder.update({
    where: { id },
    data: {
      skuId: input.skuId, type: sku.type, planQty: input.planQty, planStart, planEnd,
      planEquipmentId: input.planEquipmentId || null, planMoldId: input.planMoldId || null,
      bomVersion: bomDefinition?.version ?? input.bomVersion?.trim() ?? "V1.0", routeVersionId: routeVersion.id,
      bomVersionId: bomDefinition?.id ?? null,
      route: `${routeVersion.route.name} ${routeVersion.version}`, note: input.note?.trim() || null,
    },
  });
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
}

export async function deleteWorkOrder(id: string) {
  const workOrder = await prisma.workOrder.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { batches: true, operations: true, materialIssues: true, materialReturns: true } } },
  });
  if (workOrder.status !== "未下达") throw new Error("只有未下达工单可以删除");
  if (Object.values(workOrder._count).some((count) => count > 0)) throw new Error("该工单已有业务记录，不可删除");
  await prisma.workOrder.delete({ where: { id } });
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
}

export async function setWorkOrderStatus(id: string, status: string) {
  if (!(WORK_ORDER_STATUS as readonly string[]).includes(status)) throw new Error("无效的工单状态");
  const workOrder = await prisma.workOrder.findUniqueOrThrow({
    where: { id },
    include: {
      batches: { where: { status: "已完工" }, select: { goodQty: true } },
      operations: { orderBy: { sequence: "asc" } },
      routeVersion: { include: { route: true, operations: { include: { operation: true }, orderBy: { sequence: "asc" } } } },
      bomDefinition: { include: { bom: true, items: { where: { status: "启用" }, include: { material: true } } } },
      materialRequirements: true,
    },
  });
  if (!WORK_ORDER_TRANSITIONS[workOrder.status]?.includes(status)) {
    throw new Error(`工单不允许从「${workOrder.status}」变更为「${status}」`);
  }
  if (status === "已完工") {
    const finalOperation = workOrder.operations.find((operation) => operation.isFinal) ?? workOrder.operations.at(-1);
    const goodQty = finalOperation?.goodQty ?? workOrder.batches.reduce((sum, batch) => sum + batch.goodQty, 0);
    if (!isFinalOperationComplete(goodQty, workOrder.planQty)) throw new Error(`末道工序合格数量 ${goodQty}，尚未达到计划数量 ${workOrder.planQty}`);
  }
  if (status === "已下达") {
    if (!workOrder.routeVersion || workOrder.routeVersion.status !== "已发布") throw new Error("工单必须绑定已发布的工艺路线版本后才能下达");
    if (!workOrder.bomDefinition || workOrder.bomDefinition.status !== "已发布") throw new Error("工单必须绑定已发布 BOM 版本后才能下达");
    if (workOrder.routeVersion.effectiveFrom && workOrder.planStart < workOrder.routeVersion.effectiveFrom) throw new Error("工单计划日期早于工艺版本生效日期");
    if (workOrder.routeVersion.effectiveTo && workOrder.planStart > workOrder.routeVersion.effectiveTo) throw new Error("工艺版本在工单计划日期已失效");
    if (workOrder.routeVersion.operations.length === 0) throw new Error("工艺路线没有配置工序，不能下达");
    if (workOrder.bomDefinition) {
      validateBomRouteCompatibility({ bom: workOrder.bomDefinition, route: workOrder.routeVersion, planDate: workOrder.planStart });
    }
    await prisma.$transaction(async (tx) => {
      if (workOrder.bomDefinition && workOrder.materialRequirements.length === 0) {
        const firstRouteOperation = workOrder.routeVersion!.operations[0];
        for (const item of workOrder.bomDefinition.items) {
          const standardQty = item.qtyPerBasis / item.basisQty;
          const assignedOperation = item.operationSequence == null
            ? firstRouteOperation
            : workOrder.routeVersion!.operations.find((op) => op.sequence === item.operationSequence);
          await tx.workOrderMaterialRequirement.create({
            data: {
              workOrderId: workOrder.id, bomVersionId: workOrder.bomDefinition.id, bomItemId: item.id,
              materialId: item.materialId, materialCode: item.material.code, materialName: item.material.name,
              operationSequence: item.operationSequence, operationCode: item.operationCode,
              operationName: assignedOperation?.operationName ?? null,
              standardQty, requiredQty: standardQty * workOrder.planQty * (1 + item.lossRate),
              unit: item.unit, lossRate: item.lossRate, itemType: item.itemType,
            },
          });
        }
      }
      if (workOrder.operations.length === 0) {
        for (const [index, routeOperation] of workOrder.routeVersion!.operations.entries()) {
          await tx.workOrderOperation.create({
            data: {
              workOrderId: workOrder.id,
              routeOperationId: routeOperation.id,
              operationId: routeOperation.operationId,
              operationCode: routeOperation.operationCode,
              operationName: routeOperation.operationName,
              operationType: routeOperation.operationType,
              sequence: routeOperation.sequence,
              status: index === 0 ? "可开工" : "等待前序",
              plannedQty: workOrder.planQty,
              qualityStatus: routeOperation.qualityRequired ? "待检" : "不适用",
              qualityRequired: routeOperation.qualityRequired,
              isFinal: routeOperation.isFinal,
              requiresEquipment: routeOperation.requiresEquipment,
              requiresMold: routeOperation.requiresMold,
              workCenter: routeOperation.workCenter,
              reportMode: routeOperation.reportMode,
              standardCycleSeconds: routeOperation.standardCycleSeconds,
              planEquipmentId: routeOperation.requiresEquipment ? workOrder.planEquipmentId : null,
              planMoldId: routeOperation.requiresMold ? workOrder.planMoldId : null,
            },
          });
        }
      } else {
        const firstOperation = workOrder.operations[0];
        if (firstOperation.status === "等待前序") {
          await tx.workOrderOperation.update({ where: { id: firstOperation.id }, data: { status: "可开工" } });
        }
      }
      await tx.workOrder.update({ where: { id }, data: { status: "已下达" } });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.workOrder.update({ where: { id }, data: { status } });
      if (status === "暂停") {
        await tx.workOrderOperation.updateMany({ where: { workOrderId: id, status: "生产中" }, data: { status: "暂停" } });
      } else if (status === "生产中" && workOrder.status === "暂停") {
        await tx.workOrderOperation.updateMany({ where: { workOrderId: id, status: "暂停" }, data: { status: "生产中" } });
      } else if (status === "已关闭") {
        await tx.workOrderOperation.updateMany({ where: { workOrderId: id, status: { notIn: ["已完成", "已跳过"] } }, data: { status: "已关闭" } });
      }
    });
  }
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  revalidatePath("/injection");
  revalidatePath("/stamping");
  revalidatePath("/operations");
}
