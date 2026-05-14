-- M-03: Todo に started/startedAt/completedAt を追加 + DB CHECK constraint
-- AlterTable
ALTER TABLE "Todo"
  ADD COLUMN "started"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "startedAt"   TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);

-- Backfill: 既存 completed=true の行は started=true に。
-- startedAt / completedAt は推定値 (v3.1 以前の実際の開始/完了日時は不明)
-- spec.md 改訂履歴 M-03 参照
UPDATE "Todo"
   SET "started"     = true,
       "startedAt"   = "createdAt",
       "completedAt" = "updatedAt"
 WHERE "completed" = true;

-- DB CHECK: completed=true は started=true を必須とする
ALTER TABLE "Todo"
  ADD CONSTRAINT "Todo_completed_implies_started"
  CHECK (NOT ("completed" = true AND "started" = false));
