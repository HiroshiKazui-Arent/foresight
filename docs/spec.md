# プロジェクト管理ツール「フォーサイトマネジメント」 要件定義書 兼 技術仕様書

> 開発スケジュール管理ツール — 遅延を予兆段階で可視化する
> v3.2 / 2026-05-14

---

## 0. 本書の目的と v3.0 改訂サマリ

### 0.1 プロジェクトの位置づけ

本プロジェクトは、**AI 駆動開発(Claude Code 等)のキャッチアップを主目的**とした試験的プロジェクトである。同時に、開発スケジュール管理ツール「フォーサイトマネジメント」として、**当面は2名(本人 + PM)で実利用**する。

### 0.2 v3.0 改訂サマリ(v2.1 からの差分)

| 区分               | 内容                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| 認証               | **Google OAuth を廃止**、Auth.js v5 + Credentials Provider(メール+パスワード)に変更。bcrypt でハッシュ化 |
| 招待制             | 維持。ただし招待リンクからパスワード設定画面へ誘導する形に変更                                           |
| 利用者数           | 当面2名(本人 + PM)で運用                                                                                 |
| 本番環境           | **AWS ECS Fargate + RDS for PostgreSQL + ALB + VPC**                                                     |
| IaC                | **Terraform** で AWS リソースを管理                                                                      |
| デプロイタイミング | Phase 3 完了後に Phase 4 としてまとめてデプロイ                                                          |
| 削除               | 「社内インフラ部門との連携」「社内サーバー」関連の記述を全削除                                           |

### 0.3 学習要素(主目的)

本プロジェクトを通じてキャッチアップする技術領域:

| 領域               | 技術                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| AI 駆動開発        | Claude Code, ECC(everything-claude-code), Blueprint スキル等           |
| Web フロントエンド | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + shadcn/ui |
| バックエンド       | Next.js Server Actions, Prisma ORM                                     |
| 認証               | Auth.js v5 (Credentials Provider)                                      |
| データベース       | PostgreSQL 16, Prisma Migrate                                          |
| コンテナ           | Docker, Docker Compose                                                 |
| CI/CD              | GitHub Actions                                                         |
| クラウド           | AWS (ECS Fargate, RDS, ALB, VPC, ECR, Route53)                         |
| IaC                | Terraform                                                              |

---

## 1. プロダクト概要

### 1.1 ビジョン

> **「遅延を予兆段階で気づく」**

期日が来てから「間に合わなかった」と気づくのではなく、計画進捗と実績進捗の乖離が出た瞬間に検知し、手を打てる状態を作る。

### 1.2 想定ユーザー

- **当面の利用者:** 本人 + PM の2名
- **役割区分:** なし(全員フラット、全員が全操作可能)
- **用途:** ソフトウェア開発プロジェクトのスケジュール管理

### 1.3 想定ユースケース

- 開発プロジェクトのマイルストーン管理
- タスクごとの作業ステップ(ToDo)の進捗追跡
- 日次の進捗入力(日報)
- 遅延の予兆検知と連鎖予測

### 1.4 非対象

- 大規模組織での運用
- リアルタイム同時編集が頻発する用途
- 細粒度の権限管理(プロジェクト単位の参加 / 不参加のみ)
- 顧客向け公開機能
- パスワードリセット機能の高度化(Phase 1 では最小限の実装)

---

## 2. 設計理念

### 2.1 予兆段階で気づく

期日超過で気づくのは遅すぎる。計画進捗との乖離が出た瞬間に検知し、手を打てる状態を作る。

### 2.2 1本の今日線で全てを語る

ガントチャート上で、今日線は以下の3役を兼ねる:

- 「現在の日付」
- 「各バー上の予定%位置」(時間軸上の位置と完全に一致)
- 「実績との境界」

### 2.3 階層は意味を保ったまま集計

`ToDo → Task → Milestone → Project` と重み付き集計で伝播する。

### 2.4 登録は閲覧画面の上でやる

CRUD のための専用画面に行ったり来たりさせず、ツリービュー上の `+` ボタンとインライン編集で完結させる。

### 2.5 学習段階に応じたフェーズ分割

機能実装(Phase 0〜3)とインフラ構築(Phase 4)を明確に分離する。AI 駆動開発の練習に集中できる構成とする。

---

## 3. データ階層構造

### 3.1 4階層

```
Project (プロジェクト全体)
  └─ Milestone (リリース内の節目)
       └─ Task (機能・課題単位)
            └─ ToDo (作業ステップ、重み均等割り)
```

### 3.2 階層ごとの責務

| 階層                       | 進捗の決まり方                                                                  |
| -------------------------- | ------------------------------------------------------------------------------- |
| ToDo                       | **開始**チェックボックス + **完了**チェックボックスの2値で状態表現(v3.2 / M-03) |
| Task / Milestone / Project | 配下の重み付き合計から自動算出                                                  |

### 3.3 ToDo の重み

- UI からは入力せず、同一 Task 内で**均等割り**
- 端数は最後の ToDo に寄せる
- データモデル上は `weight: Int` フィールドを保持

---

## 4. 進捗計算ロジック

### 4.1 経過日数比例による予定進捗

```
予定進捗% = (今日 - 開始日) / (期日 - 開始日) × 100
```

### 4.2 重み付き集計(v3.1 / M-01)

```
Task実績% = Σ(completed=true の ToDo の重み) / Σ(全 ToDo の重み) × 100
Milestone実績% = Σ(各Taskの実績% × Taskの重み) / Σ(重み)
Project実績% = Σ(各Milestoneの実績% × Milestoneの重み) / Σ(重み)
```

ToDo は `completed: boolean` の二値のみ。Task 以上は配下の集計値に対する加重平均。
Task/Milestone レベルの重みは期間日数を使用。

### 4.3 乖離と遅れ日数

```
乖離% = 実績% - 予定%
遅れ日数 = (予定% - 実績%) × 全期間日数 / 100
```

### 4.4 ステータス自動判定

#### Task / Milestone / Project — 5段階(従来通り)

| ステータス | アイコン | 条件                      | 色     |
| ---------- | -------- | ------------------------- | ------ |
| 完了       | ✓        | 進捗 = 100%               | 緑(濃) |
| 進行中     | ▶        | 進行中かつ実績 ≥ 予定     | 緑(淡) |
| 遅延       | ⏱        | 進行中で -20% < 乖離 < 0% | 黄     |
| 警告       | ⚠        | 進行中で 乖離 ≤ -20%      | 赤     |
| 予定       | ○        | 未着手かつ予定通り        | グレー |

##### 集約バー RenderStatus 6 状態 (v3.3 / M-04 で 'ahead-of-schedule' 追加)

`calcAggregateRenderStatus` の判定順序 (上から評価し最初にマッチしたものを返す):

| #   | 状態                    | 条件                                            | 描画                                                 |
| --- | ----------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| 1   | `scheduled`             | `today < startDate`                             | 灰一面                                               |
| 2   | `not-started-overdue`   | `actualPct < 0.001 && !anyChildStarted`         | 薄赤ハッチ + 赤延伸 (today まで)                     |
| 3   | `completed`             | `actualPct === 100`                             | 緑一面                                               |
| 4   | `overdue-past-deadline` | `today > endDate`                               | amber + 橙ハッチ + 赤延伸 (today まで)               |
| 5   | **`ahead-of-schedule`** | `actualPct >= scheduledPct` (`100 > actualPct`) | **緑実線 [0..actualPct%] + 灰 [..100%]** (v3.3 新規) |
| 6   | `delayed-pre-deadline`  | それ以外 (`actualPct < scheduledPct`)           | amber + 橙ハッチ + 灰未来                            |

「前倒し」 (#5) は集約バー (Task / Milestone / Project) で `actualPct >= scheduledPct` のとき適用。緑実線が `actualPct%` 位置まで伸び、今日線 (`scheduledPct%` 位置) を越えて右にはみ出して見える。バー位置は `rowStart〜rowEnd` で完結し延伸しない。

#### ToDo — 4段階(v3.1 / M-01 で簡素化、警告は持たない)

| ステータス | 条件                                                      |
| ---------- | --------------------------------------------------------- |
| 完了       | `completed: true`                                         |
| 遅延       | `completed: false` AND 期日まで 3 日未満(期日超過含む)    |
| 進行中     | `completed: false` AND 期間内(開始日 ≤ 今日 < 期日 - 3日) |
| 予定       | `completed: false` AND 開始日 > 今日                      |

**ToDo の `ahead-of-schedule` 不到達 (v3.3 / M-04 注記):** ToDo の `actualPct` は `completed ? 100 : 0` (M-01 確定事項) のため、`completed=true` (actualPct=100) → 'completed' に分岐し、`completed=false` (actualPct=0) → 'delayed-pre-deadline' 等に分岐。`'ahead-of-schedule'` には**構造上到達しない**。仕様自体は全階層共通として定義するが、実装影響は集約バーのみ。

### 4.5 完了予測日

```
完了予測日 = 今日 + (残作業% × 全期間日数 / 実績進捗速度)
```

### 4.6 連鎖予測

ToDo の遅延 → Task の完了予測日のスリップ → Milestone の完了予測日のスリップ → Project の完了予測日のスリップ

---

## 5. 画面仕様

### 5.1 画面一覧

#### 管理系(Admin/Auth)

| #   | 画面名                  | 目的                                          |
| --- | ----------------------- | --------------------------------------------- |
| A1  | ログイン画面            | メール + パスワードでサインイン               |
| A2  | 招待受諾画面            | 招待リンクから初回パスワード設定 + サインイン |
| A3  | プロジェクト一覧 / 切替 | 自分が参加するプロジェクトを選ぶ              |
| A4  | プロジェクト設定        | プロジェクト名/期間の編集、メンバー管理、削除 |
| A5  | ユーザー管理(全体)      | 全ユーザー一覧、招待発行、招待取り消し        |

#### 閲覧系(View)

| #   | 画面名                 | 目的                                  |
| --- | ---------------------- | ------------------------------------- |
| V1  | ツリービュー           | Project全体を一望 + 登録/編集の主戦場 |
| V2  | タイムラインビュー     | 特定Milestoneにズーム                 |
| V3  | タスク詳細             | 特定Taskを開きToDoを時間軸で展開      |
| V4  | 予兆検知ダッシュボード | 遅延の連鎖を可視化                    |

#### 入力系(Input)

| #   | 画面名   | 目的                            |
| --- | -------- | ------------------------------- |
| I1  | 日報入力 | ToDoの完了チェック(v3.1 / M-01) |

### 5.2 共通デザインルール

統一されたガントバー視覚言語(バー + 今日線 + ピル + アイコン)を全画面で使用。

| 列       | 内容                 | 表示例          |
| -------- | -------------------- | --------------- |
| 進捗ピル | 実績% / 予定%        | `44% / 83%`     |
| 状態ピル | 5段階のステータス    | `警告`          |
| 日数ピル | 遅れ/前倒し日数(+/-) | `-9日` / `+1日` |

### 5.3 各画面の詳細

(v2.0 と同じため省略。要点のみ:)

- **A1 ログイン**: メール + パスワード入力欄、サインインボタン
- **A2 招待受諾**: トークン検証 → パスワード設定フォーム → 即サインイン
- **A3 プロジェクト一覧**: カード形式、各カードに進捗/状態/日数ピル、新規プロジェクト作成モーダル
- **A4 プロジェクト設定**: プロジェクト名/期間編集、メンバー一覧+招待発行、削除ボタン
- **A5 ユーザー管理**: 全ユーザー一覧、招待中一覧、招待発行モーダル(招待リンクをコピー)
- **V1 ツリービュー**: Project→Milestone→Task の階層インデント、`+` ボタンで追加、インライン編集、ドラッグ&ドロップで並び替え
- **V2 タイムラインビュー**: V1 と同レイアウト、表示範囲を Milestone 単位にズーム
- **V3 タスク詳細**: Task 全体行 + 配下 ToDo を期間バーで表示、ToDo の CRUD
- **V4 予兆検知ダッシュボード**: ToDo → Task → Milestone → Project の連鎖を縦に並べ、矢印で連結。ToDo 段階の連鎖根元は**期日超過/期日まで 3 日未満**の未完了 ToDo を表示(v3.1 / M-01 で actualPct 廃止に伴い date-based 判定)
- **I1 日報入力**: V1 レイアウト + 右端に**開始/完了チェックボックス列**(v3.2 / M-03、デュアルチェックボックス)。進捗% 入力欄は廃止。完了チェックは開始済みのみ有効化

---

## 6. 技術スタック(v3.0 改訂)

### 6.1 採用技術

```
[フロントエンド]
  Next.js 15 (App Router)
  React 19
  TypeScript
  Tailwind CSS
  shadcn/ui
  dnd-kit (ドラッグ&ドロップ)

[バックエンド]
  Next.js Server Actions
  Prisma (ORM)
  Auth.js v5 (Credentials Provider + bcrypt)

[データベース]
  PostgreSQL 16
  - ローカル: Docker Compose
  - 本番: AWS RDS for PostgreSQL

[コンテナ]
  Docker / Docker Compose (ローカル)
  Docker (本番ビルド、ECR にプッシュ)

[CI/CD]
  GitHub Actions
  - lint (ESLint + Prettier)
  - typecheck (tsc --noEmit)
  - test (Vitest)
  - build (next build)
  - (Phase 4以降) Terraform plan, Docker build/push, ECS deploy

[本番インフラ]
  AWS
  - ECS Fargate (アプリ実行)
  - RDS for PostgreSQL (DB)
  - ALB (ロードバランサ)
  - ECR (Docker イメージレジストリ)
  - VPC + Subnet + Security Group (ネットワーク)
  - Route53 + ACM (DNS + SSL証明書)
  - Secrets Manager or SSM Parameter Store (シークレット管理)

[IaC]
  Terraform
```

### 6.2 ディレクトリ構成(想定)

```
foresight/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Phase 0 から
│       └── deploy.yml                # Phase 4 から
├── docker/
│   ├── app/
│   │   ├── Dockerfile.dev            # ローカル開発用
│   │   └── Dockerfile                # 本番用
│   └── postgres/
│       └── init.sql                  # 必要なら
├── infra/                            # Phase 4 で追加
│   └── terraform/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── modules/
│       │   ├── vpc/
│       │   ├── rds/
│       │   ├── ecs/
│       │   ├── alb/
│       │   └── ecr/
│       └── environments/
│           └── prod/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── src/
│   ├── app/
│   ├── components/
│   ├── lib/
│   └── server/
├── compose.yaml
├── .env.example
├── .env.local                        # gitignore
├── package.json
├── tsconfig.json
└── README.md
```

### 6.3 Docker Compose(ローカル開発)

`compose.yaml`(概要):

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: foresight
      POSTGRES_PASSWORD: foresight_dev
      POSTGRES_DB: foresight
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U foresight']
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: docker/app/Dockerfile.dev
    environment:
      DATABASE_URL: postgresql://foresight:foresight_dev@postgres:5432/foresight
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_TRUST_HOST: 'true'
    ports:
      - '3000:3000'
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      postgres:
        condition: service_healthy
    command: npm run dev

volumes:
  postgres_data:
```

### 6.4 データモデル(Prisma スキーマ)

v2.0 のスキーマをベースに、認証方式変更に伴う変更を加える。

```prisma
model User {
  id            String           @id @default(cuid())
  email         String           @unique
  name          String
  passwordHash  String?          // 招待直後はnull、A2画面で設定
  emailVerified DateTime?        // Auth.js 標準フィールド
  image         String?          // Auth.js 標準フィールド(未使用だが互換のため)
  lastLoginAt   DateTime?
  accounts      Account[]        // Auth.js 標準
  sessions      Session[]        // Auth.js 標準
  memberships   ProjectMember[]
  tasks         Task[]
  reports       DailyReport[]
  invitations   Invitation[]     @relation("InvitedBy")
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt
}

// --- Auth.js 標準テーブル ---
model Account {
  id                 String  @id @default(cuid())
  userId             String
  type               String
  provider           String
  providerAccountId  String
  refresh_token      String?
  access_token       String?
  expires_at         Int?
  token_type         String?
  scope              String?
  id_token           String?
  session_state      String?
  user               User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
// --- /Auth.js 標準テーブル ---

model Invitation {
  id            String     @id @default(cuid())
  email         String
  token         String     @unique
  projectId     String?
  project       Project?   @relation(fields: [projectId], references: [id])
  invitedById   String
  invitedBy     User       @relation("InvitedBy", fields: [invitedById], references: [id])
  status        InvitationStatus @default(PENDING)
  expiresAt     DateTime
  acceptedAt    DateTime?
  createdAt     DateTime   @default(now())

  @@index([token])
  @@index([email])
}

enum InvitationStatus {
  PENDING
  ACCEPTED
  EXPIRED
  REVOKED
}

model Project {
  id          String           @id @default(cuid())
  name        String
  startDate   DateTime
  endDate     DateTime
  members     ProjectMember[]
  milestones  Milestone[]
  invitations Invitation[]
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
}

model ProjectMember {
  id         String   @id @default(cuid())
  projectId  String
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  joinedAt   DateTime @default(now())

  @@unique([projectId, userId])
  @@index([userId])
}

model Milestone {
  id          String   @id @default(cuid())
  projectId   String
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  startDate   DateTime
  endDate     DateTime
  order       Int
  tasks       Task[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([projectId, order])
}

model Task {
  id          String   @id @default(cuid())
  milestoneId String
  milestone   Milestone @relation(fields: [milestoneId], references: [id], onDelete: Cascade)
  name        String
  startDate   DateTime
  endDate     DateTime
  assigneeId  String?
  assignee    User?    @relation(fields: [assigneeId], references: [id])
  order       Int
  todos       Todo[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([milestoneId, order])
}

model Todo {
  id          String   @id @default(cuid())
  taskId      String
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  name        String
  weight      Int      // UIからは入力不可、均等割り
  completed   Boolean  @default(false)  // v3.1 / M-01: actualPct 廃止、completed のみで進捗表現
  startDate   DateTime
  endDate     DateTime
  order       Int
  reports     DailyReport[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([taskId, order])
}

// v3.1 / M-02: Task 作成時に自動展開されるテンプレート
model TodoTemplate {
  id        String   @id @default(cuid())
  name      String
  order     Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([order])
}

model DailyReport {
  id          String   @id @default(cuid())
  todoId      String
  todo        Todo     @relation(fields: [todoId], references: [id], onDelete: Cascade)
  reportedBy  String
  user        User     @relation(fields: [reportedBy], references: [id])
  date        DateTime
  completed   Boolean  // v3.1 / M-01: actualPct 廃止
  comment     String?
  createdAt   DateTime @default(now())

  @@index([todoId, date])
}
```

### 6.5 認証方針

- **認証ライブラリ:** Auth.js v5 (NextAuth.js v5)
- **プロバイダ:** Credentials Provider のみ(メール + パスワード)
- **パスワードハッシュ:** bcrypt(saltRounds: 12)
- **セッション管理:** Database session(Prisma アダプタ経由)
- **認可:** ログイン済み AND `ProjectMember` に含まれるユーザーのみ、当該プロジェクトの全操作が可能

### 6.6 招待フロー(v3.0)

```
1. メンバーが「+ ユーザーを招待」モーダルでメールアドレスを入力
2. サーバーが Invitation レコード作成 (token, expiresAt=7日後)
3. 招待リンク (/invite/{token}) を画面に表示 → コピーして招待先に伝える
4. 招待された人がリンクを開く → A2 画面でパスワード設定
5. パスワード設定送信 → User 作成(passwordHash 設定)→ ProjectMember 追加 → Invitation を ACCEPTED に更新 → 自動サインイン
```

メール自動送信は Phase 5(Pending)で実装する。

### 6.7 重み均等割りロジック

```typescript
function redistributeWeights(todos: Todo[]): Todo[] {
  const n = todos.length
  if (n === 0) return []
  const base = Math.floor(100 / n)
  const remainder = 100 - base * n
  return todos.map((t, i) => ({
    ...t,
    weight: i === n - 1 ? base + remainder : base,
  }))
}
```

トランザクション内で実行し、Task 配下の全 ToDo を一括更新する。

### 6.8 CI(GitHub Actions、Phase 0 から導入)

`.github/workflows/ci.yml`(概要):

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: foresight
          POSTGRES_PASSWORD: foresight_test
          POSTGRES_DB: foresight_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://foresight:foresight_test@localhost:5432/foresight_test
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
        env:
          DATABASE_URL: postgresql://foresight:foresight_test@localhost:5432/foresight_test
      - run: npm run build
        env:
          DATABASE_URL: postgresql://foresight:foresight_test@localhost:5432/foresight_test
          AUTH_SECRET: test_secret
          AUTH_TRUST_HOST: 'true'
```

### 6.9 AWS インフラ構成(Phase 4 で構築)

```
[インターネット]
       │
       ▼
   Route53 (DNS)
       │
       ▼
    ACM (SSL証明書)
       │
       ▼
       ALB (HTTPS終端、ヘルスチェック)
       │
       ▼
   ┌───┴────────┐
   │ Public Subnet (ALB)                    │
   │ (Multi-AZ, 2 AZ)                        │
   └────────────┘
       │
       ▼ (Private Subnet 内)
   ECS Fargate (Next.js コンテナ)
       │
       ├──→ ECR (Docker イメージ取得)
       ├──→ Secrets Manager (DB認証情報、AUTH_SECRET)
       └──→ RDS for PostgreSQL (Multi-AZ は無効、コスト優先)
              │
              └─ Private Subnet
```

### 6.10 Terraform モジュール構成

```
infra/terraform/
├── main.tf                  # ルートモジュール、モジュールを組み合わせる
├── variables.tf
├── outputs.tf
├── backend.tf               # tfstate を S3 に保存
├── modules/
│   ├── vpc/                 # VPC, Subnet, Route Table, IGW, NAT
│   ├── ecr/                 # ECR リポジトリ
│   ├── rds/                 # RDS for PostgreSQL
│   ├── alb/                 # ALB, Target Group, Listener
│   ├── ecs/                 # ECS Cluster, Service, Task Definition, IAM Role
│   └── route53/             # ACM, Route53 レコード
└── environments/
    └── prod/
        ├── main.tf          # 各モジュールを呼び出す
        └── terraform.tfvars
```

### 6.11 シークレット管理

| シークレット   | 保管先                 | 設定方法                                              |
| -------------- | ---------------------- | ----------------------------------------------------- |
| `DATABASE_URL` | AWS Secrets Manager    | RDS 作成時に生成、ECS Task Definition から参照        |
| `AUTH_SECRET`  | AWS Secrets Manager    | Terraform で `random_password` 生成                   |
| AWS 認証情報   | GitHub Actions Secrets | OIDC 連携(`aws-actions/configure-aws-credentials@v4`) |

ローカル開発では `.env.local`(gitignore 対象)で管理。

---

## 7. 開発計画(v3.0 改訂)

### 7.1 段階的リリース

| フェーズ              | 内容                                                                   | 価値                             | 期間目安 |
| --------------------- | ---------------------------------------------------------------------- | -------------------------------- | -------- |
| **Phase 0**           | ローカル開発環境整備(Docker / DB / Auth / CI)                          | 開発を始められる土台             | 1-2日    |
| **Phase 1**           | 認証 + 最低限の閲覧/入力(A1〜A5 + V1 + I1)                             | ログインして登録・進捗入力できる | 6-8日    |
| **Phase 2**           | V2(タイムライン) + V3(タスク詳細)                                      | ズームと詳細閲覧                 | 2-3日    |
| **Phase 3**           | V4(予兆検知ダッシュボード)                                             | 予兆検知が完成                   | 2日      |
| **Phase 4**           | AWS デプロイ(Terraform + ECS Fargate + RDS)                            | 本番稼働                         | 3-5日    |
| **Phase 5** (Pending) | 招待メール自動送信、通知、リアルタイム同期、履歴グラフ、エクスポート等 | 運用快適性の向上                 | 要時のみ |

### 7.2 Phase 0: ローカル開発環境整備

**目的:** Phase 1 以降の機能実装に集中できるよう、ローカル開発と CI のインフラを整える。AWS は触らない。

| Day     | 作業内容                                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Day 0-1 | リポジトリ初期化(`foresight`)、Next.js 15 + TypeScript + Tailwind プロジェクト作成、ESLint/Prettier 設定、husky + lint-staged 設定 |
| Day 0-2 | `compose.yaml` 作成、PostgreSQL コンテナ起動確認、Prisma 導入、`schema.prisma` 記述、初回マイグレーション、Prisma Studio で確認    |
| Day 0-3 | Auth.js v5 + Credentials Provider 導入、bcrypt 導入、シンプルなサインインページで動作確認、seed スクリプトで初期ユーザー作成       |
| Day 0-4 | GitHub Actions CI 構築(lint + typecheck + test + build)、main ブランチ保護設定、PR テンプレート作成                                |

### 7.3 Phase 1: 認証 + 最低限の閲覧/入力

| Day     | 作業内容                                                                                   |
| ------- | ------------------------------------------------------------------------------------------ |
| Day 1-1 | Server Actions(招待発行、招待受諾、Project CRUD)、`ProjectMember` ベースの認可ミドルウェア |
| Day 1-2 | Server Actions(Milestone/Task/Todo CRUD)、重み均等割りロジック、進捗計算ロジック           |
| Day 1-3 | 共通コンポーネント(進捗バー、ピル、今日線、ガントSVG)                                      |
| Day 1-4 | A1(ログイン)、A2(招待受諾)、A3(プロジェクト一覧)                                           |
| Day 1-5 | V1(ツリービュー、インライン編集、ドラッグ&ドロップ)                                        |
| Day 1-6 | I1(日報入力)                                                                               |
| Day 1-7 | A4(プロジェクト設定)、A5(ユーザー管理、招待)                                               |
| Day 1-8 | 計算結果の整合性確認(仕様書11節サンプルデータで)、バグ修正                                 |

### 7.4 Phase 2: ズームと詳細

| Day     | 作業内容                                    |
| ------- | ------------------------------------------- |
| Day 2-1 | V2(タイムラインビュー)                      |
| Day 2-2 | V3(タスク詳細、ToDo CRUD、ボトルネック警告) |
| Day 2-3 | バグ修正、回帰テスト                        |

### 7.5 Phase 3: 予兆検知

| Day     | 作業内容                                            |
| ------- | --------------------------------------------------- |
| Day 3-1 | 連鎖計算ロジック(ToDo → Task → Milestone → Project) |
| Day 3-2 | V4(予兆検知ダッシュボード)+ 推奨アクション表示      |

### 7.6 Phase 4: AWS デプロイ(Terraform + ECS Fargate)

**目的:** ローカルで完成したアプリを AWS 本番環境にデプロイする。IaC とクラウドインフラのキャッチアップが主目的。

| Day     | 作業内容                                                                                                         |
| ------- | ---------------------------------------------------------------------------------------------------------------- |
| Day 4-1 | AWS アカウント準備、IAM ユーザー/ロール作成、Terraform バックエンド(S3 + DynamoDB)準備、GitHub Actions OIDC 設定 |
| Day 4-2 | Terraform: VPC モジュール(Public/Private Subnet, IGW, NAT Gateway, Route Table)                                  |
| Day 4-3 | Terraform: RDS モジュール、ECR モジュール、Secrets Manager                                                       |
| Day 4-4 | 本番用 Dockerfile 作成、ローカルで Docker ビルド・動作確認、ECR へ手動プッシュ                                   |
| Day 4-5 | Terraform: ALB モジュール、ECS モジュール(Cluster, Service, Task Definition, IAM Role)                           |
| Day 4-6 | Route53 + ACM 設定、HTTPS 動作確認、本番初回デプロイ                                                             |
| Day 4-7 | GitHub Actions のデプロイワークフロー追加(`deploy.yml`: Docker build → ECR push → ECS service update)            |

### 7.7 AI 駆動開発の活用方針

| Phase      | 想定する使い方                                                                             |
| ---------- | ------------------------------------------------------------------------------------------ |
| Phase 0    | 定型的なセットアップが中心。Sonnet で `/blueprint` → 各ステップを実装する形が向く          |
| Phase 1〜3 | 仕様書の各画面/ロジック単位で `/blueprint` → 実装。複雑な計算ロジックは Opus も検討        |
| Phase 4    | Terraform コードは AI 生成に向くが、AWS リソースの実際の作成・確認は人間が行う(IAM/課金等) |

---

## 8. 運用方針

### 8.1 データ運用(Phase 4 以降)

- **バックアップ:** RDS の自動バックアップ機能(7日間保持、無料枠内)
- **マイグレーション:** Prisma Migrate、本番反映は CI から手動 trigger
- **監査ログ:** `DailyReport` テーブルで進捗変更履歴を保持

### 8.2 認証・認可

- Auth.js v5 + Credentials Provider(メール + パスワード、bcrypt ハッシュ)
- 招待制(全体招待 or プロジェクト単位の招待)
- プロジェクトメンバー = 全操作可能(フラット)

### 8.3 コスト試算(Phase 4 以降の月額目安)

| サービス                            | 構成                                  | 月額目安(USD) |
| ----------------------------------- | ------------------------------------- | ------------- |
| ECS Fargate                         | 0.25 vCPU / 0.5 GB × 1 タスク常時稼働 | ~$10          |
| RDS for PostgreSQL                  | db.t4g.micro, 20GB                    | ~$15          |
| ALB                                 | 1台                                   | ~$20          |
| NAT Gateway                         | 1台                                   | ~$35          |
| Route53                             | 1ホストゾーン                         | ~$0.5         |
| その他(ECR, Secrets Manager, S3 等) | -                                     | ~$5           |
| **合計**                            |                                       | **~$85**      |

**コスト最適化案:**

- NAT Gateway を VPC エンドポイントに置き換え → 月 $20 程度削減可能
- ALB を使わず ECS Service Connect + CloudFront 構成にする選択肢もあるが学習目的なら ALB 採用
- 開発・検証時のみ起動、不要時は停止する運用も可能

### 8.4 拡張可能性

| 拡張                  | 想定実装                               |
| --------------------- | -------------------------------------- |
| 招待メール自動送信    | AWS SES から送信                       |
| 通知                  | Slack webhook(Server Actions から呼ぶ) |
| ロール区分            | `ProjectMember` に `role` 列を追加     |
| ToDo 重みカスタマイズ | UI を追加し均等割りロジックを切り替え  |
| 履歴グラフ            | `DailyReport` から集計、新画面追加     |

---

## 9. 非機能要件

| 項目               | 要件                                    |
| ------------------ | --------------------------------------- |
| 同時利用ユーザー数 | 当面2名、将来10名以内                   |
| 応答速度           | 主要操作 200ms 以内                     |
| 可用性             | ベストエフォート(SLAは要求しない)       |
| ブラウザ対応       | Chrome / Safari / Firefox / Edge 最新版 |
| モバイル対応       | 閲覧のみ可能、入力は PC 優先            |
| データ容量         | プロジェクトあたり数万行までスケール    |

---

## 10. 確定事項と Pending

### 10.1 確定事項(v3.0〜v3.2)

- [x] プロダクト名: フォーサイトマネジメント(リポジトリ名: `foresight`)
- [x] AI 駆動開発のキャッチアップが主目的、副目的として2人で実利用
- [x] 4階層構造(Project / Milestone / Task / ToDo)
- [x] 重み付き集計、5段階ステータス、しきい値 -20%
- [x] 統一されたガントバー視覚言語、今日線3役
- [x] ToDo 重みは UI から削除、均等割り
- [x] ツリービュー上のインライン編集を主戦場とする
- [x] 招待制ユーザー登録(招待リンクからパスワード設定)
- [x] **【v3.0】認証は Auth.js v5 + Credentials Provider(メール+パスワード、bcrypt)**
- [x] **【v3.0】ローカル: Docker Compose + PostgreSQL、本番: AWS RDS for PostgreSQL**
- [x] **【v3.0】本番: AWS ECS Fargate + ALB + VPC**
- [x] **【v3.0】IaC: Terraform**
- [x] **【v3.0】CI: GitHub Actions、Phase 0 から導入**
- [x] **【v3.0】Phase 構成: Phase 0(ローカル) → 1〜3(機能実装) → 4(AWS デプロイ)**
- [x] **【v3.2 / M-03】ToDo に「開始」チェックボックスを追加(dual checkbox)。完了は開始済みのみ有効**
- [x] **【v3.2 / M-03】GanttBar 5状態視覚化: scheduled / completed / delayed-pre-deadline / overdue-past-deadline / not-started-overdue**
- [x] **【v3.2 / M-03】State 3/4 ではバーが rowEnd を超えて today まで延伸する(意図的設計)。タイムライン軸 projectEnd は不変**
- [x] **【v3.2 / M-03】completed=true は started=true を必須とする(DB CHECK 制約で強制)**
- [x] **【v3.3 / M-04】集約バー (Task/Milestone/Project) で `'ahead-of-schedule'` 状態を追加。`actualPct >= scheduledPct && actualPct < 100` で前倒し進行中として描画 (緑実線 + 灰)。ToDo は構造上到達しない**

### 10.2 Pending(Phase 5 以降)

- [ ] 招待メールの自動送信(AWS SES)
- [ ] パスワードリセット機能
- [ ] しきい値のユーザーカスタマイズ
- [ ] ToDo の重みカスタマイズ
- [ ] Task/Milestone レベルの重みカスタマイズ
- [ ] Slack/メール通知連携
- [ ] リアルタイム同期
- [ ] 履歴グラフ画面
- [ ] モバイル入力UIの最適化
- [ ] エクスポート機能(CSV/PDF)
- [ ] プロジェクトテンプレート
- [ ] ロール区分

---

## 11. 参考: サンプルデータ整合性

(v1.0 / v2.0 と同じため省略)

---

## 改訂履歴

| 日付       | 版   | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-11 | v1.0 | 初版作成                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-12 | v2.0 | 管理系画面追加、ツリービュー上のインライン編集、ToDo重み均等割り、招待制ユーザー登録、ProjectMember / Invitation スキーマ追加                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-12 | v2.1 | プロダクト名「フォーサイトマネジメント」確定、Supabase 廃止 → 自前 PostgreSQL、Docker Compose 化、Phase 0 新設、GitHub Actions CI 追加(社内サーバー前提)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-12 | v3.0 | プロジェクトの位置づけを「AI 駆動開発のキャッチアップ」に明確化。認証を Google OAuth から Credentials(メール+パスワード)に変更。本番先を社内サーバーから **AWS ECS Fargate + RDS** に変更。**Terraform** で IaC 化。Phase 4 として AWS デプロイを切り出し                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-13 | v3.1 | **M-01**: 日報入力を完了チェックボックスのみに変更。`Todo.actualPct` / `DailyReport.actualPct` を削除。ToDo ステータスを 4 段階に簡素化(警告は ToDo レベルで持たない)。**M-02**: `TodoTemplate` モデル追加、Task 作成時に 6 件の ToDo を自動展開                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-14 | v3.2 | **M-03**: ToDo に `started` (Boolean) / `startedAt` (DateTime?) / `completedAt` (DateTime?) を追加。日報入力をデュアルチェックボックス化(開始 + 完了)。GanttBar を 5 状態視覚化(scheduled / completed / delayed-pre-deadline / overdue-past-deadline / not-started-overdue)。State 3/4 ではバーが rowEnd を超えて today まで延伸する(意図的設計、v3.1 以前の「バーが今日線をまたぐのはバグ」判断とは別物)。タイムライン軸 projectEnd は不変。DB CHECK 制約 `completed=true → started=true` を追加。**注意:** v3.1 以前の `startedAt` / `completedAt` は migration 時点の `createdAt` / `updatedAt` からの推定値であり、実際の開始/完了日時とは異なる可能性がある |
| 2026-05-15 | v3.3 | **M-04**: `RenderStatus` に `'ahead-of-schedule'` (前倒し進行中、6 状態目) を追加。集約バー (Task/Milestone/Project) で `actualPct >= scheduledPct && actualPct < 100` のとき緑実線 [0..actualPct%] + 灰 [actualPct..100%] で描画。緑実線が今日線 (scheduledPct 位置) を越えて右にはみ出す。`calcAggregateRenderStatus` の判定順序を 6 ステップに改訂 (旧 `'completed'` 返却を `'ahead-of-schedule'` に置換、`actualPct === 100` は引き続き最優先で `'completed'`)。ToDo は `actualPct ∈ {0, 100}` 制約により構造上到達しない (`calcRenderStatus` は不変)。StatusPill に「先行」ラベル (緑淡色) を追加                                                           |
