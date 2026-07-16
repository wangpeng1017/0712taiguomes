// 数量闭环 / 材料利用率 / 冲次 / 模具寿命公式唯一实现，见 SPEC §6.4.3/§6.5.3/§6.5.4/§6.7.2。
// UI 层与 Server Action 只读取这里的计算结果，不重复实现公式（见根 CLAUDE.md）。

export function totalQty(goodQty: number, badQty: number): number {
  return goodQty + badQty;
}

export function firstPassYield(goodQty: number, totalInputQty: number): number {
  return totalInputQty > 0 ? goodQty / totalInputQty : 0;
}

export function availableTransferQty(releasedQty: number, consumedQty: number): number {
  return Math.max(releasedQty - consumedQty, 0);
}

export type OperationQuantityBalance = {
  inputQty: number;
  reworkInputQty?: number;
  goodTransferQty: number;
  scrapQty?: number;
  reworkOutputQty?: number;
  wipQty?: number;
};

export function operationQuantityVariance(balance: OperationQuantityBalance): number {
  const input = balance.inputQty + (balance.reworkInputQty ?? 0);
  const output = balance.goodTransferQty
    + (balance.scrapQty ?? 0)
    + (balance.reworkOutputQty ?? 0)
    + (balance.wipQty ?? 0);
  return input - output;
}

export function isOperationQuantityClosed(balance: OperationQuantityBalance): boolean {
  return Math.abs(operationQuantityVariance(balance)) < 1e-9;
}

export function workOrderCompletionRate(finalOperationGoodQty: number, planQty: number): number {
  if (planQty <= 0) return 0;
  return finalOperationGoodQty / planQty;
}

export function requiredMaterialQty(input: {
  productionQty: number;
  quantityPerBasis: number;
  basisQty: number;
  lossRate?: number;
}): number {
  if (input.productionQty <= 0 || input.quantityPerBasis < 0 || input.basisQty <= 0) return 0;
  const lossRate = Math.max(input.lossRate ?? 0, 0);
  return (input.productionQty / input.basisQty) * input.quantityPerBasis * (1 + lossRate);
}

export function materialConsumptionVariance(actualQty: number, standardQty: number): {
  varianceQty: number;
  varianceRate: number | null;
} {
  const varianceQty = actualQty - standardQty;
  return {
    varianceQty,
    varianceRate: standardQty > 0 ? varianceQty / standardQty : null,
  };
}

export function isMaterialWithinTolerance(input: {
  actualQty: number;
  standardQty: number;
  upperToleranceRate: number;
}): boolean {
  if (input.standardQty <= 0) return input.actualQty <= 0;
  return input.actualQty <= input.standardQty * (1 + Math.max(input.upperToleranceRate, 0));
}

export function defectRate(badQty: number, total: number): number {
  return total > 0 ? badQty / total : 0;
}

// 实际消耗重量 = 领用重量 - 退料/剩余重量
export function actualConsumptionWeight(issuedWeight: number, returnOrRemainingWeight: number): number {
  return Math.max(issuedWeight - returnOrRemainingWeight, 0);
}

// 材料利用率 = 良品理论重量(kg) / 实际消耗重量(kg)；stdWeightGram 为 SKU 标准重量(克)
export function materialUtilization(
  goodQty: number,
  stdWeightGram: number | null | undefined,
  actualConsumptionKg: number
): number | null {
  if (!stdWeightGram || actualConsumptionKg <= 0) return null;
  const theoreticalKg = (goodQty * stdWeightGram) / 1000;
  return theoreticalKg / actualConsumptionKg;
}

// 边角料率 = 边角料重量 / 卷材消耗重量
export function scrapRate(scrapWeight: number, consumptionWeight: number): number | null {
  if (consumptionWeight <= 0) return null;
  return scrapWeight / consumptionWeight;
}

// 本次模次/冲次 = 总生产数量 / 单次出件数；单次出件数为空则 = 总生产数量（SPEC §6.5.4）
export function thisMoldCount(total: number, cavityCount: number | null | undefined): number {
  if (!cavityCount || cavityCount <= 0) return total;
  return Math.ceil(total / cavityCount);
}

export function moldLifeRate(currentCount: number, designLife: number): number {
  return designLife > 0 ? currentCount / designLife : 0;
}

export interface MoldAlert {
  overLife: boolean; // >=100% 设计寿命，开工需二次确认
  dueForMaintenance: boolean; // 达到预警阈值 或 达到保养周期
  lifeRate: number;
}

export function evaluateMoldAlert(mold: {
  currentCount: number;
  designLife: number;
  warnThreshold: number;
  maintCycle: number;
  lastMaintCount: number;
}): MoldAlert {
  const lifeRate = moldLifeRate(mold.currentCount, mold.designLife);
  const dueForCycle = mold.currentCount - mold.lastMaintCount >= mold.maintCycle;
  return {
    overLife: lifeRate >= 1,
    dueForMaintenance: lifeRate >= mold.warnThreshold || dueForCycle,
    lifeRate,
  };
}
