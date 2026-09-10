-- CreateEnum
CREATE TYPE "SaaSPlan" AS ENUM ('starter', 'growth', 'scale');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "saasPlan" "SaaSPlan" NOT NULL DEFAULT 'starter';
ALTER TABLE "User" ADD COLUMN "saasTutorQuota" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "User" ADD COLUMN "saasMonthlyFee" INTEGER;
