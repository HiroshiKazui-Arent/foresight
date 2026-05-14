# テスト完了基準チェックリスト

`docs/test-spec.md` v1.1 の 12 節に基づく完了基準。

---

## Phase 1 完了基準 (12.1)

### 自動テスト

- [ ] P0 テスト全件パス (`npm test` + `npm run test:integration`)
  - [ ] TC-PROG-001, 007 (calcScheduledPct exact value)
  - [ ] TC-DIFF-001〜003 (calcDaysDeviation exact value)
  - [ ] TC-AGG-005 (ゼロ除算ガード)
  - [ ] TC-CHAIN-001〜003 (遅延伝播)
  - [ ] TC-AUTH-004 (middleware.ts Prisma/bcrypt 不使用)
  - [ ] TC-AUTHZ-004 (Server Action 認証チェック)
  - [ ] TC-ENV-001 (.env.example 必須キー)
  - [ ] TC-INV-006 (randomBytes エントロピー)
  - [ ] TC-DATA-001〜006, 010〜011 (DB 制約・カスケード)
  - [ ] TC-MODEL-001〜007 (スキーマ制約)
  - [ ] TC-AUTH-001〜003 (JWT セッション確認)
  - [ ] TC-A1-007, 008 (passwordHash 保護)
  - [ ] TC-AUTHZ-001〜002 (非メンバー拒否)
  - [ ] TC-INV-001, 003〜005b (招待フロー DB)
  - [ ] TC-A2-006〜009 (招待受諾詳細)
  - [ ] TC-WEIGHT-008〜011 (重み管理)
  - [ ] TC-TPL-001 (TodoTemplate シードデータ)
  - [ ] TC-I1-006 (日報 actualPct 変化)
- [ ] CI (lint + typecheck + test + test:integration + build) グリーン
- [ ] E2E テスト全件パス (`npx playwright test`)
  - [ ] TC-A1-001〜006 (認証画面)
  - [ ] TC-A2-001〜005 (招待受諾画面)
  - [ ] TC-A3-001, 003, 005, 006 (プロジェクト一覧)
  - [ ] TC-A4-001, 003, 005, 006 (プロジェクト設定)
  - [ ] TC-A5-001〜004 (ユーザー管理)
  - [ ] TC-INV-002 (招待リンク形式)
  - [ ] TC-AUTHZ-003 (未認証アクセス)

### 手動確認

- [ ] 仕様書 11 節サンプルデータ投入後、画面上の進捗%/状態/日数ピルが手計算と一致

---

## Phase 2 完了基準 (12.2)

### 自動テスト

- [ ] V2 (タイムライン) P0/P1 テスト全件パス
  - [ ] TC-V2-001, 002 (タイムライン表示)
  - [ ] TC-V2-003 (P2 — 努力目標)
- [ ] V3 (タスク詳細) P0/P1 テスト全件パス
  - [ ] TC-V3-001〜003 (タスク詳細CRUD)
  - [ ] TC-V3-004 (P1 ボトルネック警告)
- [ ] Phase 1 回帰テスト全件パス

---

## Phase 3 完了基準 (12.3)

### 自動テスト

- [ ] V4 (予兆検知ダッシュボード) P0 テスト全件パス
  - [ ] TC-V4-001〜003 (ダッシュボード表示)
  - [ ] TC-V4-004 (P2 空状態 — 努力目標)
- [ ] TC-CHAIN-001〜003 (遅延伝播: Step 1 でカバー済み)

### 手動確認

- [ ] ボトルネック警告の強調表示を確認
- [ ] 推奨アクション文字列の内容確認

---

## 非機能要件の手動確認 (TC-NFR-002〜004)

- [ ] TC-NFR-002: ページ遷移が 2 秒以内
- [ ] TC-NFR-003: モバイルサイズ (375px) での表示崩れなし
- [ ] TC-NFR-004: Lighthouse アクセシビリティスコア 80 以上

---

## スコープ外 (TC-CHAIN-004)

TC-CHAIN-004 (Milestone 衝突検出) は `src/lib/forecast.ts` に実装がないため、
機能実装 PR と同時に追加する。本チェックリストのスコープ外。
