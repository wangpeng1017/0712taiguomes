import assert from "node:assert/strict";
import test from "node:test";
import { WORK_ORDER_STATUS, WORK_ORDER_TRANSITIONS } from "../src/lib/constants";

test("every work-order state has an explicit transition definition", () => {
  for (const status of WORK_ORDER_STATUS) assert.ok(status in WORK_ORDER_TRANSITIONS);
});

test("terminal and production transitions match the approved state machine", () => {
  assert.deepEqual(WORK_ORDER_TRANSITIONS["未下达"], ["已下达", "已关闭"]);
  assert.deepEqual(WORK_ORDER_TRANSITIONS["生产中"], ["暂停", "已完工", "已关闭"]);
  assert.deepEqual(WORK_ORDER_TRANSITIONS["已关闭"], []);
  assert.equal(WORK_ORDER_TRANSITIONS["暂停"].includes("生产中"), true);
});
