"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { WORK_ORDER_STATUS, WORK_ORDER_TRANSITIONS } from "@/lib/constants";

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
  route?: string;
  note?: string;
}) {
  const sku = await prisma.productSku.findUniqueOrThrow({ where: { id: input.skuId } });
  if (sku.status !== "启用" || !["注塑", "冲压"].includes(sku.type)) throw new Error("所选产品不可用于生产工单");
  if (!Number.isInteger(input.planQty) || input.planQty <= 0) throw new Error("计划数量必须是正整数");
  const planStart = new Date(input.planStart);
  const planEnd = new Date(input.planEnd);
  if (!Number.isFinite(planStart.getTime()) || !Number.isFinite(planEnd.getTime()) || planEnd < planStart) {
    throw new Error("计划结束日期不可早于开始日期");
  }

  const [equipment, mold] = await Promise.all([
    input.planEquipmentId ? prisma.equipmentMaster.findUniqueOrThrow({ where: { id: input.planEquipmentId } }) : null,
    input.planMoldId ? prisma.moldMaster.findUniqueOrThrow({ where: { id: input.planMoldId } }) : null,
  ]);
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
      bomVersion: input.bomVersion || "V1.0",
      route: input.route || "标准工艺",
      note: input.note || null,
      status: "未下达",
    },
  });
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
}

export async function setWorkOrderStatus(id: string, status: string) {
  if (!(WORK_ORDER_STATUS as readonly string[]).includes(status)) throw new Error("无效的工单状态");
  const workOrder = await prisma.workOrder.findUniqueOrThrow({
    where: { id },
    include: { batches: { where: { status: "已完工" }, select: { goodQty: true } } },
  });
  if (!WORK_ORDER_TRANSITIONS[workOrder.status]?.includes(status)) {
    throw new Error(`工单不允许从「${workOrder.status}」变更为「${status}」`);
  }
  if (status === "已完工") {
    const goodQty = workOrder.batches.reduce((sum, batch) => sum + batch.goodQty, 0);
    if (goodQty < workOrder.planQty) throw new Error(`累计良品 ${goodQty}，尚未达到计划数量 ${workOrder.planQty}`);
  }
  await prisma.workOrder.update({ where: { id }, data: { status } });
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  revalidatePath("/injection");
  revalidatePath("/stamping");
}
