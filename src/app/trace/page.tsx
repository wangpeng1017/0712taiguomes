import { getTraceData } from "@/lib/queries/trace";
import { TraceView } from "@/components/trace/TraceView";

export default async function TracePage() {
  const { batches, materialLots, molds } = await getTraceData();

  return (
    <TraceView
      batches={batches.map((b) => ({
        id: b.id, batchNo: b.batchNo, shift: b.shift, operator: b.operator,
        startTime: b.startTime.toISOString(), endTime: b.endTime ? b.endTime.toISOString() : null,
        goodQty: b.goodQty, badQty: b.badQty, status: b.status, moldId: b.moldId, materialLotId: b.materialLotId,
        confirmedByLeader: b.confirmedByLeader, leaderConfirmedBy: b.leaderConfirmedBy,
        leaderConfirmedAt: b.leaderConfirmedAt?.toISOString() ?? null,
        workOrder: { no: b.workOrder.no }, sku: { name: b.sku.name, code: b.sku.code },
        equipment: { code: b.equipment.code, name: b.equipment.name }, mold: { code: b.mold.code, name: b.mold.name },
        materialLot: { lotNo: b.materialLot.lotNo, material: { name: b.materialLot.material.name } },
        defects: b.defects.map((d) => ({ id: d.id, qty: d.qty, responsible: d.responsible, action: d.action, reason: { reason: d.reason.reason } })),
        stockIns: b.stockIns.map((s) => ({ id: s.id, no: s.no, type: s.type, qty: s.qty, warehouse: s.warehouse, inBy: s.inBy, inAt: s.inAt.toISOString() })),
      }))}
      materialLots={materialLots.map((l) => ({ id: l.id, lotNo: l.lotNo, material: { name: l.material.name } }))}
      molds={molds.map((m) => ({
        id: m.id, code: m.code, name: m.name, currentCount: m.currentCount, designLife: m.designLife, warnThreshold: m.warnThreshold,
        maintenance: m.maintenance.map((mm) => ({ id: mm.id, maintType: mm.maintType, startTime: mm.startTime.toISOString(), person: mm.person, canContinue: mm.canContinue })),
      }))}
    />
  );
}
