/*
  Warnings:

  - A unique constraint covering the columns `[reply_to_id]` on the table `messages` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "reply_to_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "messages_reply_to_id_key" ON "messages"("reply_to_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
