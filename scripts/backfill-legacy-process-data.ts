import { prisma } from "../src/lib/db";

function legacyOperationCode(type: string) {
  return type === "冲压" ? "OP-LEGACY-STP" : "OP-LEGACY-INJ";
}

function legacyOperationName(type: string) {
  return type === "冲压" ? "历史冲压成型" : "历史注塑成型";
}

function legacyRouteCode(skuCode: string) {
  return `LEG-${skuCode}`.slice(0, 180);
}

async function main() {
  const workOrders = await prisma.workOrder.findMany({
    where: { routeVersionId: null },
    include: {
      sku: true,
      batches: {
        where: { status: { not: "已作废" } },
        include: { materialLot: true, materialConsumptions: true },
      },
    },
  });

  let mappedOrders = 0;
  let mappedBatches = 0;
  for (const workOrder of workOrders) {
    const operation = await prisma.operationMaster.upsert({
      where: { code: legacyOperationCode(workOrder.type) },
      update: {},
      create: {
        code: legacyOperationCode(workOrder.type),
        name: legacyOperationName(workOrder.type),
        type: "生产",
        appliesTo: workOrder.type,
        workCenter: workOrder.type === "冲压" ? "冲压车间" : "注塑车间",
        description: "由历史数据兼容迁移生成，仅用于保留上线前生产履历",
        status: "停用",
      },
    });
    const route = await prisma.processRoute.upsert({
      where: { code: legacyRouteCode(workOrder.sku.code) },
      update: {},
      create: {
        code: legacyRouteCode(workOrder.sku.code),
        name: `${workOrder.sku.name}历史兼容路线`,
        skuId: workOrder.skuId,
        status: "停用",
        note: "由历史数据兼容迁移自动生成",
      },
    });
    const routeVersion = await prisma.processRouteVersion.upsert({
      where: { routeId_version: { routeId: route.id, version: "V0.9-LEGACY" } },
      update: {},
      create: {
        routeId: route.id,
        version: "V0.9-LEGACY",
        status: "已停用",
        effectiveFrom: workOrder.planStart,
        releasedAt: new Date(),
        releasedBy: "SYSTEM-MIGRATION",
        changeReason: "上线前历史工单兼容迁移",
      },
    });
    const routeOperation = await prisma.routeOperation.upsert({
      where: { routeVersionId_sequence: { routeVersionId: routeVersion.id, sequence: 10 } },
      update: {},
      create: {
        routeVersionId: routeVersion.id,
        operationId: operation.id,
        sequence: 10,
        operationCode: operation.code,
        operationName: operation.name,
        operationType: operation.type,
        workCenter: operation.workCenter,
        reportMode: "按批次",
        requiresEquipment: true,
        requiresMold: true,
        qualityRequired: false,
        isFinal: true,
      },
    });
    await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: { routeVersionId: routeVersion.id, route: `${route.name} ${routeVersion.version}` },
    });
    mappedOrders += 1;

    if (workOrder.status === "未下达") continue;
    const goodQty = workOrder.batches.reduce((sum, batch) => sum + batch.goodQty, 0);
    const badQty = workOrder.batches.reduce((sum, batch) => sum + batch.badQty, 0);
    const status = workOrder.status === "已下达" && workOrder.batches.length === 0
      ? "可开工"
      : workOrder.status === "暂停"
        ? "暂停"
        : ["已完工", "已关闭"].includes(workOrder.status)
          ? "已完成"
          : "生产中";
    const workOrderOperation = await prisma.workOrderOperation.upsert({
      where: { workOrderId_sequence: { workOrderId: workOrder.id, sequence: 10 } },
      update: {},
      create: {
        workOrderId: workOrder.id,
        routeOperationId: routeOperation.id,
        operationId: operation.id,
        operationCode: operation.code,
        operationName: operation.name,
        operationType: operation.type,
        sequence: 10,
        status,
        plannedQty: workOrder.planQty,
        inputQty: goodQty + badQty,
        goodQty,
        badQty,
        qualityStatus: "不适用",
        isFinal: true,
        requiresEquipment: true,
        requiresMold: true,
        qualityRequired: false,
        reportMode: "按批次",
        workCenter: operation.workCenter,
        planEquipmentId: workOrder.planEquipmentId,
        planMoldId: workOrder.planMoldId,
        startedAt: workOrder.batches.at(-1)?.startTime,
        completedAt: status === "已完成" ? workOrder.batches[0]?.endTime : null,
      },
    });

    for (const batch of workOrder.batches) {
      await prisma.productionBatch.update({ where: { id: batch.id }, data: { workOrderOperationId: workOrderOperation.id } });
      if (batch.materialLotId && batch.materialLot && batch.materialConsumptions.length === 0) {
        const consumedQty = Math.max((batch.issuedWeight ?? 0) - (batch.returnWeight ?? 0), 0);
        if (consumedQty > 0) {
          await prisma.batchMaterialConsumption.create({
            data: {
              batchId: batch.id,
              materialLotId: batch.materialLotId,
              qty: consumedQty,
              unit: batch.materialLot.unit,
              consumptionType: "主料",
            },
          });
        }
      }
      mappedBatches += 1;
    }
  }
  console.log(`历史工艺数据兼容完成：工单 ${mappedOrders}，生产批次 ${mappedBatches}`);
}

main().finally(() => prisma.$disconnect());
