import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBomVersionTransition,
  equivalentBomConsumption,
  isBomMaterialAllowed,
  validateBomRouteCompatibility,
  validateBomItems,
  validateFrozenBomConsumption,
} from "../src/lib/bom-workflow";

test("controlled BOM versions are immutable after publication", () => {
  assert.doesNotThrow(() => assertBomVersionTransition("草稿", "已发布"));
  assert.doesNotThrow(() => assertBomVersionTransition("已发布", "已停用"));
  assert.throws(() => assertBomVersionTransition("已发布", "草稿"));
});

test("BOM publication rejects invalid and duplicate material requirements", () => {
  assert.doesNotThrow(() => validateBomItems([
    { materialId: "MAT-A", operationSequence: 10, qtyPerBasis: 8, basisQty: 1000, lossRate: 0.03 },
  ]));
  assert.throws(() => validateBomItems([]));
  assert.throws(() => validateBomItems([
    { materialId: "MAT-A", operationSequence: 10, qtyPerBasis: 8, basisQty: 1000, lossRate: 0 },
    { materialId: "MAT-A", operationSequence: 10, qtyPerBasis: 1, basisQty: 1000, lossRate: 0 },
  ]));
});

test("reporting accepts the BOM material or an explicitly approved substitute", () => {
  assert.equal(isBomMaterialAllowed({ requiredMaterialId: "MAT-A", actualMaterialId: "MAT-A" }), true);
  assert.equal(isBomMaterialAllowed({ requiredMaterialId: "MAT-A", actualMaterialId: "MAT-B", approvedSubstituteMaterialIds: ["MAT-B"] }), true);
  assert.equal(isBomMaterialAllowed({ requiredMaterialId: "MAT-A", actualMaterialId: "MAT-C", approvedSubstituteMaterialIds: ["MAT-B"] }), false);
});

test("substitute consumption is converted to the frozen BOM equivalent quantity", () => {
  assert.equal(equivalentBomConsumption(8, 1.25), 10);
  assert.equal(equivalentBomConsumption(8), 8);
  assert.throws(() => equivalentBomConsumption(8, 0));
});

test("operation reporting must cover every frozen BOM item without exceeding its requirement", () => {
  const requirements = [
    { id: "REQ-A", materialName: "主料A", requiredQty: 100, consumedQty: 80 },
    { id: "REQ-B", materialName: "辅料B", requiredQty: 10, consumedQty: 2 },
  ];
  assert.doesNotThrow(() => validateFrozenBomConsumption(requirements, [
    { requirementId: "REQ-A", equivalentQty: 20 },
    { requirementId: "REQ-B", equivalentQty: 8 },
  ]));
  assert.throws(() => validateFrozenBomConsumption(requirements, []), /必须登记物料投入/);
  assert.throws(() => validateFrozenBomConsumption(requirements, [
    { requirementId: "REQ-A", equivalentQty: 1 },
  ]), /覆盖全部冻结 BOM 物料项/);
  assert.throws(() => validateFrozenBomConsumption(requirements, [
    { requirementId: "REQ-A", equivalentQty: 21 },
    { requirementId: "REQ-B", equivalentQty: 1 },
  ]), /不可超过需求数量/);
});

test("controlled BOM must be effective and aligned with the selected route", () => {
  const route = {
    status: "已发布",
    operations: [
      { sequence: 10, operationCode: "DRY" },
      { sequence: 20, operationCode: "MOLD" },
    ],
  };
  assert.doesNotThrow(() => validateBomRouteCompatibility({
    bom: {
      status: "已发布",
      effectiveFrom: new Date("2026-01-01"),
      items: [
        { operationSequence: null, operationCode: "DRY" },
        { operationSequence: 20, operationCode: "MOLD" },
      ],
    },
    route,
    planDate: new Date("2026-07-16"),
  }));
  assert.throws(() => validateBomRouteCompatibility({
    bom: { status: "已发布", items: [{ operationSequence: 30, operationCode: "PACK" }] },
    route,
    planDate: new Date("2026-07-16"),
  }));
  assert.throws(() => validateBomRouteCompatibility({
    bom: { status: "已发布", items: [{ operationSequence: 20, operationCode: "WRONG" }] },
    route,
    planDate: new Date("2026-07-16"),
  }));
  assert.throws(() => validateBomRouteCompatibility({
    bom: { status: "已发布", effectiveFrom: new Date("2026-08-01"), items: [{ operationSequence: 10 }] },
    route,
    planDate: new Date("2026-07-16"),
  }));
});
