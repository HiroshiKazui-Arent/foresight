# テスト仕様書実装計画 — `docs/test-spec.md` v1.1 全カバレッジ

**目的:** `docs/test-spec.md` v1.1 に定義された P0/P1 テストケースを Vitest(単体・静的・統合) と Playwright (E2E) で実装し、仕様書 12 節の完了基準を満たす。

**仕様の単一情報源:** `docs/test-spec.md` v1.1 (Phase 0〜3 全機能)

**前提:**

- Phase 0〜3 の機能実装は main に存在する (全画面・全 Server Action 実装済み)
- 単体テスト/E2E のフレームワーク (Vitest + Playwright) は設定済み
- 統合テスト用 postgres は `docker compose up -d postgres` で起動可
- 既存の単体テストで部分的にカバー済みのケースは追記で対応する
- **ローカル環境は Windows/PowerShell、CI は ubuntu-latest (GitHub Actions)**

**ブランチ戦略:** 各ステップを独立した feature ブランチで実施 → main へ PR  
**注意:** PowerShell では `;` でコマンドを繋ぐ(`&&` 不可)。CI YAML は Linux bash 構文で記述。

**既知の制約 (確認済み):**

- `C-4 (確認済み)`: `auth.ts` が `strategy: 'jwt'` のため Session テーブルにレコードは作られない。TC-AUTH-001/002 は cookie ベースで実装する(Step 4 参照)。
- `C-2`: TC-CHAIN-004(Milestone 衝突検出)は `src/lib/forecast.ts` に実装がなく、本計画のスコープ外(「全機能実装済み」前提に反するため)。別 PR で機能実装と同時に追加する。
- `M-1 (確認済み)`: TC-PROG-007 の正しい期待値は **50%**。Step 1 実装時に `docs/test-spec.md` の TC-PROG-007 期待値を 50% に修正すること。

---

## ステップ一覧と依存関係

```
Step 1 ─────────────────────────────┐
Step 2 ─────────────────────────────┤
Step 3 ─→ Step 4 ───────────────────┼─→ Step 8
          └─→ Step 5 ───────────────┤
Step 6 ─→ Step 7 ───────────────────┘
```

| Step | 内容                           | 依存     | 並列可        |
| ---- | ------------------------------ | -------- | ------------- |
| 1    | P0 計算ロジック単体テスト補完  | なし     | 2,3,6 と並列  |
| 2    | 静的検査テスト                 | なし     | 1,3,6 と並列  |
| 3    | 統合テスト基盤 + DB 制約テスト | なし     | 1,2,6 と並列  |
| 4    | 認証・認可・招待 統合テスト    | Step 3   | Step 5 と並列 |
| 5    | ToDo・重み・日報 統合テスト    | Step 3   | Step 4 と並列 |
| 6    | Phase 1 E2E 拡充               | なし     | 1,2,3 と並列  |
| 7    | ビュー E2E (V1〜V4)            | Step 6   | —             |
| 8    | CI 全グリーン + 完了基準確認   | 全 Steps | —             |

---

## Step 1 — P0 計算ロジック単体テスト補完

**ブランチ:** `feat/tests-step1-unit-logic`  
**目的:** 仕様書 4 節テーブルの exact value を検証するテーブル駆動テストを追加する。現状の `progress.test.ts` / `forecast.test.ts` は概念的なカバーのみで、仕様テーブルの具体値が欠けている。

### コンテキスト

- `src/lib/__tests__/progress.test.ts` に `calcScheduledPct`, `calcDaysDeviation`, `calcStatus` のテストが存在するが、仕様書 4.1〜4.3 の具体値(TC-PROG-001, TC-DIFF-001〜003)は未テスト
- `calcMilestoneActualPct` のゼロ除算ガード(TC-AGG-005)は未確認
- 連鎖予測(TC-CHAIN-001〜003)は `buildDashboardData` 間接テストのみで、単独の伝播検証なし
- TC-CHAIN-004 は `forecast.ts` に実装なし → **本ステップのスコープ外**(前提の「制約 C-2」参照)

### タスクリスト

1. **`src/lib/__tests__/progress.test.ts` に追記:**

   ```
   TC-PROG-001: calcScheduledPct('2026-04-01', '2026-04-30', '2026-04-15') → ~48.3%
   TC-PROG-007: 年跨ぎシナリオ(start=12/31, end=01/02, today=01/01)で正しく計算される
               ※実装値が仕様記載の ~33.3% と一致するか verify してから期待値を確定すること
   TC-DIFF-001: calcDaysDeviation(44, 83, 30) → ~-11.7 (toBeCloseTo)
   TC-DIFF-002: calcDaysDeviation(50, 50, 30) → 0
   TC-DIFF-003: calcDaysDeviation(50, 30, 30) → +6
   TC-AGG-005: calcMilestoneActualPct([{actualPct:80, startDate:同日, endDate:同日}]) → 0(ゼロ除算回避)
   ```

2. **`src/lib/__tests__/forecast.test.ts` に追記 (TC-CHAIN-001〜004):**
   ```
   TC-CHAIN-001: 未完了 overdue ToDo を含む Task で calcCompletionDate が今日以降を返す(遅延伝播)
   TC-CHAIN-002: buildDashboardData で Task スリップが Milestone の completionDate に反映される
               → warningMilestone に含まれる Task の completionDate が milestone.endDate を超えることを検証
   TC-CHAIN-003: buildDashboardData で Milestone スリップが Project の completionDate に反映される
               → project.slipDays > 0 かつ completionDate > project.endDate を検証
   TC-CHAIN-004 は forecast.ts に実装なし → スコープ外(前提の制約 C-2 参照)
   ```

   - 既存の `makeTodo/makeTask/makeMilestone/makeProject` ヘルパーを再利用
   - `vi.setSystemTime()` は使わず直接 `today` 引数で制御
   - `buildDashboardData` は `today` を引数に取るのでシステム時刻固定不要

### 検証コマンド

```powershell
npm test -- progress.test.ts
npm test -- forecast.test.ts
```

### 終了基準

- 追加した全テストが green
- `npm test` 全体が green (既存テストの回帰なし)

---

## Step 2 — 静的検査テスト

**ブランチ:** `feat/tests-step2-static-checks`  
**目的:** ファイル内容を grep/read して設計不変条件を CI で自動検証する。実装者が誤った import を追加したときに即座に検出できる。

### コンテキスト

対象テスト ID:

- TC-AUTH-004: `middleware.ts` が `prisma` / `bcrypt` を import していないこと
- TC-AUTHZ-004: 全 Server Action ファイルの export async function が必ず `auth()` 呼び出しを含むこと
- TC-ENV-001: `.env.example` に `AUTH_SECRET`, `DATABASE_URL`, `AUTH_TRUST_HOST` が定義されていること
- TC-INV-006: `crypto.randomBytes` の呼び出し引数が十分なエントロピー(32 bytes以上)を持つこと
- TC-MODEL-008: CI での `prisma migrate status` チェック(本 Vitest ファイルでは git diff を確認)

### タスクリスト

1. **`src/lib/__tests__/static-checks.test.ts` を新規作成:**

```typescript
// Node.js の fs/path を使って実ファイルを read し assert する
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '../../../..')

describe('TC-AUTH-004: middleware.ts が Prisma/bcrypt を import しない', () => {
  it('middleware.ts に prisma の import が存在しない', () => {
    const src = readFileSync(resolve(root, 'src/middleware.ts'), 'utf-8')
    expect(src).not.toMatch(/from ['"]@\/lib\/prisma['"]/)
    expect(src).not.toMatch(/from ['"]@prisma\/client['"]/)
  })
  it('middleware.ts に bcrypt の import が存在しない', () => {
    const src = readFileSync(resolve(root, 'src/middleware.ts'), 'utf-8')
    expect(src).not.toMatch(/bcrypt/)
  })
})

describe('TC-AUTHZ-004: Server Action が auth() を呼び出す', () => {
  // src/server/actions/ 配下の全 .ts ファイルを読み込み
  // 各ファイルに auth() の呼び出しが存在することを確認
  // 注: 認証不要の public action は除外リストに明示する
  it('project.ts に auth() 呼び出しが存在する', () => { ... })
  it('invitation.ts に auth() 呼び出しが存在する', () => { ... })
  // ... 各アクションファイル
})

describe('TC-ENV-001: .env.example に必須キーが存在する', () => {
  it('AUTH_SECRET が定義されている', () => {
    const env = readFileSync(resolve(root, '.env.example'), 'utf-8')
    expect(env).toMatch(/^AUTH_SECRET=/m)
  })
  it('DATABASE_URL が定義されている', () => { ... })
  it('AUTH_TRUST_HOST が定義されている', () => { ... })
})

describe('TC-INV-006: 招待トークンのエントロピー確認', () => {
  it('invitation.ts の randomBytes 引数が 32 以上', () => {
    const src = readFileSync(resolve(root, 'src/server/actions/invitation.ts'), 'utf-8')
    // randomBytes(N) の N >= 32 を正規表現で確認
    const match = src.match(/randomBytes\((\d+)\)/)
    expect(match).not.toBeNull()
    expect(parseInt(match![1])).toBeGreaterThanOrEqual(32)
  })
})
```

2. TC-MODEL-008 は `npm run db:generate` 後に `git diff --name-only prisma/` が空であることを CI で確認する。  
   CI (`ci.yml`) に以下を追加 (Step 8 で確認):
   ```yaml
   - name: Check migration drift
     run: |
       npx prisma generate
       git diff --exit-code prisma/
   ```

### 検証コマンド

```powershell
npm test -- static-checks.test.ts
```

### 終了基準

- 全 static-checks テストが green
- `npm test` 全体が green

---

## Step 3 — 統合テスト基盤 + DB 制約テスト

**ブランチ:** `feat/tests-step3-integration-setup`  
**目的:** 実 DB を使う統合テストの基盤を構築し、DB制約・データモデル整合性(TC-DATA, TC-MODEL)を検証する。

### コンテキスト

- 現在の Vitest テストは全て `vi.mock('@/lib/prisma')` でモック化されている
- 統合テストでは実 postgres DB が必要(docker compose の `postgres` サービスを使用)
- `DATABASE_URL` に `?schema=test` を追加したテスト用スキーマを使う、またはテスト用 DB 名を使う
- 各テストで `TRUNCATE ... CASCADE` を実行してデータをクリーンにする

### タスクリスト

0. **`vitest.config.ts` を更新 (C-1 修正 — 最初に行うこと):**
   既存 `vitest.config.ts` の `exclude` に `'**/__tests__/integration/**'` を追加して、
   `npm test` が統合テストを実行しないようにする。

   ```typescript
   exclude: ['**/node_modules/**', '**/e2e/**', '**/__tests__/integration/**']
   ```

1. **`vitest.integration.config.ts` を新規作成:**

   ```typescript
   import { defineConfig } from 'vitest/config'
   import { resolve } from 'path'

   export default defineConfig({
     test: {
       environment: 'node',
       include: ['src/**/__tests__/integration/**/*.test.ts'],
       setupFiles: ['src/lib/__tests__/integration/setup.ts'],
       testTimeout: 30000,
       pool: 'forks', // DB 接続の競合を避けるため
       poolOptions: { forks: { singleFork: true } }, // 直列実行
     },
     resolve: {
       alias: { '@': resolve(__dirname, './src') },
     },
   })
   ```

2. **`package.json` に統合テストスクリプトを追加:**

   ```json
   "test:integration": "vitest run --config vitest.integration.config.ts"
   ```

   環境変数 `TEST_DATABASE_URL` が必要。`.env.example` にも追加。

3. **`src/lib/__tests__/integration/setup.ts` を新規作成:**

   ```typescript
   import { PrismaClient } from '@prisma/client'
   import { afterAll, beforeAll, beforeEach } from 'vitest'

   const prisma = new PrismaClient({
     datasources: { db: { url: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL } },
   })

   export { prisma }

   // 各テスト前に全テーブルをクリア(CASCADE で FK 順序を気にしない)
   // ※ テーブル追加時はこのリストを更新すること (Step 8 の CI チェックでも確認)
   export async function truncateAll() {
     await prisma.$executeRawUnsafe(
       'TRUNCATE "DailyReport","Todo","Task","Milestone","ProjectMember","Project",' +
         '"Invitation","Session","Account","User","TodoTemplate","VerificationToken" ' +
         'RESTART IDENTITY CASCADE',
     )
   }

   beforeAll(async () => {
     await prisma.$connect()
   })
   afterAll(async () => {
     await prisma.$disconnect()
   })
   beforeEach(async () => {
     await truncateAll()
   })
   ```

4. **`src/lib/__tests__/integration/db-constraints.test.ts` を新規作成:**

   **対象テスト ID: TC-DATA-001〜006, TC-DATA-010〜011, TC-MODEL-001〜007**

   ```typescript
   // TC-DATA-001: Milestone は有効な projectId がないと作成不可 (FK違反)
   // TC-DATA-002: Project 削除で Milestone/Task/Todo がカスケード削除される
   // TC-DATA-003: Milestone 削除で Task が全件削除される
   // TC-DATA-004: Task 削除で Todo が全件削除される
   // TC-DATA-005: User 削除で ProjectMember がカスケード削除される
   // TC-DATA-006: (projectId, userId) の ProjectMember 重複は不可
   //
   // TC-DATA-010: Todo の completed のみ直接更新可能を検証
   //              (Task/Milestone/Project に直接 actualPct 相当フィールドがないことを確認)
   // TC-DATA-011: Todo.completed 更新後、Server Action 経由で Task 実績% が再計算される
   //
   // TC-MODEL-001: User.email は一意
   // TC-MODEL-002: Invitation.token は一意
   // TC-MODEL-003: Session.sessionToken は一意
   // TC-MODEL-004: ProjectMember(projectId,userId) 複合一意
   // TC-MODEL-005: VerificationToken(identifier,token) 複合一意
   // TC-MODEL-006: Todo.weight の合計が 100 であることをアプリ層で保証
   // TC-MODEL-007: Task.startDate <= Task.endDate の制約(アプリ層バリデーション)
   ```

   - 各テストは `prisma` を直接使って DB操作し、制約違反を confirm する
   - TC-MODEL-006/007 は Server Action のバリデーションを実際に呼び出して確認

### 検証コマンド

```powershell
# postgres が起動していること前提
docker compose up -d postgres
$env:TEST_DATABASE_URL = "postgresql://postgres:password@localhost:5432/foresight_test"
npx prisma db push --schema=prisma/schema.prisma  # テストDBにスキーマ適用
npm run test:integration
```

### 終了基準

- `npm run test:integration` が全 green
- 既存 `npm test` が green (回帰なし)

---

## Step 4 — 認証・認可・招待 統合テスト

**ブランチ:** `feat/tests-step4-integration-auth`  
**前提:** Step 3 の基盤が存在すること

**目的:** 実 DB を使って認証フロー・セッション管理・招待フローの整合性を検証する。

### コンテキスト (C-4 対応)

**確認済み:** `src/lib/auth.ts` が `session: { strategy: 'jwt' }` を使用しているため、Session テーブルにはレコードが作られない。TC-AUTH-001/002 は以下の方針で実装する:

- TC-AUTH-001 → サインイン後に `nextauth.session-token` cookie が存在することを確認
- TC-AUTH-002 → サインアウト後に当該 cookie が消えることを確認
- TC-AUTH-003 → `jwtDecoder` で `exp` が過去に設定された JWT を使い、`/api/auth/session` が空を返すことを確認

現在 `invitation.test.ts` はモックベース。実 DB では:

- bcrypt ハッシュが実際に DB に保存されるか
- Session テーブルにレコードが作成されるか
- 招待受諾後 ProjectMember が正しく作成されるか

### タスクリスト

1. **`src/lib/__tests__/integration/auth-authz.test.ts` を新規作成:**

   **対象テスト ID: TC-AUTH-001〜003, TC-AUTHZ-001〜002, TC-A1-007, TC-A1-008**

   ```typescript
   // TC-AUTH-001: サインイン後に Session テーブルにレコードが作成される
   //   → signIn を呼び出し、Session テーブルを直接 prisma で select して確認
   // TC-AUTH-002: サインアウト後に Session レコードが削除される
   // TC-AUTH-003: 期限切れ Session.expires < now のセッションが無効扱いになる
   //   → Session.expires を過去に設定し /api/auth/session を fetch して確認
   //
   // TC-A1-007: User.passwordHash が bcrypt 形式で格納される(平文でない)
   //   → acceptInvitation を実行後、User を prisma で取得し passwordHash が $2b$ で始まることを確認
   // TC-A1-008: passwordHash が Server Action の戻り値に含まれない
   //   → getAllUsers の戻り値を確認
   //
   // TC-AUTHZ-001: ProjectMember でないユーザーが getProject を呼ぶと 404
   // TC-AUTHZ-002: ProjectMember でないユーザーが createMilestone 等を呼ぶと拒否
   ```

2. **`src/lib/__tests__/integration/invitation.test.ts` を新規作成:**

   **対象テスト ID: TC-A2-006〜009, TC-INV-001〜006**

   ```typescript
   // TC-INV-001: createInvitation が Invitation レコードを作成し token がランダム、expiresAt が7日後
   // TC-INV-003: projectId 指定の招待受諾で ProjectMember に追加される
   // TC-INV-004: projectId なしの招待受諾で User のみ作成、ProjectMember は追加されない
   // TC-INV-005a: projectId 指定の複数 PENDING 招待 — 1つ受諾しても他は PENDING のまま
   // TC-INV-005b: projectId なしの複数 PENDING 招待 — 1つ受諾で残りが EXPIRED になる
   // TC-INV-006: 確認(static チェックで実施済み)
   //
   // TC-A2-006: 受諾後 User.passwordHash が bcrypt 形式
   // TC-A2-007: 受諾後 Invitation.status = ACCEPTED かつ acceptedAt が設定される
   // TC-A2-008: projectId 指定の受諾で ProjectMember に追加される
   // TC-A2-009: password < 8 文字はサーバー側で拒否される
   ```

### 検証コマンド

```powershell
npm run test:integration -- auth-authz.test.ts
npm run test:integration -- invitation.test.ts
```

### 終了基準

- 追加した統合テストが全 green
- `npm run test:integration` 全体が green

---

## Step 5 — ToDo・重み・日報 統合テスト

**ブランチ:** `feat/tests-step5-integration-todo`  
**前提:** Step 3 の基盤が存在すること  
**並列:** Step 4 と並列実施可

**目的:** 重み均等割り・TodoTemplate 自動展開・日報入力の DB レベルでの整合性を検証する。

### タスクリスト

1. **`src/lib/__tests__/integration/todo-weight-daily.test.ts` を新規作成:**

   **対象テスト ID: TC-WEIGHT-008〜011, TC-TPL-001, TC-I1-006**

   ```typescript
   // TC-WEIGHT-008: ToDo 追加時、既存 ToDo の進捗(completed)を保持したまま weight のみ再分配される
   //   → createTodo 実行後、既存 Todo の completed が変わらないことを DB で確認
   // TC-WEIGHT-009: ToDo 削除時、残りの ToDo に weight が再分配される
   //   → deleteTodo 後、残 Todo の weight 合計が 100
   // TC-WEIGHT-010: 重み再分配は単一トランザクション内で完了する (C-3 対応、二段構えで検証)
   //   (a) 静的検査: Step 2 の static-checks.test.ts で todo.ts の update 処理が
   //       $transaction / tx 引数ブロック内で呼ばれることを multiline regex で grep 確認
   //   (b) 結果検証: createTodo/deleteTodo 実行直後に prisma.todo.findMany で全件取得し、
   //       weight 合計 = 100 かつ件数が期待値と一致することを確認
   //       (部分更新の中間状態が観測された場合、合計が 100 にならないため間接的に検出可能)
   // TC-WEIGHT-011: UI から weight を直接更新する API リクエストは拒否される
   //   → updateTodo({ weight: 50 }) が拒否されることを確認
   //
   // TC-TPL-001: npm run db:seed 実行後に TodoTemplate が 6 件 order 1〜6 で存在する
   //   → prisma.todoTemplate.findMany() の結果を確認
   //   ※ seed は実行済み前提で確認のみ行う
   //
   // TC-I1-006: submitDailyReport 後、親 Task の actualPct が更新される
   //   → submitDailyReport → getProject で Task の actualPct を確認
   //   ※ actualPct は Server Action が計算して返す値で直接 DB 列でないことに注意
   ```

### 検証コマンド

```powershell
npm run test:integration -- todo-weight-daily.test.ts
```

### 終了基準

- 追加した統合テストが全 green

---

## Step 6 — Phase 1 E2E テスト拡充

**ブランチ:** `feat/tests-step6-e2e-phase1`  
**目的:** Phase 1 の画面 (A1〜A5, I1) の E2E カバレッジを拡充する。全機能実装済みのため即実施可能。

### コンテキスト

既存 E2E カバレッジ:

- `e2e/auth.spec.ts`: TC-A1-001〜003 ✓, TC-AUTHZ-003 ✓
- `e2e/projects.spec.ts`: TC-A3-001 ✓ (シードデータ確認), TC-A3-004 (モーダル開閉のみ)
- `e2e/daily-report.spec.ts`: TC-I1-001 ✓, TC-I1-002 ✓, TC-I1-007 ✓

不足している E2E (本 Step で追加):

### タスクリスト

1. **`e2e/auth.spec.ts` に追記 (TC-A1-004〜006):**

   ```
   TC-A1-004: パスワード未入力で送信 → フォームバリデーションエラー表示
   TC-A1-005: メール形式不正で送信 → フォームバリデーションエラー表示
   TC-A1-006: ログイン済みで /login にアクセス → /projects にリダイレクト
              ※ storageState 付きのテストとして記述
   ```

2. **`e2e/fixtures/prisma-fixture.ts` を新規作成 (M-5 対応 — Step 6 の最初に行うこと):**

   ```typescript
   import { PrismaClient } from '@prisma/client'

   const prisma = new PrismaClient()

   export async function createTestInvitation(overrides: {
     email: string
     projectId?: string
     status?: string
     expiresAt?: Date
   }) {
     return prisma.invitation.create({
       data: {
         email: overrides.email,
         token: `test-token-${Date.now()}`,
         projectId: overrides.projectId ?? null,
         status: overrides.status ?? 'PENDING',
         expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
         invitedById: /* seed の admin user ID を取得 */ '...',
       },
     })
   }
   // teardown: テスト後に invitation を削除
   ```

   E2E tests の `test.beforeEach` / `test.afterEach` でこの helper を呼び出す。

3. **`e2e/invitation.spec.ts` を新規作成 (TC-A2-001〜005, TC-INV-002):**

   ```
   TC-A2-001: 有効なトークン(prisma-fixture で作成)でパスワード設定 → 自動サインインで A3 に到達
   TC-A2-002: 期限切れトークン(expiresAt=過去)でアクセス → エラー画面
   TC-A2-003: REVOKED トークン(status=REVOKED) → エラー画面
   TC-A2-004: ACCEPTED 済みトークン(status=ACCEPTED) → エラー画面
   TC-A2-005: 存在しないトークン → エラー画面
   TC-INV-002: 招待リンクが /invite/{token} の形式で表示される
              (A4 の招待モーダルから生成した URL を確認)
   ```

4. **`e2e/projects.spec.ts` に追記 (TC-A3-003, 005, 006):**

   ```
   TC-A3-003: カードに進捗ピル / 状態ピル / 日数ピルが表示される
   TC-A3-005: プロジェクト名が空のまま作成しようとするとエラー
   TC-A3-006: startDate > endDate の作成は拒否される
   ```

5. **`e2e/settings.spec.ts` を新規作成 (TC-A4-001〜006):**

   ```
   TC-A4-001: プロジェクト名・期間を編集して保存 → DB に反映、再描画
   TC-A4-003: メンバー招待モーダルでメールを入力 → Invitation 作成、URL 表示
   TC-A4-004: プロジェクト削除で cascade 削除される (DB確認)
   TC-A4-005: プロジェクト削除に確認ダイアログが出る
   TC-A4-006: 非メンバーがプロジェクト設定 URL を直接叩いた場合 403/404
   ```

6. **`e2e/users.spec.ts` を新規作成 (TC-A5-001〜004):**
   ```
   TC-A5-001: 全ユーザー一覧が表示される
   TC-A5-002: PENDING Invitation 一覧が表示される
   TC-A5-003: 招待取り消しで status=REVOKED に更新される
   TC-A5-004: 招待 URL のコピーボタンが表示される
   ```

### 検証コマンド

```powershell
npx playwright test e2e/auth.spec.ts e2e/invitation.spec.ts e2e/projects.spec.ts e2e/settings.spec.ts e2e/users.spec.ts
```

### 終了基準

- 追加した E2E テストが全 green (CI 環境で)
- 既存 E2E テストの回帰なし

---

## Step 7 — ビュー E2E (V1〜V4)

**ブランチ:** `feat/tests-step7-e2e-views`  
**前提:** Step 6 完了 (共通 E2E 基盤が安定していること)

**目的:** V1〜V4 の画面別テストを追加・拡充する。

### コンテキスト

既存:

- `e2e/task-detail.spec.ts`: タスク詳細表示 ✓ (TC-V3-001 partial)
- `e2e/timeline.spec.ts`: タイムライン表示 ✓ (TC-V2-001 partial)
- `e2e/dashboard.spec.ts`: ダッシュボード表示 ✓ (TC-V4-001 partial)

### タスクリスト

1. **`e2e/tree-view.spec.ts` を新規作成 (TC-V1-001〜008):**

   ```
   TC-V1-001: Project→Milestone→Task の 3 階層がインデント表示される
   TC-V1-002: 各行に進捗バー・進捗ピル・状態ピル・日数ピルが表示される (unit test で代替可)
   TC-V1-003: + ボタンでインライン追加 (Milestone/Task)
   TC-V1-004: インライン編集で名称・期間を変更できる
   TC-V1-005: ドラッグ&ドロップで並び順変更、order フィールドが更新される (P1)
   TC-V1-006: 今日線が 1 本だけ描画される (unit test で既存カバー ✓)
   TC-V1-007: 今日線の 3 役確認 (unit test で既存カバー ✓)
   TC-V1-008: Milestone 0 件の空状態表示 (P2)
   ```

2. **`e2e/timeline.spec.ts` に追記 (TC-V2-001〜003):**

   ```
   TC-V2-001: URL クエリで特定 Milestone 指定 → その期間にズームされる
   TC-V2-002: V1 と同じ視覚言語 (バー/ピル/今日線) の踏襲確認
   TC-V2-003: Milestone 範囲外の Task 表示クリップ確認 (P2)
   ```

3. **`e2e/task-detail.spec.ts` に追記 (TC-V3-002〜004):**

   ```
   TC-V3-002: ToDo の CRUD が動作し、追加/削除時に重みが均等再分配される
   TC-V3-003: ToDo の期間が Task 範囲をはみ出すとサーバー側バリデーションエラー
   TC-V3-004: ボトルネック警告 (著しく遅れている ToDo の強調) が表示される (P1)
   ```

4. **`e2e/dashboard.spec.ts` に追記 (TC-V4-002〜004):**
   ```
   TC-V4-002: 期日超過/期日3日未満の ToDo を根元とする連鎖がハイライトされる
   TC-V4-003: 推奨アクション文字列が表示される (P1)
   TC-V4-004: 警告 ToDo が 0 件のとき空状態が表示される (P2)
   ```

### 検証コマンド

```powershell
npx playwright test e2e/tree-view.spec.ts e2e/timeline.spec.ts e2e/task-detail.spec.ts e2e/dashboard.spec.ts
```

### 終了基準

- P0 テスト全件 green
- P1 テスト全件 green
- P2 は努力目標 (スキップ可)

---

## Step 8 — CI 全グリーン + 完了基準確認

**ブランチ:** `feat/tests-step8-ci-completion`  
**前提:** Steps 1〜7 が全てマージ済み

**目的:** `docs/test-spec.md` 12 節の完了基準を満たしていることを確認し、CI パイプラインで統合テストを自動実行する。

### タスクリスト

1. **CI ワークフロー (`ci.yml`) を更新:**
   - `test:integration` ステップを追加 (postgres サービスコンテナを使用)
   - migration drift チェックを追加 (TC-MODEL-008)

   ```yaml
   services:
     postgres:
       image: postgres:16
       env:
         POSTGRES_PASSWORD: password
         POSTGRES_DB: foresight_test
       ports: ['5432:5432']

   - name: Run integration tests
     env:
       TEST_DATABASE_URL: postgresql://postgres:password@localhost:5432/foresight_test
     run: |
       npx prisma db push
       npm run test:integration

   - name: Check migration drift (TC-MODEL-008)
     run: |
       npx prisma generate
       git diff --exit-code prisma/
   ```

2. **Phase 完了基準チェックリストを確認:**

   **Phase 1 完了基準 (12.1):**
   - [ ] P0 テスト: A1〜A5・V1・I1・進捗計算・重み均等割り・認証/認可 全件パス
   - [ ] CI (lint + typecheck + test + test:integration + build) グリーン
   - [ ] 仕様書 11 節サンプルデータを投入し、画面上の進捗%/状態/日数ピルが手計算と一致

   **Phase 2 完了基準 (12.2):**
   - [ ] V2/V3 の P0/P1 テスト全件パス
   - [ ] Phase 1 回帰テスト全件パス

   **Phase 3 完了基準 (12.3):**
   - [ ] V4/連鎖予測の P0 テスト全件パス
   - [ ] ボトルネック警告/推奨アクション表示の手動確認完了

3. **`docs/test-completion-checklist.md` を作成:**
   - 各フェーズの完了基準チェックリスト
   - 手動確認が必要な P2 テストの一覧
   - `TC-NFR-002〜004` (非機能) の手動確認手順

### 検証コマンド

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
```

### 終了基準

- 上記 5 コマンドが全 green
- Phase 1 完了基準 (12.1) の自動テスト部分が全 green
- Phase 2/3 完了基準 (12.2/12.3) の自動テスト部分が全 green

---

## テスト ID トレーサビリティ

| Step | カバーするテスト ID (主要)                                                                      |
| ---- | ----------------------------------------------------------------------------------------------- |
| 1    | TC-PROG-001, 007, TC-DIFF-001〜003, TC-AGG-005, TC-CHAIN-001〜003 (TC-CHAIN-004 はスコープ外)   |
| 2    | TC-AUTH-004, TC-AUTHZ-004, TC-ENV-001, TC-INV-006, TC-MODEL-008                                 |
| 3    | TC-DATA-001〜006, TC-DATA-010〜011, TC-MODEL-001〜007                                           |
| 4    | TC-AUTH-001〜003, TC-AUTHZ-001〜002, TC-A1-007, TC-A1-008, TC-A2-006〜009, TC-INV-001〜005b     |
| 5    | TC-WEIGHT-008〜011, TC-TPL-001, TC-I1-006                                                       |
| 6    | TC-A1-004〜006, TC-A2-001〜005, TC-A3-003, 005, 006, TC-A4-001〜006, TC-A5-001〜004, TC-INV-002 |
| 7    | TC-V1-001〜008, TC-V2-001〜003, TC-V3-001〜004, TC-V4-001〜004                                  |
| 8    | CI 統合、12節完了基準全体確認                                                                   |

---

## 既存テストカバレッジ (参考)

以下のテスト ID は既存ファイルで既にカバー済み。本計画のスコープ外:

| カテゴリ     | カバー済み ID                                          |
| ------------ | ------------------------------------------------------ |
| TC-PROG      | 002, 003, 004, 005, 006 (progress.test.ts)             |
| TC-DIFF      | 既存はコンセプト確認のみ、exact value は Step 1 で追加 |
| TC-STAT      | 001〜008 全件 (progress.test.ts)                       |
| TC-STAT-TODO | 001〜006 全件 (progress.test.ts)                       |
| TC-AGG       | 001〜004 (progress.test.ts)                            |
| TC-WEIGHT    | 001〜007 (weight.test.ts / progress.test.ts)           |
| TC-FCST      | 001〜003 (forecast.test.ts)                            |
| TC-TPL       | 002〜008 (todo-template.test.ts)                       |
| TC-I1        | 003〜005 (daily-report.test.ts)                        |
| TC-A1        | 001〜003 (e2e/auth.spec.ts)                            |
| TC-A2        | 006〜009 (invitation.test.ts, mock)                    |
| TC-A3        | 001 (e2e/projects.spec.ts)                             |
| TC-INV       | 001〜003 (invitation.test.ts, mock)                    |
| TC-AUTHZ     | 003 (e2e/auth.spec.ts)                                 |
| TC-V4        | 部分 (forecast.test.ts buildDashboardData)             |

---

## 改訂履歴

| 日付       | 版   | 内容                                                                                                                                                                                 |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-13 | v1.0 | 初版。test-spec.md v1.1 に対応した 8 ステップ計画。全機能実装済みを前提。                                                                                                            |
| 2026-05-13 | v1.1 | Opus 対敵レビュー反映。C-1(vitest.config.ts exclude追加)、C-2(TC-CHAIN-004スコープ外)、C-3(TC-WEIGHT-010二段構え検証)、C-4(Auth.js Session事前確認)、M-5(E2E DB fixture追加)を修正。 |
