import { getReportData } from "@/lib/queries/report";
import { ReportView } from "@/components/report/ReportView";

export default async function ReportPage() {
  const batches = await getReportData();

  return (
    <ReportView
      batches={batches.map((b) => ({
        id: b.id, batchNo: b.batchNo, shift: b.shift, startTime: b.startTime.toISOString(),
        goodQty: b.goodQty, badQty: b.badQty, issuedWeight: b.issuedWeight, returnWeight: b.returnWeight,
        thisMoldCount: b.thisMoldCount,
        workOrder: { no: b.workOrder.no, planQty: b.workOrder.planQty },
        sku: { code: b.sku.code, name: b.sku.name },
        equipment: { code: b.equipment.code },
        mold: { code: b.mold.code, status: b.mold.status },
        materialLot: { lotNo: b.materialLot.lotNo },
        defects: b.defects.map((d) => ({ qty: d.qty, reason: { reason: d.reason.reason } })),
        stockIns: b.stockIns.map((s) => ({ qty: s.qty })),
      }))}
    />
  );
}
