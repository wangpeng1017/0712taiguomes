import { getTraceData } from "@/lib/queries/trace";

export async function getReportData() {
  const traceData = await getTraceData();
  const outgoingQty = new Map<string, number>();
  for (const edge of traceData.genealogy) {
    outgoingQty.set(edge.sourceBatchId, (outgoingQty.get(edge.sourceBatchId) ?? 0) + edge.qty);
  }

  const batches = traceData.batches
    .filter((batch) => batch.status === "已完工")
    .map((batch) => {
      const stockInQty = batch.stockIns.filter((record) => record.type !== "不良品隔离").reduce((sum, record) => sum + record.qty, 0);
      const transferredQty = outgoingQty.get(batch.id) ?? 0;
      const wipQty = Math.max(batch.goodQty - transferredQty - stockInQty, 0);
      const totalQty = batch.goodQty + batch.badQty;
      const fpyPct = totalQty > 0 ? Math.round((batch.goodQty / totalQty) * 1000) / 10 : 0;
      return {
        ...batch,
        stockInQty,
        transferredQty,
        wipQty,
        fpyPct,
        issuedWeight: batch.issuedWeight ?? batch.consumptions.filter((item) => item.materialLotId).reduce((sum, item) => sum + item.qty, 0),
        returnWeight: batch.returnWeight ?? 0,
        thisMoldCount: batch.thisMoldCount,
      };
    });

  return { batches, capabilities: traceData.capabilities };
}
