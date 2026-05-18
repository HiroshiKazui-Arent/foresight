-- v4.0 reset: weight / dual-checkbox / DailyReport を撤去し actualStartDate / actualEndDate を追加
-- spec.md v4.0 / plans/spec-v4-reset.md S2 参照
-- 冪等性: IF EXISTS / IF NOT EXISTS を全行付与 (migrate reset を 2 回以上回しても安全)

-- 旧 CHECK 制約 (存在すれば) 削除
ALTER TABLE "Todo" DROP CONSTRAINT IF EXISTS "Todo_completed_implies_started";

-- M-03 / M-01 カラム削除 (冪等)
ALTER TABLE "Todo" DROP COLUMN IF EXISTS "started";
ALTER TABLE "Todo" DROP COLUMN IF EXISTS "startedAt";
ALTER TABLE "Todo" DROP COLUMN IF EXISTS "completedAt";
ALTER TABLE "Todo" DROP COLUMN IF EXISTS "completed";
ALTER TABLE "Todo" DROP COLUMN IF EXISTS "weight";

-- v4.0 カラム追加 (冪等)
ALTER TABLE "Todo" ADD COLUMN IF NOT EXISTS "actualStartDate" TIMESTAMP(3);
ALTER TABLE "Todo" ADD COLUMN IF NOT EXISTS "actualEndDate"   TIMESTAMP(3);

-- DailyReport テーブル削除 (冪等、外部キー CASCADE)
DROP TABLE IF EXISTS "DailyReport" CASCADE;
