import { prisma } from "@/lib/db";

export async function getOperationExecutionData() {
  const [operations, equipments, molds, materialLots, defectReasons, routeVersions, reworkOrders] = await Promise.all([
    prisma.workOrderOperation.findMany({
      include: {
        workOrder: { include: { sku: true, routeVersion: { include: { route: true } } } },
        planEquipment: true,
        planMold: true,
        batches: {
          where: { status: { not: "已作废" } },
          include: {
            equipment: true,
            mold: true,
            materialConsumptions: { include: { materialLot: { include: { material: true } }, sourceBatch: true } },
            qualityResults: true,
          },
          orderBy: { startTime: "desc" },
        },
      },
      orderBy: [{ workOrder: { no: "asc" } }, { sequence: "asc" }],
    }),
    prisma.equipmentMaster.findMany({ orderBy: { code: "asc" } }),
    prisma.moldMaster.findMany({ orderBy: { code: "asc" } }),
    prisma.materialLot.findMany({
      where: { inspectStatus: { in: ["合格", "让步接收"] }, stockStatus: "可用", remainingQty: { gt: 0 } },
      include: { material: true },
      orderBy: { lotNo: "asc" },
    }),
    prisma.defectReason.findMany({ where: { status: "启用" }, orderBy: { reason: "asc" } }),
    prisma.processRouteVersion.findMany({ where: { status: "已发布" }, include: { route: true }, orderBy: { version: "desc" } }),
    prisma.reworkOrder.findMany({
      include: { sourceBatch: true, workOrderOperation: { include: { workOrder: true } }, routeVersion: { include: { route: true } }, resultBatch: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const completedBatches = await prisma.productionBatch.findMany({
    where: { status: "已完工", goodQty: { gt: 0 }, workOrderOperationId: { not: null } },
    include: { workOrderOperation: true, genealogySources: true },
    orderBy: { startTime: "desc" },
  });

  return { operations, equipments, molds, materialLots, defectReasons, routeVersions, reworkOrders, completedBatches };
}

export async function getQualityExecutionData() {
  const [pendingBatches, qualityResults, reworkOrders, routeVersions] = await Promise.all([
    prisma.productionBatch.findMany({
      where: { status: { in: ["待检", "质量冻结"] }, workOrderOperationId: { not: null } },
      include: {
        sku: true,
        workOrder: true,
        equipment: true,
        mold: true,
        defects: { include: { reason: true } },
        workOrderOperation: true,
      },
      orderBy: { startTime: "desc" },
    }),
    prisma.operationQualityResult.findMany({
      include: { batch: true, workOrderOperation: { include: { workOrder: true } } },
      orderBy: { inspectedAt: "desc" },
    }),
    prisma.reworkOrder.findMany({
      include: { sourceBatch: true, workOrderOperation: { include: { workOrder: true } }, routeVersion: { include: { route: true } }, resultBatch: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.processRouteVersion.findMany({ where: { status: "已发布" }, include: { route: true }, orderBy: { version: "desc" } }),
  ]);
  return { pendingBatches, qualityResults, reworkOrders, routeVersions };
}
