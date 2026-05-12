/*
  Warnings:

  - You are about to drop the column `actualPct` on the `DailyReport` table. All the data in the column will be lost.
  - You are about to drop the column `actualPct` on the `Todo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "DailyReport" DROP COLUMN "actualPct";

-- AlterTable
ALTER TABLE "Todo" DROP COLUMN "actualPct";

-- CreateTable
CREATE TABLE "TodoTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TodoTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TodoTemplate_order_idx" ON "TodoTemplate"("order");
