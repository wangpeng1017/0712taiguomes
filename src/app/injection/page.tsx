import { getReportFormOptions, getProductionBatches } from "@/lib/queries/production";
import { ProductionBatchView } from "@/components/production/ProductionBatchView";

export default async function InjectionPage() {
  const [options, batches] = await Promise.all([getReportFormOptions("注塑"), getProductionBatches("注塑")]);

  return (
    <ProductionBatchView
        type="注塑"
        workOrders={options.workOrders.map((w) => ({
          id: w.id, no: w.no, planQty: w.planQty, status: w.status,
          sku: { id: w.sku.id, code: w.sku.code, name: w.sku.name, stdWeight: w.sku.stdWeight },
        }))}
        equipments={options.equipments.map((e) => ({ id: e.id, code: e.code, name: e.name, status: e.status }))}
        molds={options.molds.map((m) => ({
          id: m.id, code: m.code, name: m.name, status: m.status,
          currentCount: m.currentCount, designLife: m.designLife, warnThreshold: m.warnThreshold, cavityCount: m.cavityCount,
        }))}
        materialLots={options.materialLots.map((l) => ({
          id: l.id, lotNo: l.lotNo, remainingQty: l.remainingQty, unit: l.unit, material: { name: l.material.name },
        }))}
        defectReasons={options.defectReasons.map((r) => ({ id: r.id, reason: r.reason }))}
        batches={batches.map((b) => ({
          id: b.id, batchNo: b.batchNo, status: b.status, shift: b.shift, operator: b.operator,
          startTime: b.startTime.toISOString(), endTime: b.endTime?.toISOString() ?? null,
          goodQty: b.goodQty, badQty: b.badQty, issuedWeight: b.issuedWeight, returnWeight: b.returnWeight,
          scrapWeight: b.scrapWeight, thisMoldCount: b.thisMoldCount, note: b.note,
          workOrder: { no: b.workOrder.no }, sku: { name: b.sku.name, code: b.sku.code },
          equipment: { code: b.equipment.code, name: b.equipment.name }, mold: { code: b.mold.code, name: b.mold.name },
          materialLot: { lotNo: b.materialLot.lotNo, material: { name: b.materialLot.material.name } },
          defects: b.defects.map((d) => ({ id: d.id, qty: d.qty, reason: d.reason.reason, action: d.action })),
          stockInQty: b.stockIns.filter((s) => s.type !== "不良品隔离").reduce((sum, s) => sum + s.qty, 0),
        }))}
      />
  );
}
