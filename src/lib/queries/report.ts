import { prisma } from "@/lib/db";

export async function getReportData() {
  const batches = await prisma.productionBatch.findMany({
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
  });
  return batches;
}
