import { prisma } from "@/lib/db";

export async function getTraceData() {
  const [batches, materialLots, molds] = await Promise.all([
    prisma.productionBatch.findMany({
      include: {
        workOrder: true,
        sku: true,
        equipment: true,
        mold: true,
        materialLot: { include: { material: true } },
        defects: { include: { reason: true } },
        stockIns: true,
      },
      orderBy: { startTime: "desc" },
    }),
    prisma.materialLot.findMany({ include: { material: true }, orderBy: { lotNo: "asc" } }),
    prisma.moldMaster.findMany({ include: { maintenance: { orderBy: { startTime: "desc" } } }, orderBy: { code: "asc" } }),
  ]);

  return { batches, materialLots, molds };
}
