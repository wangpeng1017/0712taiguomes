import { prisma } from "@/lib/db";

type LooseRecord = Record<string, unknown>;

export type TraceMaterialConsumption = {
  id: string;
  batchId: string;
  materialLotId: string | null;
  sourceBatchId: string | null;
  lotNo: string | null;
  materialName: string | null;
  sourceBatchNo: string | null;
  qty: number;
  unit: string;
  consumptionType: string;
};

export type TraceQualityResult = {
  id: string;
  result: string;
  inspectedQty: number;
  passedQty: number;
  failedQty: number;
  inspector: string;
  inspectedAt: string | null;
};

export type TraceReworkOrder = {
  id: string;
  no: string;
  status: string;
  qty: number;
  qualifiedQty: number;
  scrapQty: number;
  reason: string;
};

export type TraceOperation = {
  id: string;
  workOrderId: string;
  workOrderNo: string;
  routeVersionId: string | null;
  routeLabel: string;
  sequence: number;
  code: string;
  name: string;
  workCenter: string;
  isFinal: boolean;
  status: string;
  plannedQty: number;
  inputQty: number;
  completedQty: number;
  goodQty: number;
  badQty: number;
  startTime: string | null;
  endTime: string | null;
};

export type TraceGenealogyEdge = {
  id: string;
  sourceBatchId: string;
  targetBatchId: string;
  qty: number;
  relationType: string;
  operator: string;
  remark: string;
};

function value(row: LooseRecord | null | undefined, keys: string[]): unknown {
  for (const key of keys) {
    const candidate = row?.[key];
    if (candidate !== undefined && candidate !== null && candidate !== "") return candidate;
  }
  return undefined;
}

function textValue(row: LooseRecord | null | undefined, keys: string[], fallback = ""): string {
  const candidate = value(row, keys);
  return candidate === undefined ? fallback : String(candidate);
}

function numberValue(row: LooseRecord | null | undefined, keys: string[], fallback = 0): number {
  const candidate = Number(value(row, keys));
  return Number.isFinite(candidate) ? candidate : fallback;
}

function dateValue(row: LooseRecord | null | undefined, keys: string[]): string | null {
  const candidate = value(row, keys);
  if (!candidate) return null;
  const date = candidate instanceof Date ? candidate : new Date(String(candidate));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function safeFindMany(delegate: unknown): Promise<LooseRecord[]> {
  if (!delegate || typeof (delegate as { findMany?: unknown }).findMany !== "function") return [];
  try {
    return await (delegate as { findMany: (args?: unknown) => Promise<LooseRecord[]> }).findMany();
  } catch {
    // During a rolling deployment the generated Prisma client and the database migration
    // may briefly be on different versions. Legacy one-step tracing must remain available.
    return [];
  }
}

export async function getTraceData() {
  const db = prisma as unknown as Record<string, unknown>;
  const [batches, materialLots, molds, processRoutes, routeVersions, routeOperations, workOrderOperations, consumptions, genealogy, qualityResults, reworkOrders] = await Promise.all([
    prisma.productionBatch.findMany({
      include: {
        workOrder: true,
        sku: true,
        equipment: true,
        mold: true,
        materialLot: { include: { material: true } },
        defects: { include: { reason: true } },
        stockIns: true,
      },
      orderBy: { startTime: "desc" },
    }),
    prisma.materialLot.findMany({ include: { material: true }, orderBy: { lotNo: "asc" } }),
    prisma.moldMaster.findMany({ include: { maintenance: { orderBy: { startTime: "desc" } } }, orderBy: { code: "asc" } }),
    safeFindMany(db.processRoute),
    safeFindMany(db.processRouteVersion),
    safeFindMany(db.routeOperation),
    safeFindMany(db.workOrderOperation),
    safeFindMany(db.batchMaterialConsumption),
    safeFindMany(db.batchGenealogy),
    safeFindMany(db.operationQualityResult),
    safeFindMany(db.reworkOrder),
  ]);

  const batchRows = batches as unknown as (LooseRecord & typeof batches[number])[];
  const workOrderRows = new Map(batchRows.map((batch) => [batch.workOrder.id, batch.workOrder as unknown as LooseRecord]));
  const lotById = new Map(materialLots.map((lot) => [lot.id, lot]));
  const batchById = new Map(batchRows.map((batch) => [batch.id, batch]));
  const routeById = new Map(processRoutes.map((route) => [textValue(route, ["id"]), route]));
  const routeVersionById = new Map(routeVersions.map((version) => [textValue(version, ["id"]), version]));
  const routeOperationById = new Map(routeOperations.map((operation) => [textValue(operation, ["id"]), operation]));

  const routeLabel = (routeVersionId: string | null) => {
    if (!routeVersionId) return "历史单工序路线";
    const version = routeVersionById.get(routeVersionId);
    const routeId = textValue(version, ["routeId", "processRouteId"]);
    const route = routeById.get(routeId);
    const name = textValue(route, ["name", "routeName"], textValue(route, ["code", "routeCode"], "工艺路线"));
    const versionNo = textValue(version, ["version", "versionNo", "code"], "V1");
    return `${name} · ${versionNo}`;
  };

  const operationDtos: TraceOperation[] = workOrderOperations.map((workOrderOperation) => {
    const id = textValue(workOrderOperation, ["id"]);
    const workOrderId = textValue(workOrderOperation, ["workOrderId"]);
    const routeOperation = routeOperationById.get(textValue(workOrderOperation, ["routeOperationId", "operationId"]));
    const routeVersionId = textValue(routeOperation, ["routeVersionId", "processRouteVersionId"], textValue(workOrderRows.get(workOrderId), ["routeVersionId"])) || null;
    const relatedBatches = batchRows.filter((batch) => textValue(batch, ["workOrderOperationId"]) === id && batch.status !== "已作废");
    const starts = relatedBatches.map((batch) => batch.startTime.getTime());
    const ends = relatedBatches.map((batch) => batch.endTime?.getTime()).filter((time): time is number => Number.isFinite(time));
    return {
      id,
      workOrderId,
      workOrderNo: textValue(workOrderRows.get(workOrderId), ["no"], relatedBatches[0]?.workOrder.no ?? "-"),
      routeVersionId,
      routeLabel: routeLabel(routeVersionId),
      sequence: numberValue(routeOperation, ["sequence", "seq", "operationSeq", "stepNo", "sortOrder"], numberValue(workOrderOperation, ["sequence", "seq", "operationSeq", "stepNo"])),
      code: textValue(routeOperation, ["code", "operationCode"], textValue(workOrderOperation, ["operationCode"], "OP")),
      name: textValue(routeOperation, ["name", "operationName"], textValue(workOrderOperation, ["operationName"], "生产工序")),
      workCenter: textValue(routeOperation, ["workCenter", "workCenterCode", "workCenterName"], textValue(workOrderOperation, ["workCenter", "workCenterCode"], "未配置")),
      isFinal: Boolean(value(workOrderOperation, ["isFinal"]) ?? value(routeOperation, ["isFinal"]) ?? false),
      status: textValue(workOrderOperation, ["status"], "等待前序"),
      plannedQty: numberValue(workOrderOperation, ["plannedQty", "planQty"]),
      inputQty: numberValue(workOrderOperation, ["inputQty"]),
      completedQty: numberValue(workOrderOperation, ["completedQty", "goodQty"], relatedBatches.reduce((sum, batch) => sum + batch.goodQty, 0)),
      goodQty: relatedBatches.reduce((sum, batch) => sum + batch.goodQty, 0),
      badQty: relatedBatches.reduce((sum, batch) => sum + batch.badQty, 0),
      startTime: starts.length ? new Date(Math.min(...starts)).toISOString() : dateValue(workOrderOperation, ["actualStart", "startedAt", "startTime"]),
      endTime: ends.length ? new Date(Math.max(...ends)).toISOString() : dateValue(workOrderOperation, ["actualEnd", "completedAt", "endTime"]),
    };
  }).sort((left, right) => left.sequence - right.sequence);

  const consumptionDtos: TraceMaterialConsumption[] = consumptions.map((consumption) => {
    const materialLotId = textValue(consumption, ["materialLotId"]) || null;
    const sourceBatchId = textValue(consumption, ["sourceBatchId"]) || null;
    const lot = materialLotId ? lotById.get(materialLotId) : null;
    const sourceBatch = sourceBatchId ? batchById.get(sourceBatchId) : null;
    return {
      id: textValue(consumption, ["id"]),
      batchId: textValue(consumption, ["batchId"]),
      materialLotId,
      sourceBatchId,
      lotNo: lot?.lotNo ?? null,
      materialName: lot?.material.name ?? null,
      sourceBatchNo: sourceBatch?.batchNo ?? null,
      qty: numberValue(consumption, ["qty"]),
      unit: textValue(consumption, ["unit"], lot?.unit ?? "PCS"),
      consumptionType: textValue(consumption, ["consumptionType", "type"], sourceBatchId ? "在制品投入" : "原料消耗"),
    };
  });

  const genealogyDtos: TraceGenealogyEdge[] = genealogy.map((edge) => ({
    id: textValue(edge, ["id"]),
    sourceBatchId: textValue(edge, ["sourceBatchId"]),
    targetBatchId: textValue(edge, ["targetBatchId"]),
    qty: numberValue(edge, ["qty"]),
    relationType: textValue(edge, ["relationType", "type"], "正常流转"),
    operator: textValue(edge, ["operator", "createdBy"], "-"),
    remark: textValue(edge, ["remark", "note", "reason"], ""),
  })).filter((edge) => edge.sourceBatchId && edge.targetBatchId);
  const inferredGenealogy = consumptionDtos
    .filter((item) => item.sourceBatchId && item.batchId)
    .filter((item) => !genealogyDtos.some((edge) => edge.sourceBatchId === item.sourceBatchId && edge.targetBatchId === item.batchId))
    .map((item): TraceGenealogyEdge => ({
      id: `consumption:${item.id}`,
      sourceBatchId: item.sourceBatchId!,
      targetBatchId: item.batchId,
      qty: item.qty,
      relationType: item.consumptionType === "返工料" ? "返工" : "转序",
      operator: "-",
      remark: "由工序投入记录推导",
    }));
  const allGenealogy = [...genealogyDtos, ...inferredGenealogy];

  const qualityDtos = qualityResults.map((result): TraceQualityResult & { batchId: string | null; workOrderOperationId: string | null } => ({
    id: textValue(result, ["id"]),
    batchId: textValue(result, ["batchId"]) || null,
    workOrderOperationId: textValue(result, ["workOrderOperationId"]) || null,
    result: textValue(result, ["result"], "待检"),
    inspectedQty: numberValue(result, ["inspectedQty", "sampleQty"]),
    passedQty: numberValue(result, ["passedQty", "qualifiedQty"]),
    failedQty: numberValue(result, ["failedQty", "unqualifiedQty"]),
    inspector: textValue(result, ["inspector"], "-"),
    inspectedAt: dateValue(result, ["inspectedAt"]),
  }));

  const reworkDtos = reworkOrders.map((rework): TraceReworkOrder & { sourceBatchId: string; resultBatchId: string | null } => ({
    id: textValue(rework, ["id"]),
    sourceBatchId: textValue(rework, ["sourceBatchId"]),
    resultBatchId: textValue(rework, ["resultBatchId"]) || null,
    no: textValue(rework, ["no", "reworkNo"], textValue(rework, ["id"]).slice(-8)),
    status: textValue(rework, ["status"], "待处理"),
    qty: numberValue(rework, ["qty"]),
    qualifiedQty: numberValue(rework, ["qualifiedQty"]),
    scrapQty: numberValue(rework, ["scrapQty"]),
    reason: textValue(rework, ["reason"], "-"),
  }));
  const reworkGenealogy = reworkDtos
    .filter((rework) => rework.sourceBatchId && rework.resultBatchId)
    .filter((rework) => !allGenealogy.some((edge) => edge.sourceBatchId === rework.sourceBatchId && edge.targetBatchId === rework.resultBatchId))
    .map((rework): TraceGenealogyEdge => ({
      id: `rework:${rework.id}`,
      sourceBatchId: rework.sourceBatchId,
      targetBatchId: rework.resultBatchId!,
      qty: rework.qty,
      relationType: "返工",
      operator: "-",
      remark: rework.reason,
    }));
  const completeGenealogy = [...allGenealogy, ...reworkGenealogy];

  return {
    batches: batchRows.map((batch) => {
      const workOrderOperationId = textValue(batch, ["workOrderOperationId"]) || null;
      const operation = operationDtos.find((item) => item.id === workOrderOperationId) ?? null;
      const legacyConsumption: TraceMaterialConsumption = {
        id: `legacy:${batch.id}`,
        batchId: batch.id,
        materialLotId: batch.materialLotId,
        sourceBatchId: null,
        lotNo: batch.materialLot?.lotNo ?? null,
        materialName: batch.materialLot?.material.name ?? null,
        sourceBatchNo: null,
        qty: batch.issuedWeight ?? 0,
        unit: batch.materialLot?.unit ?? "KG",
        consumptionType: "原料消耗",
      };
      const batchConsumptions = consumptionDtos.filter((item) => item.batchId === batch.id);
      return {
        id: batch.id,
        batchNo: batch.batchNo,
        workOrderId: batch.workOrderId,
        workOrderOperationId,
        shift: batch.shift,
        operator: batch.operator,
        startTime: batch.startTime.toISOString(),
        endTime: batch.endTime?.toISOString() ?? null,
        issuedWeight: batch.issuedWeight,
        returnWeight: batch.returnWeight,
        thisMoldCount: batch.thisMoldCount,
        goodQty: batch.goodQty,
        badQty: batch.badQty,
        status: batch.status,
        moldId: batch.moldId ?? "",
        materialLotId: batch.materialLotId ?? "",
        confirmedByLeader: batch.confirmedByLeader,
        leaderConfirmedBy: batch.leaderConfirmedBy,
        leaderConfirmedAt: batch.leaderConfirmedAt?.toISOString() ?? null,
        workOrder: { no: batch.workOrder.no, planQty: batch.workOrder.planQty },
        sku: { name: batch.sku.name, code: batch.sku.code },
        equipment: batch.equipment ? { code: batch.equipment.code, name: batch.equipment.name } : null,
        mold: batch.mold ? { code: batch.mold.code, name: batch.mold.name } : null,
        materialLot: batch.materialLot ? { lotNo: batch.materialLot.lotNo, material: { name: batch.materialLot.material.name } } : null,
        routeVersion: operation ? { id: operation.routeVersionId, label: operation.routeLabel } : null,
        operation,
        consumptions: batchConsumptions.length ? batchConsumptions : [legacyConsumption],
        qualityResults: qualityDtos.filter((result) => result.batchId === batch.id || (!!workOrderOperationId && !result.batchId && result.workOrderOperationId === workOrderOperationId)),
        reworkOrders: reworkDtos.filter((rework) => rework.sourceBatchId === batch.id || rework.resultBatchId === batch.id),
        defects: batch.defects.map((defect) => ({ id: defect.id, qty: defect.qty, responsible: defect.responsible, action: defect.action, reason: { reason: defect.reason.reason } })),
        stockIns: batch.stockIns.map((stockIn) => ({ id: stockIn.id, no: stockIn.no, type: stockIn.type, qty: stockIn.qty, warehouse: stockIn.warehouse, inBy: stockIn.inBy, inAt: stockIn.inAt.toISOString() })),
      };
    }),
    materialLots: materialLots.map((lot) => ({ id: lot.id, lotNo: lot.lotNo, material: { name: lot.material.name } })),
    molds: molds.map((mold) => ({
      id: mold.id,
      code: mold.code,
      name: mold.name,
      currentCount: mold.currentCount,
      designLife: mold.designLife,
      warnThreshold: mold.warnThreshold,
      maintenance: mold.maintenance.map((record) => ({ id: record.id, maintType: record.maintType, startTime: record.startTime.toISOString(), person: record.person, canContinue: record.canContinue })),
    })),
    operations: operationDtos,
    genealogy: completeGenealogy,
    capabilities: {
      routes: routeVersions.length > 0,
      operations: workOrderOperations.length > 0,
      genealogy: completeGenealogy.length > 0,
      quality: qualityDtos.length > 0,
      rework: reworkDtos.length > 0,
    },
  };
}
