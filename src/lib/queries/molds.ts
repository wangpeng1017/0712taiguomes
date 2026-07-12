import { prisma } from "@/lib/db";

export async function getMoldsWithHistory() {
  const molds = await prisma.moldMaster.findMany({
    include: {
      applicableSku: true,
      applicableEquipment: true,
      batches: {
        include: { workOrder: true, sku: true },
        orderBy: { startTime: "desc" },
        take: 20,
      },
      maintenance: { orderBy: { startTime: "desc" } },
    },
    orderBy: { code: "asc" },
  });
  return molds;
}
