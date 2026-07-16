import assert from "node:assert/strict";
import test from "node:test";
import {
  actualConsumptionWeight,
  availableTransferQty,
  defectRate,
  evaluateMoldAlert,
  firstPassYield,
  isOperationQuantityClosed,
  materialUtilization,
  operationQuantityVariance,
  thisMoldCount,
  totalQty,
  workOrderCompletionRate,
} from "../src/lib/production-calc";

test("production quantity and rate formulas remain closed", () => {
  assert.equal(totalQty(96, 4), 100);
  assert.equal(defectRate(4, 100), 0.04);
  assert.equal(actualConsumptionWeight(12.5, 2.5), 10);
  assert.equal(materialUtilization(1000, 8, 10), 0.8);
});

test("mold count rounds up to a physical cycle", () => {
  assert.equal(thisMoldCount(9, 4), 3);
  assert.equal(thisMoldCount(9, null), 9);
});

test("mold alert covers life and maintenance-cycle thresholds", () => {
  assert.deepEqual(
    evaluateMoldAlert({ currentCount: 800, designLife: 1000, warnThreshold: 0.8, maintCycle: 500, lastMaintCount: 500 }),
    { overLife: false, dueForMaintenance: true, lifeRate: 0.8 }
  );
  assert.equal(
    evaluateMoldAlert({ currentCount: 1000, designLife: 1000, warnThreshold: 0.8, maintCycle: 500, lastMaintCount: 900 }).overLife,
    true
  );
});

test("operation transfer and completion use released and final-operation quantities", () => {
  assert.equal(availableTransferQty(980, 600), 380);
  assert.equal(availableTransferQty(980, 1000), 0);
  assert.equal(workOrderCompletionRate(960, 1000), 0.96);
  assert.equal(firstPassYield(960, 1000), 0.96);
});

test("operation quantity balance covers good, scrap, rework and WIP outputs", () => {
  const balance = {
    inputQty: 1000,
    reworkInputQty: 20,
    goodTransferQty: 960,
    scrapQty: 10,
    reworkOutputQty: 20,
    wipQty: 30,
  };
  assert.equal(operationQuantityVariance(balance), 0);
  assert.equal(isOperationQuantityClosed(balance), true);
  assert.equal(isOperationQuantityClosed({ ...balance, goodTransferQty: 959 }), false);
});
