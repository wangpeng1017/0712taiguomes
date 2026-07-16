-- CreateTable
CREATE TABLE `BomMaster` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `skuId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '启用',
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BomMaster_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BomVersion` (
    `id` VARCHAR(191) NOT NULL,
    `bomId` VARCHAR(191) NOT NULL,
    `version` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '草稿',
    `effectiveFrom` DATETIME(3) NULL,
    `effectiveTo` DATETIME(3) NULL,
    `releasedAt` DATETIME(3) NULL,
    `releasedBy` VARCHAR(191) NULL,
    `changeReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BomVersion_bomId_version_key`(`bomId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BomItem` (
    `id` VARCHAR(191) NOT NULL,
    `bomVersionId` VARCHAR(191) NOT NULL,
    `materialId` VARCHAR(191) NOT NULL,
    `operationSequence` INTEGER NULL,
    `operationCode` VARCHAR(191) NULL,
    `qtyPerBasis` DOUBLE NOT NULL,
    `basisQty` DOUBLE NOT NULL DEFAULT 1000,
    `unit` VARCHAR(191) NOT NULL,
    `lossRate` DOUBLE NOT NULL DEFAULT 0,
    `itemType` VARCHAR(191) NOT NULL DEFAULT '主料',
    `status` VARCHAR(191) NOT NULL DEFAULT '启用',
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BomItem_bomVersionId_operationSequence_idx`(`bomVersionId`, `operationSequence`),
    INDEX `BomItem_materialId_idx`(`materialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BomSubstitute` (
    `id` VARCHAR(191) NOT NULL,
    `bomItemId` VARCHAR(191) NOT NULL,
    `materialId` VARCHAR(191) NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 1,
    `conversionRate` DOUBLE NOT NULL DEFAULT 1,
    `status` VARCHAR(191) NOT NULL DEFAULT '启用',
    `effectiveFrom` DATETIME(3) NULL,
    `effectiveTo` DATETIME(3) NULL,
    `reason` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BomSubstitute_bomItemId_materialId_key`(`bomItemId`, `materialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkOrderMaterialRequirement` (
    `id` VARCHAR(191) NOT NULL,
    `workOrderId` VARCHAR(191) NOT NULL,
    `bomVersionId` VARCHAR(191) NULL,
    `bomItemId` VARCHAR(191) NULL,
    `materialId` VARCHAR(191) NULL,
    `materialCode` VARCHAR(191) NOT NULL,
    `materialName` VARCHAR(191) NOT NULL,
    `operationSequence` INTEGER NULL,
    `operationCode` VARCHAR(191) NULL,
    `operationName` VARCHAR(191) NULL,
    `standardQty` DOUBLE NOT NULL,
    `requiredQty` DOUBLE NOT NULL,
    `issuedQty` DOUBLE NOT NULL DEFAULT 0,
    `consumedQty` DOUBLE NOT NULL DEFAULT 0,
    `unit` VARCHAR(191) NOT NULL,
    `lossRate` DOUBLE NOT NULL DEFAULT 0,
    `itemType` VARCHAR(191) NOT NULL DEFAULT '主料',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkOrderMaterialRequirement_workOrderId_operationSequence_idx`(`workOrderId`, `operationSequence`),
    INDEX `WorkOrderMaterialRequirement_bomVersionId_idx`(`bomVersionId`),
    INDEX `WorkOrderMaterialRequirement_materialId_idx`(`materialId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `WorkOrder` ADD COLUMN `bomVersionId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `BatchMaterialConsumption` ADD COLUMN `workOrderMaterialRequirementId` VARCHAR(191) NULL,
    ADD COLUMN `isSubstitute` BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE `BomMaster` ADD CONSTRAINT `BomMaster_skuId_fkey` FOREIGN KEY (`skuId`) REFERENCES `ProductSku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BomVersion` ADD CONSTRAINT `BomVersion_bomId_fkey` FOREIGN KEY (`bomId`) REFERENCES `BomMaster`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BomItem` ADD CONSTRAINT `BomItem_bomVersionId_fkey` FOREIGN KEY (`bomVersionId`) REFERENCES `BomVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BomItem` ADD CONSTRAINT `BomItem_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `MaterialMaster`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BomSubstitute` ADD CONSTRAINT `BomSubstitute_bomItemId_fkey` FOREIGN KEY (`bomItemId`) REFERENCES `BomItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BomSubstitute` ADD CONSTRAINT `BomSubstitute_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `MaterialMaster`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrder` ADD CONSTRAINT `WorkOrder_bomVersionId_fkey` FOREIGN KEY (`bomVersionId`) REFERENCES `BomVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrderMaterialRequirement` ADD CONSTRAINT `WorkOrderMaterialRequirement_workOrderId_fkey` FOREIGN KEY (`workOrderId`) REFERENCES `WorkOrder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrderMaterialRequirement` ADD CONSTRAINT `WorkOrderMaterialRequirement_bomVersionId_fkey` FOREIGN KEY (`bomVersionId`) REFERENCES `BomVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrderMaterialRequirement` ADD CONSTRAINT `WorkOrderMaterialRequirement_bomItemId_fkey` FOREIGN KEY (`bomItemId`) REFERENCES `BomItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkOrderMaterialRequirement` ADD CONSTRAINT `WorkOrderMaterialRequirement_materialId_fkey` FOREIGN KEY (`materialId`) REFERENCES `MaterialMaster`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BatchMaterialConsumption` ADD CONSTRAINT `BatchMaterialConsumption_workOrderMaterialRequirementId_fkey` FOREIGN KEY (`workOrderMaterialRequirementId`) REFERENCES `WorkOrderMaterialRequirement`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
