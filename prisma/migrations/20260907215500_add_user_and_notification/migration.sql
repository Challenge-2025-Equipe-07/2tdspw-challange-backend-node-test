-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "appointmentDateTime" TIMESTAMP(3) NOT NULL,
    "appointmentName" TEXT NOT NULL,
    "appointmentPrice" INTEGER,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Existing owners belong to the local demo vet until they are re-seeded.
INSERT INTO "User" ("id", "userName", "userEmail")
VALUES ('seed-vet-demo', 'Vet Demo', 'vet.demo@email.com');

-- AlterTable
ALTER TABLE "Owner" ADD COLUMN "userId" TEXT NOT NULL DEFAULT 'seed-vet-demo';

ALTER TABLE "Owner" ALTER COLUMN "userId" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Owner" ADD CONSTRAINT "Owner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
