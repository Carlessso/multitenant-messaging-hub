-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "api_key_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_api_key_hash_key" ON "tenants"("api_key_hash");

