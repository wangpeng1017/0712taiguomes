import { prisma } from "@/lib/db";

export async function getMaterialLots() {
  return prisma.materialLot.findMany({ include: { material: true }, orderBy: { inDate: "desc" } });
}

export async function getMaterialIssues() {
  return prisma.materialIssue.findMany({
    include: { workOrder: true, materialLot: { include: { material: true } }, equipment: true },
    orderBy: { issuedAt: "desc" },
  });
}

export async function getMaterialReturns() {
  return prisma.materialReturn.findMany({
    include: { workOrder: true, materialLot: { include: { material: true } } },
    orderBy: { returnedAt: "desc" },
  });
}

export async function getStockInData() {
  const [batches, stockIns] = await Promise.all([
    prisma.productionBatch.findMany({
      where: { status: "已完工", OR: [{ goodQty: { gt: 0 } }, { badQty: { gt: 0 } }] },
      include: { sku: true, workOrder: true, stockIns: true },
      orderBy: { startTime: "desc" },
    }),
    prisma.stockInRecord.findMany({
      include: { batch: { include: { sku: true, workOrder: true } } },
      orderBy: { inAt: "desc" },
    }),
  ]);

  const pending = batches
    .map((batch) => {
      const goodIn = batch.stockIns.filter((record) => record.type !== "不良品隔离").reduce((sum, record) => sum + record.qty, 0);
      const badIsolated = batch.stockIns.filter((record) => record.type === "不良品隔离").reduce((sum, record) => sum + record.qty, 0);
      return { ...batch, remainingGoodQty: Math.max(batch.goodQty - goodIn, 0), remainingBadQty: Math.max(batch.badQty - badIsolated, 0) };
    })
    .filter((batch) => batch.remainingGoodQty > 0 || batch.remainingBadQty > 0);
  return { pending, stockIns };
}

export async function getMaterialMasters() {
  return prisma.materialMaster.findMany({ where: { status: "启用" }, orderBy: { code: "asc" } });
}
