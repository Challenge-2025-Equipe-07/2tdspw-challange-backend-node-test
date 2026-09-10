-- AlterTable
ALTER TABLE "Consulta" ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "aiFedAt" TIMESTAMP(3),
ADD COLUMN     "aiFeedError" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "fromCarePlan" BOOLEAN NOT NULL DEFAULT true;
