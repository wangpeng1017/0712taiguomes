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
    note: wo.note,
  }));

  return (
    <WorkOrderTable
      rows={rows}
      skus={options.skus.map((s) => ({ id: s.id, code: s.code, name: s.name, type: s.type }))}
      equipments={options.equipments.map((e) => ({ id: e.id, code: e.code, name: e.name, type: e.type, status: e.status }))}
      molds={options.molds.map((m) => ({ id: m.id, code: m.code, name: m.name, type: m.type, applicableSkuId: m.applicableSkuId, status: m.status }))}
    />
  );
}
