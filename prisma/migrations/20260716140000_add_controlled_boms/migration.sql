-- CreateTable
CREATE TABLE "BomMaster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '启用',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BomMaster_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BomVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bomId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '草稿',
    "effectiveFrom" DATETIME,
    "effectiveTo" DATETIME,
    "releasedAt" DATETIME,
    "releasedBy" TEXT,
    "changeReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BomVersion_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BomMaster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BomItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bomVersionId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "operationSequence" INTEGER,
    "operationCode" TEXT,
    "qtyPerBasis" REAL NOT NULL,
    "basisQty" REAL NOT NULL DEFAULT 1000,
    "unit" TEXT NOT NULL,
    "lossRate" REAL NOT NULL DEFAULT 0,
    "itemType" TEXT NOT NULL DEFAULT '主料',
    "status" TEXT NOT NULL DEFAULT '启用',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BomItem_bomVersionId_fkey" FOREIGN KEY ("bomVersionId") REFERENCES "BomVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BomItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialMaster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BomSubstitute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bomItemId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "conversionRate" REAL NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT '启用',
    "effectiveFrom" DATETIME,
    "effectiveTo" DATETIME,
    "reason" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BomSubstitute_bomItemId_fkey" FOREIGN KEY ("bomItemId") REFERENCES "BomItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BomSubstitute_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialMaster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkOrderMaterialRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderId" TEXT NOT NULL,
    "bomVersionId" TEXT,
    "bomItemId" TEXT,
    "materialId" TEXT,
    "materialCode" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "operationSequence" INTEGER,
    "operationCode" TEXT,
    "operationName" TEXT,
    "standardQty" REAL NOT NULL,
    "requiredQty" REAL NOT NULL,
    "issuedQty" REAL NOT NULL DEFAULT 0,
    "consumedQty" REAL NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "lossRate" REAL NOT NULL DEFAULT 0,
    "itemType" TEXT NOT NULL DEFAULT '主料',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkOrderMaterialRequirement_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrderMaterialRequirement_bomVersionId_fkey" FOREIGN KEY ("bomVersionId") REFERENCES "BomVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrderMaterialRequirement_bomItemId_fkey" FOREIGN KEY ("bomItemId") REFERENCES "BomItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrderMaterialRequirement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BatchMaterialConsumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "materialLotId" TEXT,
    "sourceBatchId" TEXT,
    "workOrderMaterialRequirementId" TEXT,
    "isSubstitute" BOOLEAN NOT NULL DEFAULT false,
    "qty" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "consumptionType" TEXT NOT NULL DEFAULT '主料',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchMaterialConsumption_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchMaterialConsumption_materialLotId_fkey" FOREIGN KEY ("materialLotId") REFERENCES "MaterialLot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BatchMaterialConsumption_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "ProductionBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BatchMaterialConsumption_workOrderMaterialRequirementId_fkey" FOREIGN KEY ("workOrderMaterialRequirementId") REFERENCES "WorkOrderMaterialRequirement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BatchMaterialConsumption" ("batchId", "consumptionType", "createdAt", "id", "materialLotId", "qty", "sourceBatchId", "unit") SELECT "batchId", "consumptionType", "createdAt", "id", "materialLotId", "qty", "sourceBatchId", "unit" FROM "BatchMaterialConsumption";
DROP TABLE "BatchMaterialConsumption";
ALTER TABLE "new_BatchMaterialConsumption" RENAME TO "BatchMaterialConsumption";
CREATE TABLE "new_WorkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "no" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "planQty" INTEGER NOT NULL,
    "planStart" DATETIME NOT NULL,
    "planEnd" DATETIME NOT NULL,
    "planEquipmentId" TEXT,
    "planMoldId" TEXT,
    "bomVersion" TEXT,
    "bomVersionId" TEXT,
    "route" TEXT,
    "routeVersionId" TEXT,
    "status" TEXT NOT NULL DEFAULT '未下达',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkOrder_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_planEquipmentId_fkey" FOREIGN KEY ("planEquipmentId") REFERENCES "EquipmentMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_planMoldId_fkey" FOREIGN KEY ("planMoldId") REFERENCES "MoldMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_bomVersionId_fkey" FOREIGN KEY ("bomVersionId") REFERENCES "BomVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_routeVersionId_fkey" FOREIGN KEY ("routeVersionId") REFERENCES "ProcessRouteVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WorkOrder" ("bomVersion", "createdAt", "id", "no", "note", "planEnd", "planEquipmentId", "planMoldId", "planQty", "planStart", "route", "routeVersionId", "skuId", "status", "type", "updatedAt") SELECT "bomVersion", "createdAt", "id", "no", "note", "planEnd", "planEquipmentId", "planMoldId", "planQty", "planStart", "route", "routeVersionId", "skuId", "status", "type", "updatedAt" FROM "WorkOrder";
DROP TABLE "WorkOrder";
ALTER TABLE "new_WorkOrder" RENAME TO "WorkOrder";
CREATE UNIQUE INDEX "WorkOrder_no_key" ON "WorkOrder"("no");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BomMaster_code_key" ON "BomMaster"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BomVersion_bomId_version_key" ON "BomVersion"("bomId", "version");

-- CreateIndex
CREATE INDEX "BomItem_bomVersionId_operationSequence_idx" ON "BomItem"("bomVersionId", "operationSequence");

-- CreateIndex
CREATE INDEX "BomItem_materialId_idx" ON "BomItem"("materialId");

-- CreateIndex
CREATE UNIQUE INDEX "BomSubstitute_bomItemId_materialId_key" ON "BomSubstitute"("bomItemId", "materialId");

-- CreateIndex
CREATE INDEX "WorkOrderMaterialRequirement_workOrderId_operationSequence_idx" ON "WorkOrderMaterialRequirement"("workOrderId", "operationSequence");

-- CreateIndex
CREATE INDEX "WorkOrderMaterialRequirement_bomVersionId_idx" ON "WorkOrderMaterialRequirement"("bomVersionId");

-- CreateIndex
CREATE INDEX "WorkOrderMaterialRequirement_materialId_idx" ON "WorkOrderMaterialRequirement"("materialId");
