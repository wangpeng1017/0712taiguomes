-- CreateTable
CREATE TABLE "OperationMaster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "appliesTo" TEXT NOT NULL DEFAULT '通用',
    "workCenter" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT '启用',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProcessRoute" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '启用',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProcessRoute_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessRouteVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '草稿',
    "effectiveFrom" DATETIME,
    "effectiveTo" DATETIME,
    "releasedAt" DATETIME,
    "releasedBy" TEXT,
    "changeReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProcessRouteVersion_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "ProcessRoute" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RouteOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "routeVersionId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "operationCode" TEXT NOT NULL,
    "operationName" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "workCenter" TEXT,
    "standardCycleSeconds" REAL,
    "setupMinutes" REAL,
    "reportMode" TEXT NOT NULL DEFAULT '按批次',
    "requiresEquipment" BOOLEAN NOT NULL DEFAULT false,
    "requiresMold" BOOLEAN NOT NULL DEFAULT false,
    "qualityRequired" BOOLEAN NOT NULL DEFAULT false,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT '启用',
    "note" TEXT,
    CONSTRAINT "RouteOperation_routeVersionId_fkey" FOREIGN KEY ("routeVersionId") REFERENCES "ProcessRouteVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RouteOperation_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "OperationMaster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkOrderOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderId" TEXT NOT NULL,
    "routeOperationId" TEXT,
    "operationId" TEXT NOT NULL,
    "operationCode" TEXT NOT NULL,
    "operationName" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT '等待前序',
    "plannedQty" INTEGER NOT NULL,
    "inputQty" INTEGER NOT NULL DEFAULT 0,
    "goodQty" INTEGER NOT NULL DEFAULT 0,
    "badQty" INTEGER NOT NULL DEFAULT 0,
    "scrapQty" INTEGER NOT NULL DEFAULT 0,
    "transferredQty" INTEGER NOT NULL DEFAULT 0,
    "qualityStatus" TEXT NOT NULL DEFAULT '待检',
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "requiresEquipment" BOOLEAN NOT NULL DEFAULT false,
    "requiresMold" BOOLEAN NOT NULL DEFAULT false,
    "qualityRequired" BOOLEAN NOT NULL DEFAULT false,
    "reportMode" TEXT NOT NULL DEFAULT '按批次',
    "standardCycleSeconds" REAL,
    "workCenter" TEXT,
    "planEquipmentId" TEXT,
    "planMoldId" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkOrderOperation_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrderOperation_routeOperationId_fkey" FOREIGN KEY ("routeOperationId") REFERENCES "RouteOperation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrderOperation_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "OperationMaster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrderOperation_planEquipmentId_fkey" FOREIGN KEY ("planEquipmentId") REFERENCES "EquipmentMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrderOperation_planMoldId_fkey" FOREIGN KEY ("planMoldId") REFERENCES "MoldMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatchMaterialConsumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "materialLotId" TEXT,
    "sourceBatchId" TEXT,
    "qty" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "consumptionType" TEXT NOT NULL DEFAULT '主料',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchMaterialConsumption_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchMaterialConsumption_materialLotId_fkey" FOREIGN KEY ("materialLotId") REFERENCES "MaterialLot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BatchMaterialConsumption_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "ProductionBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BatchGenealogy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceBatchId" TEXT NOT NULL,
    "targetBatchId" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "relationType" TEXT NOT NULL DEFAULT '转序',
    "operator" TEXT,
    "remark" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatchGenealogy_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "ProductionBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BatchGenealogy_targetBatchId_fkey" FOREIGN KEY ("targetBatchId") REFERENCES "ProductionBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperationQualityResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderOperationId" TEXT NOT NULL,
    "batchId" TEXT,
    "inspectionType" TEXT NOT NULL DEFAULT '工序检验',
    "result" TEXT NOT NULL,
    "sampleQty" INTEGER,
    "qualifiedQty" INTEGER,
    "unqualifiedQty" INTEGER,
    "inspector" TEXT NOT NULL,
    "inspectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valuesJson" TEXT,
    "note" TEXT,
    CONSTRAINT "OperationQualityResult_workOrderOperationId_fkey" FOREIGN KEY ("workOrderOperationId") REFERENCES "WorkOrderOperation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OperationQualityResult_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReworkOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "no" TEXT NOT NULL,
    "sourceBatchId" TEXT NOT NULL,
    "workOrderOperationId" TEXT NOT NULL,
    "routeVersionId" TEXT NOT NULL,
    "resultBatchId" TEXT,
    "qty" INTEGER NOT NULL,
    "qualifiedQty" INTEGER NOT NULL DEFAULT 0,
    "scrapQty" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '待处理',
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "note" TEXT,
    CONSTRAINT "ReworkOrder_sourceBatchId_fkey" FOREIGN KEY ("sourceBatchId") REFERENCES "ProductionBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReworkOrder_workOrderOperationId_fkey" FOREIGN KEY ("workOrderOperationId") REFERENCES "WorkOrderOperation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReworkOrder_routeVersionId_fkey" FOREIGN KEY ("routeVersionId") REFERENCES "ProcessRouteVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReworkOrder_resultBatchId_fkey" FOREIGN KEY ("resultBatchId") REFERENCES "ProductionBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProductionBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchNo" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "workOrderOperationId" TEXT,
    "skuId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "equipmentId" TEXT,
    "moldId" TEXT,
    "materialLotId" TEXT,
    "shift" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "issuedWeight" REAL,
    "goodQty" INTEGER NOT NULL DEFAULT 0,
    "badQty" INTEGER NOT NULL DEFAULT 0,
    "scrapWeight" REAL,
    "returnWeight" REAL,
    "thisMoldCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT '进行中',
    "confirmedByLeader" BOOLEAN NOT NULL DEFAULT false,
    "leaderConfirmedBy" TEXT,
    "leaderConfirmedAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionBatch_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionBatch_workOrderOperationId_fkey" FOREIGN KEY ("workOrderOperationId") REFERENCES "WorkOrderOperation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductionBatch_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionBatch_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductionBatch_moldId_fkey" FOREIGN KEY ("moldId") REFERENCES "MoldMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductionBatch_materialLotId_fkey" FOREIGN KEY ("materialLotId") REFERENCES "MaterialLot" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ProductionBatch" ("badQty", "batchNo", "confirmedByLeader", "createdAt", "endTime", "equipmentId", "goodQty", "id", "issuedWeight", "leaderConfirmedAt", "leaderConfirmedBy", "materialLotId", "moldId", "note", "operator", "returnWeight", "scrapWeight", "shift", "skuId", "startTime", "status", "thisMoldCount", "type", "workOrderId") SELECT "badQty", "batchNo", "confirmedByLeader", "createdAt", "endTime", "equipmentId", "goodQty", "id", "issuedWeight", "leaderConfirmedAt", "leaderConfirmedBy", "materialLotId", "moldId", "note", "operator", "returnWeight", "scrapWeight", "shift", "skuId", "startTime", "status", "thisMoldCount", "type", "workOrderId" FROM "ProductionBatch";
DROP TABLE "ProductionBatch";
ALTER TABLE "new_ProductionBatch" RENAME TO "ProductionBatch";
CREATE UNIQUE INDEX "ProductionBatch_batchNo_key" ON "ProductionBatch"("batchNo");
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
    "route" TEXT,
    "routeVersionId" TEXT,
    "status" TEXT NOT NULL DEFAULT '未下达',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkOrder_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_planEquipmentId_fkey" FOREIGN KEY ("planEquipmentId") REFERENCES "EquipmentMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_planMoldId_fkey" FOREIGN KEY ("planMoldId") REFERENCES "MoldMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_routeVersionId_fkey" FOREIGN KEY ("routeVersionId") REFERENCES "ProcessRouteVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WorkOrder" ("bomVersion", "createdAt", "id", "no", "note", "planEnd", "planEquipmentId", "planMoldId", "planQty", "planStart", "route", "skuId", "status", "type", "updatedAt") SELECT "bomVersion", "createdAt", "id", "no", "note", "planEnd", "planEquipmentId", "planMoldId", "planQty", "planStart", "route", "skuId", "status", "type", "updatedAt" FROM "WorkOrder";
DROP TABLE "WorkOrder";
ALTER TABLE "new_WorkOrder" RENAME TO "WorkOrder";
CREATE UNIQUE INDEX "WorkOrder_no_key" ON "WorkOrder"("no");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "OperationMaster_code_key" ON "OperationMaster"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessRoute_code_key" ON "ProcessRoute"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessRouteVersion_routeId_version_key" ON "ProcessRouteVersion"("routeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RouteOperation_routeVersionId_sequence_key" ON "RouteOperation"("routeVersionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderOperation_workOrderId_sequence_key" ON "WorkOrderOperation"("workOrderId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "BatchGenealogy_sourceBatchId_targetBatchId_relationType_key" ON "BatchGenealogy"("sourceBatchId", "targetBatchId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "ReworkOrder_no_key" ON "ReworkOrder"("no");
