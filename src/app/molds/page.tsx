import { getMoldFormOptions, getMoldsWithHistory } from "@/lib/queries/molds";
import { MoldsView } from "@/components/molds/MoldsView";

export default async function MoldsPage() {
  const [molds, options] = await Promise.all([getMoldsWithHistory(), getMoldFormOptions()]);

  return (
    <MoldsView
      molds={molds.map((m) => ({
        id: m.id, code: m.code, name: m.name, type: m.type, status: m.status,
        currentCount: m.currentCount, designLife: m.designLife, maintCycle: m.maintCycle, warnThreshold: m.warnThreshold,
        lastMaintDate: m.lastMaintDate ? m.lastMaintDate.toISOString() : null, lastMaintCount: m.lastMaintCount,
        cavityCount: m.cavityCount,
        note: m.note,
        applicableSku: m.applicableSku ? { id: m.applicableSku.id, name: m.applicableSku.name, code: m.applicableSku.code } : null,
        applicableEquipment: m.applicableEquipment ? { id: m.applicableEquipment.id, name: m.applicableEquipment.name, code: m.applicableEquipment.code } : null,
        batches: m.batches.map((b) => ({
          id: b.id, batchNo: b.batchNo, startTime: b.startTime.toISOString(), goodQty: b.goodQty, badQty: b.badQty,
          workOrder: { no: b.workOrder.no }, sku: { name: b.sku.name },
        })),
        maintenance: m.maintenance.map((mm) => ({
          id: mm.id, maintType: mm.maintType, startTime: mm.startTime.toISOString(),
          endTime: mm.endTime ? mm.endTime.toISOString() : null, person: mm.person,
          content: mm.content, replacedParts: mm.replacedParts, result: mm.result, canContinue: mm.canContinue,
        })),
      }))}
      skus={options.skus.map((s) => ({ id: s.id, code: s.code, name: s.name, type: s.type }))}
      equipments={options.equipments.map((e) => ({ id: e.id, code: e.code, name: e.name, type: e.type }))}
    />
  );
}
