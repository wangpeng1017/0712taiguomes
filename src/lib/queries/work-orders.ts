import { prisma } from "@/lib/db";
import { totalQty } from "@/lib/production-calc";

export async function getWorkOrdersWithProgress() {
  const workOrders = await prisma.workOrder.findMany({
    include: {
      sku: true,
      planEquipment: true,
      planMold: true,
      batches: { select: { goodQty: true, badQty: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return workOrders.map((wo) => {
    const goodQty = wo.batches.reduce((s, b) => s + b.goodQty, 0);
    const badQty = wo.batches.reduce((s, b) => s + b.badQty, 0);
    const produced = totalQty(goodQty, badQty);
    return {
      ...wo,
      goodQty,
      badQty,
      produced,
      completionRate: wo.planQty > 0 ? goodQty / wo.planQty : 0,
      batchCount: wo.batches.length,
    };
  });
}

export async function getWorkOrderFormOptions() {
  const [skus, equipments, molds] = await Promise.all([
    prisma.productSku.findMany({ where: { status: "启用" }, orderBy: { code: "asc" } }),
    prisma.equipmentMaster.findMany({ orderBy: { code: "asc" } }),
    prisma.moldMaster.findMany({ orderBy: { code: "asc" } }),
  ]);
  return { skus, equipments, molds };
}
