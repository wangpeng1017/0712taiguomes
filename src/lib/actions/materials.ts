"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function receiveMaterialLot(input: {
  materialId: string;
  qty: number;
  supplierLot?: string;
  supplier?: string;
  warehouse?: string;
  inspectStatus: string;
}) {
  const material = await prisma.materialMaster.findUniqueOrThrow({ where: { id: input.materialId } });
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const seq = await prisma.materialLot.count({ where: { lotNo: { startsWith: `LOT-${material.code.replace("MAT-", "")}-${stamp}` } } });
  const lotNo = `LOT-${material.code.replace("MAT-", "")}-${stamp}-${String(seq + 1).padStart(2, "0")}`;

  await prisma.materialLot.create({
    data: {
      lotNo,
      materialId: input.materialId,
      qty: input.qty,
      remainingQty: input.qty,
      unit: material.unit,
      inDate: new Date(),
      supplier: input.supplier || material.supplier,
      supplierLot: input.supplierLot,
      inspectStatus: input.inspectStatus,
      stockStatus: input.inspectStatus === "合格" || input.inspectStatus === "让步接收" ? "可用" : "冻结",
      warehouse: input.warehouse,
    },
  });

  revalidatePath("/materials");
  revalidatePath("/injection");
  revalidatePath("/stamping");
  revalidatePath("/master-data");
}

export async function createStockIn(input: { batchId: string; qty: number; warehouse: string; inBy: string }) {
  const batch = await prisma.productionBatch.findUniqueOrThrow({
    where: { id: input.batchId },
    include: { sku: true, stockIns: true },
  });

  const alreadyIn = batch.stockIns.reduce((s, r) => s + r.qty, 0);
  if (alreadyIn + input.qty > batch.goodQty) {
    throw new Error(`入库数量不可超过该批次良品数量（良品 ${batch.goodQty}，已入库 ${alreadyIn}）`);
  }

  const no = `SI-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 900 + 100)}`;
  await prisma.stockInRecord.create({
    data: {
      no,
      batchId: input.batchId,
      type: batch.sku.isFinished ? "成品" : "半成品",
      qty: input.qty,
      warehouse: input.warehouse,
      inBy: input.inBy,
      inAt: new Date(),
    },
  });

  revalidatePath("/materials");
  revalidatePath("/report");
  revalidatePath("/trace");
}
