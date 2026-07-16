export const ROUTE_VERSION_TRANSITIONS: Record<string, readonly string[]> = {
  草稿: ["已发布"],
  已发布: ["已停用"],
  已停用: [],
};

export const WORK_ORDER_OPERATION_TRANSITIONS: Record<string, readonly string[]> = {
  等待前序: ["可开工", "已关闭"],
  可开工: ["生产中", "已关闭"],
  生产中: ["暂停", "待检", "已完成", "已关闭"],
  暂停: ["生产中", "已关闭"],
  待检: ["已完成", "质量冻结", "已关闭"],
  质量冻结: ["待检", "已完成", "已关闭"],
  已完成: [],
  已关闭: [],
};

export function assertRouteVersionTransition(current: string, next: string): void {
  if (!ROUTE_VERSION_TRANSITIONS[current]?.includes(next)) {
    throw new Error(`工艺版本不允许从「${current}」变更为「${next}」`);
  }
}

export function assertOperationTransition(current: string, next: string): void {
  if (!WORK_ORDER_OPERATION_TRANSITIONS[current]?.includes(next)) {
    throw new Error(`工序任务不允许从「${current}」变更为「${next}」`);
  }
}

export function canOpenOperation(input: {
  status: string;
  isFirst: boolean;
  predecessorReleasedQty: number;
  predecessorConsumedQty: number;
}): boolean {
  if (input.status !== "可开工") return false;
  if (input.isFirst) return true;
  return input.predecessorReleasedQty - input.predecessorConsumedQty > 0;
}

export function statusAfterOperationReport(qualityRequired: boolean): "待检" | "已完成" {
  return qualityRequired ? "待检" : "已完成";
}

export function assertBatchCanBeVoided(input: {
  stockInCount: number;
  downstreamConsumptionCount: number;
  activeReworkCount: number;
}): void {
  if (input.stockInCount > 0) throw new Error("该批次已有入库记录，请先撤销入库后再作废");
  if (input.downstreamConsumptionCount > 0) throw new Error("该批次已被下游工序消费，必须先逆序撤销下游批次");
  if (input.activeReworkCount > 0) throw new Error("该批次存在进行中的返工任务，不可直接作废");
}

export function isFinalOperationComplete(finalGoodQty: number, planQty: number): boolean {
  return planQty > 0 && finalGoodQty >= planQty;
}
