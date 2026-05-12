# Plan: fix-all-tests

**目的:** Vitest 単体テスト + Playwright E2E テストをすべてエラーなし状態にする。  
エラー発生時は「fix → test」を繰り返し、最終的に全テストが green になるまで続ける。

**ブランチ戦略:** develop ブランチ上で直接作業（フィーチャーブランチ不要）。  
完了後は `commit-push` スキルで develop に push する。

---

## 前提情報（コールド実行エージェント向け）

| 項目                   | 値                                                                          |
| ---------------------- | --------------------------------------------------------------------------- |
| プロジェクトルート     | `C:\develop\foresight`                                                      |
| テスト(単体)           | `npm test` — Vitest, 対象 `src/**/*.test.ts`                                |
| テスト(E2E)            | `npm run e2e` — Playwright, 対象 `e2e/**/*.spec.ts`                         |
| 型チェック             | `npm run typecheck`                                                         |
| Lint                   | `npm run lint`                                                              |
| E2E 前提: 開発サーバー | `docker compose up -d` でサービス起動                                       |
| E2E 前提: DBシード     | `npm run db:seed` (admin@example.com / password123)                         |
| E2E 認証               | `e2e/global.setup.ts` が `/login` でログイン → `e2e/.auth/user.json` に保存 |

**重要制約:**

- `src/lib/auth.config.ts` は Edge runtime 専用 (Prisma/bcrypt 不可)
- `src/lib/auth.ts` は Node.js runtime 専用
- 仕様の単一情報源は `docs/spec.md`。設計判断は必ず参照
- コードスタイル: セミコロン無し、シングルクォート、`printWidth: 100`

---

## Step 1: 単体テスト (Vitest) — run & fix ループ

**ブランチ:** develop (直接作業)  
**モデル:** default  
**依存:** なし  
**並列実行:** 不可 (逐次)

### コンテキスト

前回セッションで以下のテストファイルが修正された (未コミット):

- `src/lib/__tests__/daily-report.test.ts`
- `src/lib/__tests__/forecast.test.ts`
- `src/lib/__tests__/invitation.test.ts`
- `src/lib/__tests__/progress.test.ts`
- `src/lib/__tests__/todo.test.ts`

また新規テストとして以下のファイルが実装された (forecast.test.ts の buildDashboardData ケースが多数追加)。

### タスク

1. `npm test` を実行して出力を確認する
2. 失敗しているテストケースを特定する
3. 対応する実装ファイル (`src/lib/*.ts`) のバグを修正する
   - テスト自体の期待値が実装と一致しない場合は `docs/spec.md` を参照して正しい方を修正する
4. 再度 `npm test` を実行する
5. 全テストが PASS するまで 1〜4 を繰り返す

### 検証コマンド

```bash
npm test
```

### 完了条件

- `npm test` の出力に失敗テストが 0 件
- `Test Files: X passed` のみ表示される

---

## Step 2: 型チェック & Lint — fix ループ

**ブランチ:** develop  
**モデル:** default  
**依存:** Step 1 完了後  
**並列実行:** 不可

### コンテキスト

Step 1 で実装を修正した後、型エラーや lint エラーが混入している可能性がある。

### タスク

1. `npm run typecheck` を実行してエラーを確認する
2. TypeScript 型エラーを修正する
3. `npm run lint` を実行して ESLint エラーを確認する
4. Lint エラーを修正する (`npm run lint:fix` も活用可)
5. 再度 `npm run typecheck && npm run lint` を実行する
6. 両方がエラーゼロになるまで繰り返す

### 検証コマンド

```bash
npm run typecheck
npm run lint
```

### 完了条件

- `npm run typecheck` がエラーゼロ終了
- `npm run lint` がエラーゼロ終了

---

## Step 3: E2E 環境セットアップ

**ブランチ:** develop  
**モデル:** default  
**依存:** Step 2 完了後  
**並列実行:** 不可

### コンテキスト

Playwright は `http://localhost:3000` に接続する。`playwright.config.ts` の `webServer` 設定で `npm run dev` が自動起動されるが、DB (PostgreSQL) は Docker で別途稼動させる必要がある。  
`global.setup.ts` がログインして `e2e/.auth/user.json` を作成する。E2E テストは seed データ「フォーサイト開発プロジェクト(サンプル)」が存在することを前提にする。

### タスク

1. Docker Compose でサービスが起動しているか確認する
   ```
   docker compose ps
   ```
2. postgres サービスが起動していなければ起動する
   ```
   docker compose up -d postgres
   ```
3. DB に seed データが投入されているか確認し、必要なら実行する
   ```
   npm run db:seed
   ```
4. `e2e/.auth/` ディレクトリが存在するか確認する (存在しなければ global.setup が作成するので不要)
5. Playwright ブラウザが install されているか確認する
   ```
   npx playwright install --with-deps chromium
   ```

### 検証コマンド

```bash
docker compose ps
npm run db:seed
```

### 完了条件

- PostgreSQL が稼動中
- seed データが投入済み
- Playwright chromium ブラウザが利用可能

---

## Step 4: E2E テスト (Playwright) — run & fix ループ

**ブランチ:** develop  
**モデル:** default  
**依存:** Step 3 完了後  
**並列実行:** 不可

### コンテキスト

前回セッションで以下の E2E スペックが新規作成された (未コミット):

- `e2e/dashboard.spec.ts` — 予兆検知ダッシュボード (6テスト)
- `e2e/task-detail.spec.ts` — タスク詳細 V3 (8テスト)
- `e2e/daily-report.spec.ts` — 日報入力 (7テスト)

既存スペック:

- `e2e/auth.spec.ts` — 認証
- `e2e/projects.spec.ts` — プロジェクト一覧
- `e2e/timeline.spec.ts` — タイムライン V2

E2E テストが失敗する主な原因パターン:

1. UI コンポーネントのセレクタ不一致 (aria-label, テキスト, URL パターン)
2. サーバーアクションのバグ
3. ページコンポーネントの実装漏れ
4. seed データとテスト期待値の不一致

### タスク

1. `npm run e2e` を実行して出力を確認する
2. 失敗しているテストスイートとテストケースを特定する
3. 失敗原因を調査する:
   - スクリーンショット: `playwright-report/` を確認
   - 関連する実装ファイル: `src/app/`, `src/components/`, `src/server/actions/`
4. 実装またはテストスペックを修正する
   - **実装が仕様と合っていない場合** → 実装を修正 (docs/spec.md 参照)
   - **テストのセレクタが実装と合っていない場合** → テストを修正
   - **seed データと期待値が合っていない場合** → テストの期待値を修正
5. 再度 `npm run e2e` を実行する
6. 全テストが PASS するまで 1〜5 を繰り返す

### よく使う調査コマンド

```bash
# 特定スペックだけ実行
npm run e2e -- e2e/dashboard.spec.ts

# 失敗時のレポートを確認
npx playwright show-report

# ヘッドありでデバッグ
npm run e2e:debug
```

### 完了条件

- `npm run e2e` の出力に失敗テストが 0 件
- `21 passed` (または全スペックの全テスト passed) と表示される

---

## Step 5: 最終検証 & コミット

**ブランチ:** develop  
**モデル:** default  
**依存:** Step 4 完了後

### タスク

1. 全チェックをシーケンシャルに実行して最終確認する:
   ```bash
   npm run lint
   npm run typecheck
   npm test
   npm run e2e
   ```
2. 全て green であることを確認する
3. `commit-push` スキルを使って変更をコミット & push する
   - コミット対象: 修正した実装ファイル + テストファイル
   - コミットメッセージ例: `test: 全テスト green — 単体テスト修正 + E2E スペック追加`

### 完了条件

- lint / typecheck / test / e2e がすべてエラーゼロ
- develop ブランチに push 済み

---

## ロールバック手順

各ステップで問題が解決しない場合:

1. `git diff` で変更内容を確認する
2. `git stash` で変更を一時退避して原因を切り分ける
3. `docs/spec.md` の関連節を再読して設計意図を確認する
4. 1ファイルずつ変更を戻しながら問題を特定する

---

## 改訂履歴

| 日付       | 内容     |
| ---------- | -------- |
| 2026-05-13 | 初版作成 |
