import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { createStockIn } from "../src/lib/actions/materials";
import { createReworkOrder, recordOperationQuality, submitOperationReport } from "../src/lib/actions/operations";
import { createWorkOrder, setWorkOrderStatus } from "../src/lib/actions/work-orders";

async function runAction(action: () => Promise<unknown>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof Error && error.message.includes("static generation store missing")) return undefined;
    throw error;
  }
}

async function main() {
  const marker = `PROCESS-SMOKE-${Date.now()}`;
  const version = await prisma.processRouteVersion.findFirstOrThrow({
    where: { status: "已发布", route: { code: "RT-INJ-CN-001" } },
    include: { route: true },
  });
  const bomVersion = await prisma.bomVersion.findFirstOrThrow({
    where: { status: "已发布", bom: { status: "启用", skuId: version.route.skuId } },
    include: { bom: true, items: { where: { status: "启用" }, take: 1 } },
    orderBy: { version: "desc" },
  });
  const [equipment, mold, materialLot] = await Promise.all([
    prisma.equipmentMaster.findUniqueOrThrow({ where: { code: "INJ01" } }),
    prisma.moldMaster.findUniqueOrThrow({ where: { code: "MLD-INJ-001" } }),
    prisma.materialLot.findFirstOrThrow({ where: { materialId: bomVersion.items[0]?.materialId, stockStatus: "可用" } }),
  ]);
  const earliestEffective = Math.max(
    new Date("2026-07-16T08:00:00+07:00").getTime(),
    version.effectiveFrom?.getTime() ?? 0,
    bomVersion.effectiveFrom?.getTime() ?? 0,
  );
  const smokeStart = new Date(earliestEffective);
  const smokeEnd = new Date(earliestEffective + 12 * 60 * 60 * 1000);

  await runAction(() => createWorkOrder({
    skuId: version.route.skuId,
    planQty: 10,
    planStart: smokeStart.toISOString(),
    planEnd: smokeEnd.toISOString(),
    planEquipmentId: equipment.id,
    planMoldId: mold.id,
    bomVersion: bomVersion.version,
    bomVersionId: bomVersion.id,
    routeVersionId: version.id,
    note: marker,
  }));
  const workOrder = await prisma.workOrder.findFirstOrThrow({ where: { note: marker } });
  assert.equal(workOrder.status, "未下达");
  assert.equal(await prisma.workOrderOperation.count({ where: { workOrderId: workOrder.id } }), 0);

  await runAction(() => setWorkOrderStatus(workOrder.id, "已下达"));
  let operations = await prisma.workOrderOperation.findMany({ where: { workOrderId: workOrder.id }, orderBy: { sequence: "asc" } });
  assert.equal(operations.length, 5);
  assert.equal(operations[0].status, "可开工");
  assert.equal(operations[1].status, "等待前序");
  const frozenRequirement = await prisma.workOrderMaterialRequirement.findFirstOrThrow({
    where: { workOrderId: workOrder.id, operationSequence: operations[0].sequence },
  });

  async function report(
    operation: (typeof operations)[number],
    goodQty: number,
    sourceBatchInputs: { batchId: string; qty: number; relationType: "转序" | "拆批" | "合批" | "返工" }[] = [],
    options: { badQty?: number; defectReasonId?: string; reworkOrderId?: string } = {}
  ) {
    const badQty = options.badQty ?? 0;
    const result = await runAction(() => submitOperationReport({
      workOrderOperationId: operation.id,
      equipmentId: operation.requiresEquipment ? equipment.id : undefined,
      moldId: operation.requiresMold ? mold.id : undefined,
      materialInputs: sourceBatchInputs.length ? [] : [{ materialLotId: materialLot.id, qty: 0.2, consumptionType: "主料", requirementId: frozenRequirement.id }],
      sourceBatchInputs,
      shift: "白班",
      operator: "PROCESS-SMOKE",
      startTime: new Date(smokeStart.getTime() + operations.indexOf(operation) * 60 * 60 * 1000).toISOString(),
      endTime: new Date(smokeStart.getTime() + (operations.indexOf(operation) + 1) * 60 * 60 * 1000).toISOString(),
      goodQty,
      badQty,
      defects: badQty > 0 ? [{ reasonId: options.defectReasonId!, qty: badQty, responsible: "工艺", action: "返工" }] : [],
      note: marker,
      reworkOrderId: options.reworkOrderId,
    }));
    if (result && typeof result === "object" && "ok" in result && !result.ok) {
      throw new Error(`工序报工失败：${JSON.stringify(result)}`);
    }
    const batch = await prisma.productionBatch.findFirstOrThrow({
      where: { workOrderOperationId: operation.id, operator: "PROCESS-SMOKE" },
      orderBy: { createdAt: "desc" },
    });
    if (operation.qualityRequired) {
      assert.equal(batch.status, "待检");
      await runAction(() => recordOperationQuality({
        batchId: batch.id,
        result: "合格",
        qualifiedQty: goodQty,
        unqualifiedQty: 0,
        sampleQty: goodQty,
        inspector: "QUALITY-SMOKE",
        note: marker,
      }));
    }
    return batch;
  }

  const dryingBatch = await report(operations[0], 10);
  operations = await prisma.workOrderOperation.findMany({ where: { workOrderId: workOrder.id }, orderBy: { sequence: "asc" } });
  assert.equal(operations[1].status, "可开工");

  const defectReason = await prisma.defectReason.findFirstOrThrow({ where: { appliesTo: { in: ["注塑", "通用"] }, status: "启用" } });
  const formingBatchA = await report(operations[1], 3, [{ batchId: dryingBatch.id, qty: 4, relationType: "拆批" }], { badQty: 1, defectReasonId: defectReason.id });
  const formingBatchB = await report(operations[1], 6, [{ batchId: dryingBatch.id, qty: 6, relationType: "拆批" }]);
  operations = await prisma.workOrderOperation.findMany({ where: { workOrderId: workOrder.id }, orderBy: { sequence: "asc" } });
  assert.equal(operations[1].status, "已完成");
  assert.equal(operations[2].status, "可开工");

  await runAction(() => createReworkOrder({
    sourceBatchId: formingBatchA.id,
    workOrderOperationId: operations[1].id,
    routeVersionId: version.id,
    qty: 1,
    reason: "冒烟测试返工",
    createdBy: "QUALITY-SMOKE",
    approvedBy: "LEADER-SMOKE",
  }));
  const reworkOrder = await prisma.reworkOrder.findFirstOrThrow({ where: { sourceBatchId: formingBatchA.id, status: "待处理" } });
  const reworkBatch = await report(operations[1], 1, [{ batchId: formingBatchA.id, qty: 1, relationType: "返工" }], { reworkOrderId: reworkOrder.id });
  assert.equal((await prisma.reworkOrder.findUniqueOrThrow({ where: { id: reworkOrder.id } })).status, "已完成");

  const trimmingBatch = await report(operations[2], 10, [
    { batchId: formingBatchA.id, qty: 3, relationType: "合批" },
    { batchId: formingBatchB.id, qty: 6, relationType: "合批" },
    { batchId: reworkBatch.id, qty: 1, relationType: "合批" },
  ]);
  operations = await prisma.workOrderOperation.findMany({ where: { workOrderId: workOrder.id }, orderBy: { sequence: "asc" } });
  const inspectionBatch = await report(operations[3], 10, [{ batchId: trimmingBatch.id, qty: 10, relationType: "转序" }]);
  assert.equal((await prisma.productionBatch.findUniqueOrThrow({ where: { id: inspectionBatch.id } })).status, "已完工");
  operations = await prisma.workOrderOperation.findMany({ where: { workOrderId: workOrder.id }, orderBy: { sequence: "asc" } });
  const finalBatch = await report(operations[4], 10, [{ batchId: inspectionBatch.id, qty: 10, relationType: "转序" }]);

  await runAction(() => createStockIn({ batchId: finalBatch.id, qty: 10, warehouse: "成品仓-SMOKE", inBy: "WAREHOUSE-SMOKE" }));

  const verified = await prisma.workOrder.findUniqueOrThrow({
    where: { id: workOrder.id },
    include: { operations: true, batches: true },
  });
  assert.equal(verified.status, "已完工");
  assert.equal(verified.operations.every((operation) => operation.status === "已完成"), true);
  assert.equal(await prisma.batchGenealogy.count({ where: { targetBatch: { workOrderId: workOrder.id } } }), 8);
  assert.equal(await prisma.operationQualityResult.count({ where: { workOrderOperation: { workOrderId: workOrder.id } } }), 1);
  assert.equal(await prisma.reworkOrder.count({ where: { sourceBatch: { workOrderId: workOrder.id }, status: "已完成" } }), 1);
  assert.equal(await prisma.stockInRecord.count({ where: { batchId: finalBatch.id } }), 1);
  console.log(`工艺路线冒烟通过：${workOrder.no}，5道工序、拆批/合批/返工共8条谱系、1次质量放行、最终入库10件。`);
}

main()
  .finally(() => prisma.$disconnect());
