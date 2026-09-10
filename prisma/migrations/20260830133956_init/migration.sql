-- CreateEnum
CREATE TYPE "PetSex" AS ENUM ('M', 'F');

-- CreateEnum
CREATE TYPE "PlanRecurrency" AS ENUM ('single', 'recurrent');

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "document" TEXT NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT NOT NULL,
    "sex" "PetSex" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "age" INTEGER NOT NULL,
    "isCastrated" BOOLEAN NOT NULL,
    "species" TEXT NOT NULL DEFAULT '',
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Pet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePlan" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "petId" TEXT NOT NULL,

    CONSTRAINT "CarePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarePlanItem" (
    "id" TEXT NOT NULL,
    "planItemName" TEXT NOT NULL,
    "planRecurrency" "PlanRecurrency" NOT NULL,
    "planRecurrencyRate" INTEGER,
    "planDurationInMonths" INTEGER NOT NULL,
    "notifyWhatsapp" BOOLEAN NOT NULL,
    "notifyWeb" BOOLEAN NOT NULL,
    "carePlanId" TEXT NOT NULL,

    CONSTRAINT "CarePlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Owner_document_key" ON "Owner"("document");

-- AddForeignKey
ALTER TABLE "Pet" ADD CONSTRAINT "Pet_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlan" ADD CONSTRAINT "CarePlan_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarePlanItem" ADD CONSTRAINT "CarePlanItem_carePlanId_fkey" FOREIGN KEY ("carePlanId") REFERENCES "CarePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
