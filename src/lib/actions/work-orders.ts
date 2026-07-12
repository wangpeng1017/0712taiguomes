"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

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
  await prisma.workOrder.create({
    data: {
      no: nextWorkOrderNo(),
      skuId: input.skuId,
      type: sku.type,
      planQty: input.planQty,
      planStart: new Date(input.planStart),
      planEnd: new Date(input.planEnd),
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
  await prisma.workOrder.update({ where: { id }, data: { status } });
  revalidatePath("/work-orders");
  revalidatePath("/dashboard");
  revalidatePath("/injection");
  revalidatePath("/stamping");
}
