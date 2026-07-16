-- DropForeignKey
ALTER TABLE `ProductionBatch` DROP FOREIGN KEY `ProductionBatch_equipmentId_fkey`;

-- DropForeignKey
ALTER TABLE `ProductionBatch` DROP FOREIGN KEY `ProductionBatch_moldId_fkey`;

-- DropForeignKey
ALTER TABLE `ProductionBatch` DROP FOREIGN KEY `ProductionBatch_materialLotId_fkey`;

-- AlterTable
ALTER TABLE `WorkOrder` ADD COLUMN `routeVersionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ProductionBatch` ADD COLUMN `workOrderOperationId` VARCHAR(191) NULL,
    MODIFY `equipmentId` VARCHAR(191) NULL,
    MODIFY `moldId` VARCHAR(191) NULL,
    MODIFY `materialLotId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `OperationMaster` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `appliesTo` VARCHAR(191) NOT NULL DEFAULT '通用',
    `workCenter` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '启用',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `OperationMaster_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcessRoute` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `skuId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '启用',
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProcessRoute_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProcessRouteVersion` (
    `id` VARCHAR(191) NOT NULL,
    `routeId` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '草稿',
    `effectiveFrom` DATETIME(3) NULL,
    `effectiveTo` DATETIME(3) NULL,
    `releasedAt` DATETIME(3) NULL,
    `releasedBy` VARCHAR(191) NULL,
    `changeReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ProcessRouteVersion_routeId_version_key`(`routeId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RouteOperation` (
    `id` VARCHAR(191) NOT NULL,
    `routeVersionId` VARCHAR(191) NOT NULL,
    `operationId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `operationCode` VARCHAR(191) NOT NULL,
    `operationName` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `workCenter` VARCHAR(191) NULL,
    `standardCycleSeconds` DOUBLE NULL,
    `setupMinutes` DOUBLE NULL,
    `reportMode` VARCHAR(191) NOT NULL DEFAULT '按批次',
    `requiresEquipment` BOOLEAN NOT NULL DEFAULT false,
    `requiresMold` BOOLEAN NOT NULL DEFAULT false,
    `qualityRequired` BOOLEAN NOT NULL DEFAULT false,
    `isFinal` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT '启用',
    `note` VARCHAR(191) NULL,

    UNIQUE INDEX `RouteOperation_routeVersionId_sequence_key`(`routeVersionId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkOrderOperation` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `routeOperationId` VARCHAR(191) NULL,
    `operationId` VARCHAR(191) NOT NULL,
    `operationCode` VARCHAR(191) NOT NULL,
    `operationName` VARCHAR(191) NOT NULL,
    `operationType` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '等待前序',
    `plannedQty` INTEGER NOT NULL,
    `inputQty` INTEGER NOT NULL DEFAULT 0,
    `goodQty` INTEGER NOT NULL DEFAULT 0,
    `badQty` INTEGER NOT NULL DEFAULT 0,
    `scrapQty` INTEGER NOT NULL DEFAULT 0,
    `transferredQty` INTEGER NOT NULL DEFAULT 0,
    `qualityStatus` VARCHAR(191) NOT NULL DEFAULT '待检',
    `isFinal` BOOLEAN NOT NULL DEFAULT false,
    `requiresEquipment` BOOLEAN NOT NULL DEFAULT false,
    `requiresMold` BOOLEAN NOT NULL DEFAULT false,
    `qualityRequired` BOOLEAN NOT NULL DEFAULT false,
    `reportMode` VARCHAR(191) NOT NULL DEFAULT '按批次',
    `standardCycleSeconds` DOUBLE NULL,
    `workCenter` VARCHAR(191) NULL,
    `planEquipmentId` VARCHAR(191) NULL,
    `planMoldId` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `WorkOrderOperation_workOrderId_sequence_key`(`workOrderId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BatchMaterialConsumption` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `materialLotId` VARCHAR(191) NULL,
    `sourceBatchId` VARCHAR(191) NULL,
    `qty` DOUBLE NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `consumptionType` VARCHAR(191) NOT NULL DEFAULT '主料',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BatchGenealogy` (
    `id` VARCHAR(191) NOT NULL,
    `sourceBatchId` VARCHAR(191) NOT NULL,
    `targetBatchId` VARCHAR(191) NOT NULL,
    `qty` DOUBLE NOT NULL,
    `relationType` VARCHAR(191) NOT NULL DEFAULT '转序',
    `operator` VARCHAR(191) NULL,
    `remark` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BatchGenealogy_sourceBatchId_targetBatchId_relationType_key`(`sourceBatchId`, `targetBatchId`, `relationType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperationQualityResult` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderOperationId` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NULL,
    `inspectionType` VARCHAR(191) NOT NULL DEFAULT '工序检验',
    `result` VARCHAR(191) NOT NULL,
    `sampleQty` INTEGER NULL,
    `qualifiedQty` INTEGER NULL,
    `unqualifiedQty` INTEGER NULL,
    `inspector` VARCHAR(191) NOT NULL,
    `inspectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `valuesJson` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReworkOrder` (
    `id` VARCHAR(191) NOT NULL,
    `no` VARCHAR(191) NOT NULL,
    `sourceBatchId` VARCHAR(191) NOT NULL,
    `workOrderOperationId` VARCHAR(191) NOT NULL,
    `routeVersionId` VARCHAR(191) NOT NULL,
    `resultBatchId` VARCHAR(191) NULL,
    `qty` INTEGER NOT NULL,
    `qualifiedQty` INTEGER NOT NULL DEFAULT 0,
    `scrapQty` INTEGER NOT NULL DEFAULT 0,
    `reason` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '待处理',
    `createdBy` VARCHAR(191) NOT NULL,
    `approvedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    `note` VARCHAR(191) NULL,

    UNIQUE INDEX `ReworkOrder_no_key`(`no`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProcessRoute` ADD CONSTRAINT `ProcessRoute_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `ProductSku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProcessRouteVersion` ADD CONSTRAINT `ProcessRouteVersion_routeId_fkey` FOREIGN KEY (`routeId`) REFERENCES `ProcessRoute`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RouteOperation` ADD CONSTRAINT `RouteOperation_routeVersionId_fkey` FOREIGN KEY (`routeVersionId`) REFERENCES `ProcessRouteVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RouteOperation` ADD CONSTRAINT `RouteOperation_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `OperationMaster`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_routeVersionId_fkey` FOREIGN KEY (`routeVersionId`) REFERENCES `ProcessRouteVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrderOperation` ADD CONSTRAINT `WorkOrderOperation_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrderOperation` ADD CONSTRAINT `WorkOrderOperation_routeOperationId_fkey` FOREIGN KEY (`routeOperationId`) REFERENCES `RouteOperation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrderOperation` ADD CONSTRAINT `WorkOrderOperation_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `OperationMaster`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrderOperation` ADD CONSTRAINT `WorkOrderOperation_planEquipmentId_fkey` FOREIGN KEY (`planEquipmentId`) REFERENCES `EquipmentMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrderOperation` ADD CONSTRAINT `WorkOrderOperation_planMoldId_fkey` FOREIGN KEY (`planMoldId`) REFERENCES `MoldMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionBatch` ADD CONSTRAINT `ProductionBatch_workOrderOperationId_fkey` FOREIGN KEY (`workOrderOperationId`) REFERENCES `WorkOrderOperation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionBatch` ADD CONSTRAINT `ProductionBatch_equipmentId_fkey` FOREIGN KEY (`equipmentId`) REFERENCES `EquipmentMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionBatch` ADD CONSTRAINT `ProductionBatch_moldId_fkey` FOREIGN KEY (`moldId`) REFERENCES `MoldMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductionBatch` ADD CONSTRAINT `ProductionBatch_materialLotId_fkey` FOREIGN KEY (`materialLotId`) REFERENCES `MaterialLot`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchMaterialConsumption` ADD CONSTRAINT `BatchMaterialConsumption_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `ProductionBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchMaterialConsumption` ADD CONSTRAINT `BatchMaterialConsumption_materialLotId_fkey` FOREIGN KEY (`materialLotId`) REFERENCES `MaterialLot`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchMaterialConsumption` ADD CONSTRAINT `BatchMaterialConsumption_sourceBatchId_fkey` FOREIGN KEY (`sourceBatchId`) REFERENCES `ProductionBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchGenealogy` ADD CONSTRAINT `BatchGenealogy_sourceBatchId_fkey` FOREIGN KEY (`sourceBatchId`) REFERENCES `ProductionBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchGenealogy` ADD CONSTRAINT `BatchGenealogy_targetBatchId_fkey` FOREIGN KEY (`targetBatchId`) REFERENCES `ProductionBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationQualityResult` ADD CONSTRAINT `OperationQualityResult_workOrderOperationId_fkey` FOREIGN KEY (`workOrderOperationId`) REFERENCES `WorkOrderOperation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationQualityResult` ADD CONSTRAINT `OperationQualityResult_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `ProductionBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReworkOrder` ADD CONSTRAINT `ReworkOrder_sourceBatchId_fkey` FOREIGN KEY (`sourceBatchId`) REFERENCES `ProductionBatch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReworkOrder` ADD CONSTRAINT `ReworkOrder_workOrderOperationId_fkey` FOREIGN KEY (`workOrderOperationId`) REFERENCES `WorkOrderOperation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReworkOrder` ADD CONSTRAINT `ReworkOrder_routeVersionId_fkey` FOREIGN KEY (`routeVersionId`) REFERENCES `ProcessRouteVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReworkOrder` ADD CONSTRAINT `ReworkOrder_resultBatchId_fkey` FOREIGN KEY (`resultBatchId`) REFERENCES `ProductionBatch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
