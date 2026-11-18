/*
  Warnings:

  - Changed the type of `channel` on the `conversations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `direction` on the `messages` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "channel" AS ENUM ('whatsapp', 'instagram');

-- CreateEnum
CREATE TYPE "direction" AS ENUM ('inbound', 'outbound');

-- AlterTable
ALTER TABLE "conversations" DROP COLUMN "channel",
ADD COLUMN     "channel" "channel" NOT NULL;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "direction",
ADD COLUMN     "direction" "direction" NOT NULL;

-- DropEnum
DROP TYPE "Channel";

-- DropEnum
DROP TYPE "Direction";

-- CreateIndex
CREATE UNIQUE INDEX "conversations_tenant_id_channel_contact_id_key" ON "conversations"("tenant_id", "channel", "contact_id");
