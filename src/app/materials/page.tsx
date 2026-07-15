import { getMaterialLots, getMaterialIssues, getMaterialReturns, getStockInData, getMaterialMasters } from "@/lib/queries/materials";
import { MaterialsView } from "@/components/materials/MaterialsView";
import { redirect } from "next/navigation";

export default async function MaterialsPage({ params }: { params?: { view?: string } }) {
  if (!params?.view) redirect("/materials/lots");
  const section = params?.view === "issues" || params?.view === "returns" || params?.view === "stock-in" ? params.view : "lots";
  const [lots, issues, returns, stockInData, materials] = await Promise.all([
    getMaterialLots(),
    getMaterialIssues(),
    getMaterialReturns(),
    getStockInData(),
    getMaterialMasters(),
  ]);

  return (
    <MaterialsView
      section={section}
      lots={lots.map((l) => ({
        id: l.id, lotNo: l.lotNo, supplierLot: l.supplierLot, qty: l.qty, remainingQty: l.remainingQty, unit: l.unit,
        inDate: l.inDate.toISOString(), supplier: l.supplier, inspectStatus: l.inspectStatus, stockStatus: l.stockStatus, warehouse: l.warehouse,
        material: { name: l.material.name, code: l.material.code },
      }))}
      issues={issues.map((i) => ({
        id: i.id, qty: i.qty, issuedBy: i.issuedBy, issuedAt: i.issuedAt.toISOString(),
        workOrder: { no: i.workOrder.no }, materialLot: { lotNo: i.materialLot.lotNo, material: { name: i.materialLot.material.name } },
        equipment: i.equipment ? { code: i.equipment.code } : null,
      }))}
      returns={returns.map((r) => ({
        id: r.id, qty: r.qty, reason: r.reason, returnedAt: r.returnedAt.toISOString(), returnedBy: r.returnedBy,
        workOrder: { no: r.workOrder.no }, materialLot: { lotNo: r.materialLot.lotNo, material: { name: r.materialLot.material.name } },
      }))}
      pending={stockInData.pending.map((b) => ({
        id: b.id, batchNo: b.batchNo, goodQty: b.goodQty, badQty: b.badQty,
        remainingGoodQty: b.remainingGoodQty, remainingBadQty: b.remainingBadQty, startTime: b.startTime.toISOString(),
        sku: { name: b.sku.name, isFinished: b.sku.isFinished }, workOrder: { no: b.workOrder.no },
      }))}
      stockIns={stockInData.stockIns.map((s) => ({
        id: s.id, no: s.no, type: s.type, qty: s.qty, warehouse: s.warehouse, inBy: s.inBy, inAt: s.inAt.toISOString(),
        batch: { batchNo: s.batch.batchNo, sku: { name: s.batch.sku.name }, workOrder: { no: s.batch.workOrder.no } },
      }))}
      materials={materials.map((m) => ({ id: m.id, code: m.code, name: m.name, unit: m.unit, supplier: m.supplier }))}
    />
  );
}
