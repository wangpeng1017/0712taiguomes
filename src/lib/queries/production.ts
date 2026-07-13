import { prisma } from "@/lib/db";

export async function getReportFormOptions(type: "注塑" | "冲压") {
  const equipType = type === "注塑" ? "注塑机" : "冲床";
  const moldType = type === "注塑" ? "注塑模" : "冲压模";
  const materialType = type === "注塑" ? "塑料颗粒" : "金属卷材";

  const [workOrders, equipments, molds, materialLots, defectReasons] = await Promise.all([
    prisma.workOrder.findMany({
      where: { type, status: { in: ["已下达", "生产中"] } },
      include: { sku: true },
      orderBy: { no: "asc" },
    }),
    prisma.equipmentMaster.findMany({ where: { type: equipType }, orderBy: { code: "asc" } }),
    prisma.moldMaster.findMany({ where: { type: moldType }, orderBy: { code: "asc" } }),
    prisma.materialLot.findMany({
      where: { material: { type: materialType }, inspectStatus: "合格", stockStatus: "可用" },
      include: { material: true },
      orderBy: { lotNo: "asc" },
    }),
    prisma.defectReason.findMany({ where: { appliesTo: { in: [type, "通用"] }, status: "启用" }, orderBy: { reason: "asc" } }),
  ]);

  return { workOrders, equipments, molds, materialLots, defectReasons };
}

export async function getRecentBatches(type: "注塑" | "冲压", take = 8) {
  return prisma.productionBatch.findMany({
    where: { type },
    include: { workOrder: true, sku: true, equipment: true, mold: true },
    orderBy: { startTime: "desc" },
    take,
  });
}
