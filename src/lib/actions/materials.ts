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
    include: { sku: true, stockIns: true, workOrderOperation: true },
  });
  if (batch.status !== "已完工") throw new Error("只有已完成并放行的生产批次可以入库");
  if (batch.workOrderOperation && !batch.workOrderOperation.isFinal) throw new Error("中间工序产出属于在制品，请通过工序转序流转，不可直接办理成品入库");

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

export async function updateMaterialLot(input: {
  id: string; supplierLot?: string; supplier?: string; inspectStatus: string; stockStatus: string; warehouse?: string;
}) {
  const lot = await prisma.materialLot.findUniqueOrThrow({ where: { id: input.id } });
  if (!["待检", "合格", "不合格", "让步接收"].includes(input.inspectStatus)) throw new Error("无效的检验状态");
  if (!["可用", "冻结", "隔离", "已消耗"].includes(input.stockStatus)) throw new Error("无效的库存状态");
  if (input.stockStatus === "已消耗" && lot.remainingQty > 0) throw new Error("仍有剩余数量的批次不可标记为已消耗");
  await prisma.materialLot.update({
    where: { id: input.id },
    data: {
      supplierLot: input.supplierLot?.trim() || null, supplier: input.supplier?.trim() || null,
      inspectStatus: input.inspectStatus, stockStatus: input.stockStatus, warehouse: input.warehouse?.trim() || null,
    },
  });
  for (const path of ["/materials", "/injection", "/stamping", "/trace"]) revalidatePath(path);
}

export async function deleteMaterialLot(id: string) {
  const lot = await prisma.materialLot.findUniqueOrThrow({
    where: { id }, include: { _count: { select: { issues: true, returns: true, batches: true, batchConsumptions: true } } },
  });
  if (Object.values(lot._count).some((count) => count > 0)) throw new Error("该物料批次已有领退料或生产记录，不可删除");
  await prisma.materialLot.delete({ where: { id } });
  revalidatePath("/materials");
  revalidatePath("/injection");
  revalidatePath("/stamping");
}

export async function deleteStockInRecord(id: string) {
  await prisma.stockInRecord.delete({ where: { id } });
  for (const path of ["/materials", "/injection", "/stamping", "/report", "/trace"]) revalidatePath(path);
}

export async function updateStockInRecord(input: { id: string; qty: number; warehouse: string; inBy: string }) {
  if (!Number.isInteger(input.qty) || input.qty <= 0) throw new Error("数量必须是正整数");
  const record = await prisma.stockInRecord.findUniqueOrThrow({
    where: { id: input.id }, include: { batch: { include: { stockIns: true } } },
  });
  const limit = record.type === "不良品隔离" ? record.batch.badQty : record.batch.goodQty;
  const usedByOthers = record.batch.stockIns
    .filter((item) => item.id !== record.id && (record.type === "不良品隔离" ? item.type === "不良品隔离" : item.type !== "不良品隔离"))
    .reduce((sum, item) => sum + item.qty, 0);
  if (usedByOthers + input.qty > limit) throw new Error(`修改后数量超过该批次可登记上限 ${limit}`);
  await prisma.stockInRecord.update({
    where: { id: input.id },
    data: { qty: input.qty, warehouse: input.warehouse.trim(), inBy: input.inBy.trim() },
  });
  for (const path of ["/materials", "/injection", "/stamping", "/report", "/trace"]) revalidatePath(path);
}
