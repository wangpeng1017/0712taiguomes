-- CreateTable
CREATE TABLE `ProductSku` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `customerCode` VARCHAR(191) NULL,
    `internalCode` VARCHAR(191) NULL,
    `spec` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'PCS',
    `stdWeight` DOUBLE NULL,
    `isSemiFinished` BOOLEAN NOT NULL DEFAULT false,
    `isFinished` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT '启用',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProductSku_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaterialMaster` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `spec` VARCHAR(191) NULL,
    `materialGrade` VARCHAR(191) NULL,
    `supplier` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'KG',
    `shelfLife` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '启用',
    `thickness` DOUBLE NULL,
    `width` DOUBLE NULL,
    `coilWeight` DOUBLE NULL,
    `surfaceTreatment` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `dryingRequirement` VARCHAR(191) NULL,

    UNIQUE INDEX `MaterialMaster_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EquipmentMaster` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `line` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '可用',
    `capacity` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,

    UNIQUE INDEX `EquipmentMaster_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MoldMaster` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `applicableSkuId` VARCHAR(191) NULL,
    `applicableEquipmentId` VARCHAR(191) NULL,
    `designLife` INTEGER NOT NULL,
    `currentCount` INTEGER NOT NULL DEFAULT 0,
    `maintCycle` INTEGER NOT NULL,
    `warnThreshold` DOUBLE NOT NULL DEFAULT 0.8,
    `lastMaintDate` DATETIME(3) NULL,
    `lastMaintCount` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT '可用',
    `cavityCount` INTEGER NULL,
    `note` VARCHAR(191) NULL,

    UNIQUE INDEX `MoldMaster_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DefectReason` (
    `id` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `appliesTo` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '启用',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkOrder` (
    `id` VARCHAR(191) NOT NULL,
    `no` VARCHAR(191) NOT NULL,
    `skuId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `planQty` INTEGER NOT NULL,
    `planStart` DATETIME(3) NOT NULL,
    `planEnd` DATETIME(3) NOT NULL,
    `planEquipmentId` VARCHAR(191) NULL,
    `planMoldId` VARCHAR(191) NULL,
    `bomVersion` VARCHAR(191) NULL,
    `route` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '未下达',
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorkOrder_no_key`(`no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaterialLot` (
    `id` VARCHAR(191) NOT NULL,
    `lotNo` VARCHAR(191) NOT NULL,
    `supplierLot` VARCHAR(191) NULL,
    `materialId` VARCHAR(191) NOT NULL,
    `qty` DOUBLE NOT NULL,
    `remainingQty` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `inDate` DATETIME(3) NOT NULL,
    `supplier` VARCHAR(191) NULL,
    `inspectStatus` VARCHAR(191) NOT NULL DEFAULT '合格',
    `stockStatus` VARCHAR(191) NOT NULL DEFAULT '可用',
    `warehouse` VARCHAR(191) NULL,

    UNIQUE INDEX `MaterialLot_lotNo_key`(`lotNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaterialIssue` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `materialLotId` VARCHAR(191) NOT NULL,
    `qty` DOUBLE NOT NULL,
    `issuedBy` VARCHAR(191) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `equipmentId` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaterialReturn` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `materialLotId` VARCHAR(191) NOT NULL,
    `qty` DOUBLE NOT NULL,
    `reason` VARCHAR(191) NULL,
    `returnedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `returnedBy` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductionBatch` (
    `id` VARCHAR(191) NOT NULL,
    `batchNo` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `skuId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `equipmentId` VARCHAR(191) NOT NULL,
    `moldId` VARCHAR(191) NOT NULL,
    `materialLotId` VARCHAR(191) NOT NULL,
    `shift` VARCHAR(191) NOT NULL,
    `operator` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NULL,
    `issuedWeight` DOUBLE NULL,
    `goodQty` INTEGER NOT NULL DEFAULT 0,
    `badQty` INTEGER NOT NULL DEFAULT 0,
    `scrapWeight` DOUBLE NULL,
    `returnWeight` DOUBLE NULL,
    `thisMoldCount` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '进行中',
    `confirmedByLeader` BOOLEAN NOT NULL DEFAULT false,
    `leaderConfirmedBy` VARCHAR(191) NULL,
    `leaderConfirmedAt` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProductionBatch_batchNo_key`(`batchNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DefectRecord` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `qty` INTEGER NOT NULL,
    `reasonId` VARCHAR(191) NOT NULL,
    `responsible` VARCHAR(191) NULL,
    `action` VARCHAR(191) NULL,
    `recordedBy` VARCHAR(191) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `note` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockInRecord` (
    `id` VARCHAR(191) NOT NULL,
    `no` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `qty` INTEGER NOT NULL,
    `warehouse` VARCHAR(191) NULL,
    `inBy` VARCHAR(191) NOT NULL,
    `inAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StockInRecord_no_key`(`no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MoldMaintenanceRecord` (
    `id` VARCHAR(191) NOT NULL,
    `moldId` VARCHAR(191) NOT NULL,
    `maintType` VARCHAR(191) NOT NULL,
    `startTime` DATETIME(3) NOT NULL,
    `endTime` DATETIME(3) NULL,
    `person` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NULL,
    `replacedParts` VARCHAR(191) NULL,
    `result` VARCHAR(191) NULL,
    `canContinue` BOOLEAN NOT NULL DEFAULT true,
    `note` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MoldMaster` ADD CONSTRAINT `MoldMaster_applicableSkuId_fkey` FOREIGN KEY (`applicableSkuId`) REFERENCES `ProductSku`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoldMaster` ADD CONSTRAINT `MoldMaster_applicableEquipmentId_fkey` FOREIGN KEY (`applicableEquipmentId`) REFERENCES `EquipmentMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `ProductSku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_planEquipmentId_fkey` FOREIGN KEY (`planEquipmentId`) REFERENCES `EquipmentMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_planMoldId_fkey` FOREIGN KEY (`planMoldId`) REFERENCES `MoldMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaterialLot` ADD CONSTRAINT `MaterialLot_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `MaterialMaster`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaterialIssue` ADD CONSTRAINT `MaterialIssue_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaterialIssue` ADD CONSTRAINT `MaterialIssue_materialLotId_fkey` FOREIGN KEY (`materialLotId`) REFERENCES `MaterialLot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaterialIssue` ADD CONSTRAINT `MaterialIssue_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `EquipmentMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaterialReturn` ADD CONSTRAINT `MaterialReturn_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaterialReturn` ADD CONSTRAINT `MaterialReturn_materialLotId_fkey` FOREIGN KEY (`materialLotId`) REFERENCES `MaterialLot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionBatch` ADD CONSTRAINT `ProductionBatch_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionBatch` ADD CONSTRAINT `ProductionBatch_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `ProductSku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionBatch` ADD CONSTRAINT `ProductionBatch_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `EquipmentMaster`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionBatch` ADD CONSTRAINT `ProductionBatch_moldId_fkey` FOREIGN KEY (`moldId`) REFERENCES `MoldMaster`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionBatch` ADD CONSTRAINT `ProductionBatch_materialLotId_fkey` FOREIGN KEY (`materialLotId`) REFERENCES `MaterialLot`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DefectRecord` ADD CONSTRAINT `DefectRecord_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `ProductionBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DefectRecord` ADD CONSTRAINT `DefectRecord_reasonId_fkey` FOREIGN KEY (`reasonId`) REFERENCES `DefectReason`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockInRecord` ADD CONSTRAINT `StockInRecord_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `ProductionBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MoldMaintenanceRecord` ADD CONSTRAINT `MoldMaintenanceRecord_moldId_fkey` FOREIGN KEY (`moldId`) REFERENCES `MoldMaster`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

