import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBatchCanBeVoided,
  assertOperationTransition,
  assertRouteVersionTransition,
  canOpenOperation,
  isFinalOperationComplete,
  statusAfterOperationReport,
} from "../src/lib/operation-workflow";

test("published route versions are immutable and can only be disabled", () => {
  assert.doesNotThrow(() => assertRouteVersionTransition("草稿", "已发布"));
  assert.doesNotThrow(() => assertRouteVersionTransition("已发布", "已停用"));
  assert.throws(() => assertRouteVersionTransition("已发布", "草稿"));
});

test("operation state machine gates execution and inspection", () => {
  assert.doesNotThrow(() => assertOperationTransition("可开工", "生产中"));
  assert.doesNotThrow(() => assertOperationTransition("生产中", "待检"));
  assert.throws(() => assertOperationTransition("等待前序", "生产中"));
  assert.equal(statusAfterOperationReport(true), "待检");
  assert.equal(statusAfterOperationReport(false), "已完成");
});

test("non-first operations need predecessor released balance", () => {
  assert.equal(canOpenOperation({ status: "可开工", isFirst: true, predecessorReleasedQty: 0, predecessorConsumedQty: 0 }), true);
  assert.equal(canOpenOperation({ status: "可开工", isFirst: false, predecessorReleasedQty: 100, predecessorConsumedQty: 80 }), true);
  assert.equal(canOpenOperation({ status: "可开工", isFirst: false, predecessorReleasedQty: 100, predecessorConsumedQty: 100 }), false);
});

test("downstream consumption, stock-in and active rework block voiding", () => {
  assert.doesNotThrow(() => assertBatchCanBeVoided({ stockInCount: 0, downstreamConsumptionCount: 0, activeReworkCount: 0 }));
  assert.throws(() => assertBatchCanBeVoided({ stockInCount: 1, downstreamConsumptionCount: 0, activeReworkCount: 0 }));
  assert.throws(() => assertBatchCanBeVoided({ stockInCount: 0, downstreamConsumptionCount: 1, activeReworkCount: 0 }));
  assert.throws(() => assertBatchCanBeVoided({ stockInCount: 0, downstreamConsumptionCount: 0, activeReworkCount: 1 }));
  assert.equal(isFinalOperationComplete(1000, 1000), true);
  assert.equal(isFinalOperationComplete(999, 1000), false);
});
