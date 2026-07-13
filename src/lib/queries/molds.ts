import { prisma } from "@/lib/db";

export async function getMoldsWithHistory() {
  const molds = await prisma.moldMaster.findMany({
    include: {
      applicableSku: true,
      applicableEquipment: true,
      batches: {
        where: { status: "已完工" },
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

export async function getMoldFormOptions() {
  const [skus, equipments] = await Promise.all([
    prisma.productSku.findMany({ where: { status: "启用", type: { in: ["注塑", "冲压"] } }, orderBy: { code: "asc" } }),
    prisma.equipmentMaster.findMany({ orderBy: { code: "asc" } }),
  ]);
  return { skus, equipments };
}
