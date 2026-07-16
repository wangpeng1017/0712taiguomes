import { prisma } from "@/lib/db";
import { totalQty, workOrderCompletionRate } from "@/lib/production-calc";

export async function getWorkOrdersWithProgress() {
  const workOrders = await prisma.workOrder.findMany({
    include: {
      sku: true,
      planEquipment: true,
      planMold: true,
      routeVersion: { include: { route: true } },
      bomDefinition: { include: { bom: true } },
      materialRequirements: { orderBy: [{ operationSequence: "asc" }, { materialCode: "asc" }] },
      operations: { orderBy: { sequence: "asc" } },
      batches: { where: { status: "已完工" }, select: { goodQty: true, badQty: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return workOrders.map((wo) => {
    const finalOperation = wo.operations.find((operation) => operation.isFinal) ?? wo.operations.at(-1);
    const goodQty = finalOperation?.goodQty ?? wo.batches.reduce((s, b) => s + b.goodQty, 0);
    const badQty = wo.operations.length
      ? wo.operations.reduce((sum, operation) => sum + operation.badQty, 0)
      : wo.batches.reduce((s, b) => s + b.badQty, 0);
    const produced = finalOperation ? totalQty(finalOperation.goodQty, finalOperation.badQty) : totalQty(goodQty, badQty);
    return {
      ...wo,
      goodQty,
      badQty,
      produced,
      completionRate: workOrderCompletionRate(goodQty, wo.planQty),
      batchCount: wo.batches.length,
    };
  });
}

export async function getWorkOrderFormOptions() {
  const [skus, equipments, molds, routeVersions, bomVersions] = await Promise.all([
    prisma.productSku.findMany({ where: { status: "启用" }, orderBy: { code: "asc" } }),
    prisma.equipmentMaster.findMany({ orderBy: { code: "asc" } }),
    prisma.moldMaster.findMany({ orderBy: { code: "asc" } }),
    prisma.processRouteVersion.findMany({
      where: { status: "已发布", route: { status: "启用" } },
      include: { route: { include: { sku: true } }, operations: { orderBy: { sequence: "asc" } } },
      orderBy: [{ route: { code: "asc" } }, { version: "desc" }],
    }),
    prisma.bomVersion.findMany({ where: { status: "已发布", bom: { status: "启用" } }, include: { bom: true, items: { where: { status: "启用" }, include: { material: true } } }, orderBy: [{ bom: { code: "asc" } }, { version: "desc" }] }),
  ]);
  return { skus, equipments, molds, routeVersions, bomVersions };
}
