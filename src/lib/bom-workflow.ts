export const BOM_VERSION_TRANSITIONS: Record<string, readonly string[]> = {
  草稿: ["审核中", "已发布"],
  审核中: ["草稿", "已发布"],
  已发布: ["已停用"],
  已停用: [],
};

export function assertBomVersionTransition(current: string, next: string): void {
  if (!BOM_VERSION_TRANSITIONS[current]?.includes(next)) {
    throw new Error(`BOM版本不允许从「${current}」变更为「${next}」`);
  }
}

export type BomItemForValidation = {
  materialId: string;
  operationSequence?: number | null;
  qtyPerBasis: number;
  basisQty: number;
  lossRate: number;
  status?: string;
};

export function validateBomItems(items: BomItemForValidation[]): void {
  const activeItems = items.filter((item) => item.status !== "停用");
  if (activeItems.length === 0) throw new Error("BOM版本至少需要一条启用的物料明细");
  const keys = new Set<string>();
  for (const item of activeItems) {
    if (item.qtyPerBasis <= 0) throw new Error("BOM单位用量必须大于 0");
    if (item.basisQty <= 0) throw new Error("BOM基准数量必须大于 0");
    if (item.lossRate < 0) throw new Error("BOM损耗率不可为负数");
    const key = `${item.operationSequence ?? "ANY"}:${item.materialId}`;
    if (keys.has(key)) throw new Error("同一工序不可重复配置相同物料");
    keys.add(key);
  }
}

export function isBomMaterialAllowed(input: {
  requiredMaterialId: string;
  actualMaterialId: string;
  approvedSubstituteMaterialIds?: readonly string[];
}): boolean {
  return input.actualMaterialId === input.requiredMaterialId
    || (input.approvedSubstituteMaterialIds ?? []).includes(input.actualMaterialId);
}

export function equivalentBomConsumption(actualQty: number, conversionRate = 1): number {
  if (!Number.isFinite(actualQty) || actualQty < 0) throw new Error("实际消耗数量必须是非负数");
  if (!Number.isFinite(conversionRate) || conversionRate <= 0) throw new Error("替代料换算率必须大于 0");
  return actualQty * conversionRate;
}

export type FrozenBomRequirementForConsumption = {
  id: string;
  materialName: string;
  requiredQty: number;
  consumedQty: number;
};

export type FrozenBomUsage = {
  requirementId: string;
  equivalentQty: number;
};

export function validateFrozenBomConsumption(
  requirements: FrozenBomRequirementForConsumption[],
  usages: FrozenBomUsage[],
): void {
  if (requirements.length === 0) return;
  if (usages.length === 0) throw new Error("当前工序存在冻结 BOM 用料要求，必须登记物料投入");

  const totals = new Map<string, number>();
  for (const usage of usages) {
    if (!Number.isFinite(usage.equivalentQty) || usage.equivalentQty < 0) throw new Error("BOM 等效消耗数量不可为负数");
    totals.set(usage.requirementId, (totals.get(usage.requirementId) ?? 0) + usage.equivalentQty);
  }

  const uncovered = requirements.filter((requirement) => (totals.get(requirement.id) ?? 0) <= 0);
  if (uncovered.length > 0) {
    throw new Error(`当前工序必须覆盖全部冻结 BOM 物料项：${uncovered.map((item) => item.materialName).join("、")}`);
  }

  const epsilon = 1e-9;
  for (const requirement of requirements) {
    const reportQty = totals.get(requirement.id) ?? 0;
    if (requirement.consumedQty + reportQty > requirement.requiredQty + epsilon) {
      throw new Error(`物料 ${requirement.materialName} 累计等效消耗不可超过需求数量 ${requirement.requiredQty}`);
    }
  }
}

/**
 * Ensures that a controlled BOM can be executed against the selected route
 * and the work-order planning date. A null operation sequence intentionally
 * means the first operation in the route.
 */
export function validateBomRouteCompatibility(input: {
  bom: {
    status: string;
    effectiveFrom?: Date | null;
    effectiveTo?: Date | null;
    items: Array<{ status?: string; operationSequence?: number | null; operationCode?: string | null }>;
  };
  route: {
    status: string;
    effectiveFrom?: Date | null;
    effectiveTo?: Date | null;
    operations: Array<{ sequence: number; operationCode: string }>;
  };
  planDate: Date;
}): void {
  if (input.bom.status !== "已发布") throw new Error("只能使用已发布 BOM 版本");
  if (input.bom.effectiveFrom && input.planDate < input.bom.effectiveFrom) throw new Error("工单计划日期早于 BOM 生效日期");
  if (input.bom.effectiveTo && input.planDate > input.bom.effectiveTo) throw new Error("BOM 在工单计划日期已失效");
  if (input.route.status !== "已发布") throw new Error("只能使用已发布工艺路线版本");
  const firstSequence = input.route.operations.reduce<number | undefined>((first, operation) => (
    first == null || operation.sequence < first ? operation.sequence : first
  ), undefined);
  for (const item of input.bom.items.filter((item) => item.status !== "停用")) {
    const sequence = item.operationSequence ?? firstSequence;
    if (sequence == null || !input.route.operations.some((operation) => operation.sequence === sequence)) {
      throw new Error(`BOM 物料工序 ${item.operationSequence ?? "首道"} 不存在于选定工艺路线`);
    }
    if (item.operationCode) {
      const routeOperation = input.route.operations.find((operation) => operation.sequence === sequence);
      if (routeOperation && routeOperation.operationCode !== item.operationCode) {
        throw new Error(`BOM 物料 ${item.operationCode} 与工艺路线工序编码不一致`);
      }
    }
  }
}
