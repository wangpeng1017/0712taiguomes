import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const MATERIAL_BY_SKU_CODE: Record<string, string> = {
  "INJ-CN-001": "MAT-PA66GF30",
  "INJ-CN-002": "MAT-PBT-NAT",
  "INJ-CN-003": "MAT-PA6-BLK",
  "STP-CN-001": "MAT-SPCC12",
  "STP-CN-002": "MAT-SUS30403",
  "STP-CN-003": "MAT-AL505210",
};

function normalize(value?: string | null) {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function inferMaterial<T extends { code: string; name: string; type: string; materialGrade: string | null; spec: string | null }>(
  sku: { code: string; spec: string | null; type: string },
  materials: T[],
) {
  const knownCode = MATERIAL_BY_SKU_CODE[sku.code];
  if (knownCode) return materials.find((material) => material.code === knownCode);

  const skuSpec = normalize(sku.spec);
  const compatibleTypes = sku.type === "注塑" ? ["塑料颗粒", "辅料"] : sku.type === "冲压" ? ["金属卷材", "辅料"] : [];
  return materials.find((material) => {
    const grade = normalize(material.materialGrade);
    const code = normalize(material.code.replace(/^MAT-/i, ""));
    const name = normalize(material.name);
    return Boolean(skuSpec && ((grade && skuSpec.includes(grade)) || (code && skuSpec.includes(code)) || (name && skuSpec.includes(name))))
      && (!compatibleTypes.length || compatibleTypes.includes(material.type));
  });
}

async function main() {
  const [skus, materials] = await Promise.all([
    prisma.productSku.findMany({ where: { status: "启用" }, orderBy: { code: "asc" } }),
    prisma.materialMaster.findMany({ where: { status: "启用" }, orderBy: { code: "asc" } }),
  ]);

  let bomCount = 0;
  let requirementCount = 0;
  let linkedConsumptionCount = 0;
  const skipped: string[] = [];

  for (const sku of skus) {
    const material = inferMaterial(sku, materials);
    if (!material || !sku.stdWeight || sku.stdWeight <= 0) {
      skipped.push(`${sku.code}：未找到可信主料或标准重量`);
      continue;
    }

    const routeVersion = await prisma.processRouteVersion.findFirst({
      where: { route: { skuId: sku.id }, status: "已发布" },
      include: { operations: { where: { status: "启用" }, orderBy: { sequence: "asc" }, take: 1 } },
      orderBy: { effectiveFrom: "desc" },
    });
    const firstOperation = routeVersion?.operations[0];
    const bomCode = `BOM-${sku.code}`;
    const bom = await prisma.bomMaster.upsert({
      where: { code: bomCode },
      update: { name: `${sku.name}标准BOM`, skuId: sku.id, status: "启用" },
      create: { code: bomCode, name: `${sku.name}标准BOM`, skuId: sku.id, status: "启用", note: "标准BOM初始化脚本生成" },
    });
    const version = await prisma.bomVersion.upsert({
      where: { bomId_version: { bomId: bom.id, version: "V1.0" } },
      update: {},
      create: {
        bomId: bom.id,
        version: "V1.0",
        status: "已发布",
        effectiveFrom: new Date(),
        releasedAt: new Date(),
        releasedBy: "系统初始化",
        changeReason: "从现有产品、物料和工艺数据建立受控BOM基线",
      },
    });
    let item = await prisma.bomItem.findFirst({
      where: { bomVersionId: version.id, materialId: material.id, operationSequence: firstOperation?.sequence ?? 10 },
    });
    if (!item) {
      item = await prisma.bomItem.create({
        data: {
          bomVersionId: version.id,
          materialId: material.id,
          operationSequence: firstOperation?.sequence ?? 10,
          operationCode: firstOperation?.operationCode ?? (sku.type === "注塑" ? "OP-INJ" : "OP-STP"),
          qtyPerBasis: sku.stdWeight,
          basisQty: 1000,
          unit: material.unit,
          lossRate: sku.type === "注塑" ? 0.03 : 0.1,
          itemType: "主料",
          note: "按产品标准重量折算：克/件 = 千克/千件",
        },
      });
    }
    bomCount += 1;

    const workOrders = await prisma.workOrder.findMany({ where: { skuId: sku.id } });
    for (const workOrder of workOrders) {
      if (!workOrder.bomVersionId) {
        await prisma.workOrder.update({
          where: { id: workOrder.id },
          data: { bomVersionId: version.id, bomVersion: workOrder.bomVersion ?? version.version },
        });
      }

      let requirement = await prisma.workOrderMaterialRequirement.findFirst({
        where: { workOrderId: workOrder.id, bomItemId: item.id },
      });
      if (!requirement) {
        const standardQty = (item.qtyPerBasis * workOrder.planQty) / item.basisQty;
        const operationName = item.operationCode
          ? (await prisma.operationMaster.findUnique({ where: { code: item.operationCode } }))?.name
          : null;
        requirement = await prisma.workOrderMaterialRequirement.create({
          data: {
            workOrderId: workOrder.id,
            bomVersionId: version.id,
            bomItemId: item.id,
            materialId: material.id,
            materialCode: material.code,
            materialName: material.name,
            operationSequence: item.operationSequence,
            operationCode: item.operationCode,
            operationName,
            standardQty,
            requiredQty: standardQty * (1 + item.lossRate),
            unit: item.unit,
            lossRate: item.lossRate,
            itemType: item.itemType,
          },
        });
        requirementCount += 1;
      }

      const [issued, consumptions] = await Promise.all([
        prisma.materialIssue.aggregate({
          where: { workOrderId: workOrder.id, materialLot: { materialId: material.id } },
          _sum: { qty: true },
        }),
        prisma.batchMaterialConsumption.findMany({
          where: { batch: { workOrderId: workOrder.id }, materialLot: { materialId: material.id } },
          select: { id: true, qty: true, workOrderMaterialRequirementId: true },
        }),
      ]);
      await prisma.workOrderMaterialRequirement.update({
        where: { id: requirement.id },
        data: {
          issuedQty: issued._sum.qty ?? 0,
          consumedQty: consumptions.reduce((sum, consumption) => sum + consumption.qty, 0),
        },
      });
      const unlinkedIds = consumptions.filter((consumption) => !consumption.workOrderMaterialRequirementId).map((consumption) => consumption.id);
      if (unlinkedIds.length) {
        const result = await prisma.batchMaterialConsumption.updateMany({
          where: { id: { in: unlinkedIds } },
          data: { workOrderMaterialRequirementId: requirement.id, isSubstitute: false },
        });
        linkedConsumptionCount += result.count;
      }
    }
  }

  console.log(`受控BOM初始化完成：BOM ${bomCount}，新增工单需求 ${requirementCount}，关联历史消耗 ${linkedConsumptionCount}`);
  if (skipped.length) console.warn(`跳过 ${skipped.length} 个产品：\n- ${skipped.join("\n- ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
