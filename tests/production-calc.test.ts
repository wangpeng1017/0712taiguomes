import assert from "node:assert/strict";
import test from "node:test";
import {
  actualConsumptionWeight,
  defectRate,
  evaluateMoldAlert,
  materialUtilization,
  thisMoldCount,
  totalQty,
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
