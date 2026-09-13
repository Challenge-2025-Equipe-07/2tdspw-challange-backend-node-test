-- DropIndex
DROP INDEX "Owner_document_key";

-- CreateIndex
CREATE UNIQUE INDEX "Owner_userId_document_key" ON "Owner"("userId", "document");
