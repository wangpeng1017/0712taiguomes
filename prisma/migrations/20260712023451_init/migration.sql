-- CreateTable
CREATE TABLE "ProductSku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "customerCode" TEXT,
    "internalCode" TEXT,
    "spec" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "stdWeight" REAL,
    "isSemiFinished" BOOLEAN NOT NULL DEFAULT false,
    "isFinished" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT '启用',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MaterialMaster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "spec" TEXT,
    "materialGrade" TEXT,
    "supplier" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'KG',
    "shelfLife" TEXT,
    "status" TEXT NOT NULL DEFAULT '启用',
    "thickness" REAL,
    "width" REAL,
    "coilWeight" REAL,
    "surfaceTreatment" TEXT,
    "color" TEXT,
    "dryingRequirement" TEXT
);

-- CreateTable
CREATE TABLE "EquipmentMaster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "line" TEXT,
    "status" TEXT NOT NULL DEFAULT '可用',
    "capacity" TEXT,
    "startDate" DATETIME,
    "note" TEXT
);

-- CreateTable
CREATE TABLE "MoldMaster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "applicableSkuId" TEXT,
    "applicableEquipmentId" TEXT,
    "designLife" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "maintCycle" INTEGER NOT NULL,
    "warnThreshold" REAL NOT NULL DEFAULT 0.8,
    "lastMaintDate" DATETIME,
    "lastMaintCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT '可用',
    "cavityCount" INTEGER,
    "note" TEXT,
    CONSTRAINT "MoldMaster_applicableSkuId_fkey" FOREIGN KEY ("applicableSkuId") REFERENCES "ProductSku" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "MoldMaster_applicableEquipmentId_fkey" FOREIGN KEY ("applicableEquipmentId") REFERENCES "EquipmentMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DefectReason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT NOT NULL,
    "appliesTo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT '启用'
);

-- CreateTable
CREATE TABLE "WorkOrder" (
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
    "status" TEXT NOT NULL DEFAULT '未下达',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkOrder_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_planEquipmentId_fkey" FOREIGN KEY ("planEquipmentId") REFERENCES "EquipmentMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkOrder_planMoldId_fkey" FOREIGN KEY ("planMoldId") REFERENCES "MoldMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialLot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lotNo" TEXT NOT NULL,
    "supplierLot" TEXT,
    "materialId" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "remainingQty" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "inDate" DATETIME NOT NULL,
    "supplier" TEXT,
    "inspectStatus" TEXT NOT NULL DEFAULT '合格',
    "stockStatus" TEXT NOT NULL DEFAULT '可用',
    "warehouse" TEXT,
    CONSTRAINT "MaterialLot_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "MaterialMaster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderId" TEXT NOT NULL,
    "materialLotId" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "equipmentId" TEXT,
    "note" TEXT,
    CONSTRAINT "MaterialIssue_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaterialIssue_materialLotId_fkey" FOREIGN KEY ("materialLotId") REFERENCES "MaterialLot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaterialIssue_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentMaster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaterialReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workOrderId" TEXT NOT NULL,
    "materialLotId" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "reason" TEXT,
    "returnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedBy" TEXT NOT NULL,
    CONSTRAINT "MaterialReturn_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaterialReturn_materialLotId_fkey" FOREIGN KEY ("materialLotId") REFERENCES "MaterialLot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchNo" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "moldId" TEXT NOT NULL,
    "materialLotId" TEXT NOT NULL,
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
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionBatch_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionBatch_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionBatch_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EquipmentMaster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionBatch_moldId_fkey" FOREIGN KEY ("moldId") REFERENCES "MoldMaster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductionBatch_materialLotId_fkey" FOREIGN KEY ("materialLotId") REFERENCES "MaterialLot" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DefectRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "reasonId" TEXT NOT NULL,
    "responsible" TEXT,
    "action" TEXT,
    "recordedBy" TEXT NOT NULL,
    "recordedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "DefectRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DefectRecord_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "DefectReason" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockInRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "no" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "warehouse" TEXT,
    "inBy" TEXT NOT NULL,
    "inAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockInRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MoldMaintenanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moldId" TEXT NOT NULL,
    "maintType" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "person" TEXT NOT NULL,
    "content" TEXT,
    "replacedParts" TEXT,
    "result" TEXT,
    "canContinue" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    CONSTRAINT "MoldMaintenanceRecord_moldId_fkey" FOREIGN KEY ("moldId") REFERENCES "MoldMaster" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductSku_code_key" ON "ProductSku"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialMaster_code_key" ON "MaterialMaster"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentMaster_code_key" ON "EquipmentMaster"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MoldMaster_code_key" ON "MoldMaster"("code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_no_key" ON "WorkOrder"("no");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialLot_lotNo_key" ON "MaterialLot"("lotNo");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionBatch_batchNo_key" ON "ProductionBatch"("batchNo");

-- CreateIndex
CREATE UNIQUE INDEX "StockInRecord_no_key" ON "StockInRecord"("no");
