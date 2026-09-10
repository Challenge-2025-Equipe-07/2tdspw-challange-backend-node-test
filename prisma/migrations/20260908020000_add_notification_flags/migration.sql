-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Notification" ADD COLUMN "notifyWeb" BOOLEAN NOT NULL DEFAULT true;
