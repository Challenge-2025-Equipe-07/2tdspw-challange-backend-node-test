-- CreateTable
CREATE TABLE "Consulta" (
    "id" TEXT NOT NULL,
    "petId" TEXT NOT NULL,
    "resumo" TEXT NOT NULL DEFAULT '',
    "diagnostico" TEXT NOT NULL DEFAULT '',
    "prescription" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exams" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consulta_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Consulta" ADD CONSTRAINT "Consulta_petId_fkey" FOREIGN KEY ("petId") REFERENCES "Pet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
