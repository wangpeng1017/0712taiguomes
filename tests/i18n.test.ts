import assert from "node:assert/strict";
import test from "node:test";
import { translateText } from "../src/lib/i18n";

test("translates navigation and CRUD terminology", () => {
  assert.equal(translateText("仪表盘"), "Dashboard");
  assert.equal(translateText("新增报工"), "New Report");
  assert.equal(translateText("待报工"), "Pending Report");
  assert.equal(translateText("暂无已下达工单或生产批次"), "No released work orders or production batches");
  assert.equal(translateText("搜索批次、工单、产品、设备或操作员"), "Search batch, work order, product, equipment, or operator");
  assert.equal(translateText("物料批次"), "Material Lots");
  assert.equal(translateText("编辑模具"), "Edit Mold");
});

test("translates dynamic messages while preserving values", () => {
  assert.equal(translateText("累计/设计寿命 120 / 1000"), "Current / Design Life 120 / 1000");
  assert.equal(translateText("新增产品 SKU"), "New Product SKU");
});
