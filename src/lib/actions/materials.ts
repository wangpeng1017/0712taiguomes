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
  if (!Number.isFinite(input.qty) || input.qty <= 0) throw new Error("入库数量必须大于 0");
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
  if (!Number.isInteger(input.qty) || input.qty <= 0) throw new Error("入库数量必须是正整数");
  if (!input.warehouse.trim() || !input.inBy.trim()) throw new Error("仓库和入库人不能为空");
  const batch = await prisma.productionBatch.findUniqueOrThrow({
    where: { id: input.batchId },
    include: { sku: true, stockIns: true },
  });

  const alreadyIn = batch.stockIns.filter((r) => r.type !== "不良品隔离").reduce((s, r) => s + r.qty, 0);
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

export async function createDefectIsolation(input: { batchId: string; qty: number; warehouse: string; inBy: string }) {
  if (!Number.isInteger(input.qty) || input.qty <= 0) throw new Error("隔离数量必须是正整数");
  if (!input.warehouse.trim() || !input.inBy.trim()) throw new Error("隔离库位和登记人不能为空");
  const batch = await prisma.productionBatch.findUniqueOrThrow({
    where: { id: input.batchId },
    include: { stockIns: true },
  });
  const alreadyIsolated = batch.stockIns
    .filter((record) => record.type === "不良品隔离")
    .reduce((sum, record) => sum + record.qty, 0);
  if (alreadyIsolated + input.qty > batch.badQty) {
    throw new Error(`隔离数量不可超过该批次不良数量（不良 ${batch.badQty}，已隔离 ${alreadyIsolated}）`);
  }
  const no = `QI-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 900 + 100)}`;
  await prisma.stockInRecord.create({
    data: { no, batchId: input.batchId, type: "不良品隔离", qty: input.qty, warehouse: input.warehouse.trim(), inBy: input.inBy.trim() },
  });
  revalidatePath("/materials");
  revalidatePath("/report");
  revalidatePath("/trace");
}
