import { prisma } from "@/lib/db";

export async function getBomManagementData() {
  const [boms, skus, materials, operations] = await Promise.all([
    prisma.bomMaster.findMany({
      include: {
        sku: true,
        versions: {
          include: {
            items: {
              include: {
                material: true,
                substitutes: { include: { material: true }, orderBy: [{ priority: "asc" }, { createdAt: "asc" }] },
              },
              orderBy: [{ operationSequence: "asc" }, { createdAt: "asc" }],
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: [{ status: "asc" }, { code: "asc" }],
    }),
    prisma.productSku.findMany({ where: { status: "启用" }, orderBy: { code: "asc" } }),
    prisma.materialMaster.findMany({ where: { status: "启用" }, orderBy: { code: "asc" } }),
    prisma.operationMaster.findMany({ where: { status: "启用" }, orderBy: { code: "asc" } }),
  ]);

  return {
    boms: boms.map((bom) => ({
      id: bom.id,
      code: bom.code,
      name: bom.name,
      skuId: bom.skuId,
      sku: { id: bom.sku.id, code: bom.sku.code, name: bom.sku.name, type: bom.sku.type },
      status: bom.status,
      note: bom.note,
      versions: bom.versions.map((version) => ({
        id: version.id,
        bomId: version.bomId,
        version: version.version,
        status: version.status,
        effectiveFrom: version.effectiveFrom?.toISOString() ?? null,
        effectiveTo: version.effectiveTo?.toISOString() ?? null,
        releasedAt: version.releasedAt?.toISOString() ?? null,
        releasedBy: version.releasedBy,
        changeReason: version.changeReason,
        createdAt: version.createdAt.toISOString(),
        updatedAt: version.updatedAt.toISOString(),
        items: version.items.map((item) => ({
          id: item.id,
          bomVersionId: item.bomVersionId,
          materialId: item.materialId,
          material: { id: item.material.id, code: item.material.code, name: item.material.name, type: item.material.type, unit: item.material.unit },
          operationSequence: item.operationSequence,
          operationCode: item.operationCode,
          qtyPerBasis: item.qtyPerBasis,
          basisQty: item.basisQty,
          unit: item.unit,
          lossRate: item.lossRate,
          itemType: item.itemType,
          status: item.status,
          note: item.note,
          substitutes: item.substitutes.map((substitute) => ({
            id: substitute.id,
            bomItemId: substitute.bomItemId,
            materialId: substitute.materialId,
            material: { id: substitute.material.id, code: substitute.material.code, name: substitute.material.name, type: substitute.material.type, unit: substitute.material.unit },
            priority: substitute.priority,
            conversionRate: substitute.conversionRate,
            status: substitute.status,
            effectiveFrom: substitute.effectiveFrom?.toISOString() ?? null,
            effectiveTo: substitute.effectiveTo?.toISOString() ?? null,
            reason: substitute.reason,
            note: substitute.note,
          })),
        })),
      })),
    })),
    skus: skus.map((sku) => ({ id: sku.id, code: sku.code, name: sku.name, type: sku.type })),
    materials: materials.map((material) => ({
      id: material.id,
      code: material.code,
      name: material.name,
      type: material.type,
      unit: material.unit,
    })),
    operations: operations.map((operation) => ({
      id: operation.id,
      code: operation.code,
      name: operation.name,
      type: operation.type,
    })),
  };
}

export type BomManagementData = Awaited<ReturnType<typeof getBomManagementData>>;
