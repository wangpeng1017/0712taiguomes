-- AlterTable
ALTER TABLE "ProductionBatch" ADD COLUMN "leaderConfirmedAt" DATETIME;
ALTER TABLE "ProductionBatch" ADD COLUMN "leaderConfirmedBy" TEXT;
