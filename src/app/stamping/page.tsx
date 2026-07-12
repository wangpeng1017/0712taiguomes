import { getReportFormOptions, getRecentBatches } from "@/lib/queries/production";
import { ProductionReportForm } from "@/components/production/ProductionReportForm";
import { RecentBatchesTable } from "@/components/production/RecentBatchesTable";

export default async function StampingPage() {
  const [options, recent] = await Promise.all([getReportFormOptions("冲压"), getRecentBatches("冲压")]);

  return (
    <div>
      <ProductionReportForm
        type="冲压"
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
      />
      <RecentBatchesTable batches={recent} />
    </div>
  );
}
