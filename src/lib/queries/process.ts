import { prisma } from "@/lib/db";

export async function getProcessManagementData() {
  const [operations, routes, skus] = await Promise.all([
    prisma.operationMaster.findMany({
      orderBy: [{ status: "asc" }, { code: "asc" }],
    }),
    prisma.processRoute.findMany({
      include: {
        sku: true,
        versions: {
          include: {
            operations: {
              include: { operation: true },
              orderBy: { sequence: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ status: "asc" }, { code: "asc" }],
    }),
    prisma.productSku.findMany({
      where: { status: "启用" },
      orderBy: { code: "asc" },
    }),
  ]);

  return {
    operations: operations.map((operation) => ({
      id: operation.id,
      code: operation.code,
      name: operation.name,
      type: operation.type,
      appliesTo: operation.appliesTo,
      workCenter: operation.workCenter,
      description: operation.description,
      status: operation.status,
    })),
    routes: routes.map((route) => ({
      id: route.id,
      code: route.code,
      name: route.name,
      skuId: route.skuId,
      sku: {
        id: route.sku.id,
        code: route.sku.code,
        name: route.sku.name,
        type: route.sku.type,
      },
      status: route.status,
      note: route.note,
      versions: route.versions.map((version) => ({
        id: version.id,
        routeId: version.routeId,
        version: version.version,
        status: version.status,
        effectiveFrom: version.effectiveFrom?.toISOString() ?? null,
        effectiveTo: version.effectiveTo?.toISOString() ?? null,
        releasedAt: version.releasedAt?.toISOString() ?? null,
        releasedBy: version.releasedBy,
        changeReason: version.changeReason,
        createdAt: version.createdAt.toISOString(),
        updatedAt: version.updatedAt.toISOString(),
        operations: version.operations.map((item) => ({
          id: item.id,
          routeVersionId: item.routeVersionId,
          operationId: item.operationId,
          sequence: item.sequence,
          operationCode: item.operationCode,
          operationName: item.operationName,
          operationType: item.operationType,
          workCenter: item.workCenter,
          standardCycleSeconds: item.standardCycleSeconds,
          setupMinutes: item.setupMinutes,
          reportMode: item.reportMode,
          requiresEquipment: item.requiresEquipment,
          requiresMold: item.requiresMold,
          qualityRequired: item.qualityRequired,
          isFinal: item.isFinal,
          status: item.status,
          note: item.note,
        })),
      })),
    })),
    skus: skus.map((sku) => ({
      id: sku.id,
      code: sku.code,
      name: sku.name,
      type: sku.type,
    })),
  };
}

export type ProcessManagementData = Awaited<ReturnType<typeof getProcessManagementData>>;
