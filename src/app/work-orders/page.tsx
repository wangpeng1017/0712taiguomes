import { getWorkOrdersWithProgress, getWorkOrderFormOptions } from "@/lib/queries/work-orders";
import { WorkOrderTable, type WorkOrderRow } from "@/components/work-orders/WorkOrderTable";

export default async function WorkOrdersPage() {
  const [workOrders, options] = await Promise.all([getWorkOrdersWithProgress(), getWorkOrderFormOptions()]);

  const rows: WorkOrderRow[] = workOrders.map((wo) => ({
    id: wo.id,
    no: wo.no,
    type: wo.type,
    planQty: wo.planQty,
    planStart: wo.planStart.toISOString(),
    planEnd: wo.planEnd.toISOString(),
    status: wo.status,
    sku: { id: wo.sku.id, code: wo.sku.code, name: wo.sku.name, type: wo.sku.type },
    planEquipment: wo.planEquipment
      ? { id: wo.planEquipment.id, code: wo.planEquipment.code, name: wo.planEquipment.name, type: wo.planEquipment.type, status: wo.planEquipment.status }
      : null,
    planMold: wo.planMold
      ? { id: wo.planMold.id, code: wo.planMold.code, name: wo.planMold.name, type: wo.planMold.type, applicableSkuId: wo.planMold.applicableSkuId, status: wo.planMold.status }
      : null,
    goodQty: wo.goodQty,
    badQty: wo.badQty,
    produced: wo.produced,
    completionRate: wo.completionRate,
    batchCount: wo.batchCount,
    bomVersion: wo.bomVersion,
    route: wo.route,
    routeVersion: wo.routeVersion ? {
      id: wo.routeVersion.id,
      version: wo.routeVersion.version,
      status: wo.routeVersion.status,
      route: { code: wo.routeVersion.route.code, name: wo.routeVersion.route.name },
    } : null,
    operations: wo.operations.map((operation) => ({
      id: operation.id,
      sequence: operation.sequence,
      operationCode: operation.operationCode,
      operationName: operation.operationName,
      operationType: operation.operationType,
      workCenter: operation.workCenter,
      status: operation.status,
      plannedQty: operation.plannedQty,
      inputQty: operation.inputQty,
      goodQty: operation.goodQty,
      badQty: operation.badQty,
      scrapQty: operation.scrapQty,
      transferredQty: operation.transferredQty,
      qualityStatus: operation.qualityStatus,
      isFinal: operation.isFinal,
    })),
    note: wo.note,
  }));

  return (
    <WorkOrderTable
      rows={rows}
      skus={options.skus.map((s) => ({ id: s.id, code: s.code, name: s.name, type: s.type }))}
      equipments={options.equipments.map((e) => ({ id: e.id, code: e.code, name: e.name, type: e.type, status: e.status }))}
      molds={options.molds.map((m) => ({ id: m.id, code: m.code, name: m.name, type: m.type, applicableSkuId: m.applicableSkuId, status: m.status }))}
      routeVersions={options.routeVersions.map((version) => ({
        id: version.id,
        version: version.version,
        route: { code: version.route.code, name: version.route.name, skuId: version.route.skuId },
        operations: version.operations.map((operation) => ({
          sequence: operation.sequence,
          operationCode: operation.operationCode,
          operationName: operation.operationName,
          isFinal: operation.isFinal,
        })),
      }))}
    />
  );
}
