# プロジェクト管理ツール「フォーサイトマネジメント」 要件定義書 兼 技術仕様書

> 開発スケジュール管理ツール — 期間と進捗を分離してシンプルに可視化する
> v4.0 / 2026-05-15

---

## 0. 本書の目的と v4.0 改訂サマリ

### 0.1 プロジェクトの位置づけ

本プロジェクトは、**AI 駆動開発(Claude Code 等)のキャッチアップを主目的**とした試験的プロジェクトである。同時に、開発スケジュール管理ツール「フォーサイトマネジメント」として、**当面は2名(本人 + PM)で実利用**する。

### 0.2 v4.0 改訂サマリ(v3.3 からの差分)

v3.0〜v3.3 で積み重ねた「バーで期間と進捗を同時に表現する」設計を破棄し、ゼロから簡素な仕様に作り直す。

| 区分                      | v3.3                                                                                                                   | v4.0                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **ガントバーの意味**      | 期間 + 進捗の塗りつぶし                                                                                                | **期間のみ**(進捗の塗りつぶし廃止)                   |
| **進捗の表現**            | バー塗りつぶし + 数値                                                                                                  | **数値のみ**(予定 X% / 実績 Y% の2行)                |
| **ToDo の進捗**           | `started` / `completed` のデュアルチェックボックス、`completed=true → started=true` の DB 制約                         | **着手日 / 完了日** の DateTime 入力。0% or 100%     |
| **進捗集計**              | 重み付き平均(`Todo.weight` を均等割り)                                                                                 | **単純な「完了 ToDo 数 / 全 ToDo 数」**(重み廃止)    |
| **ステータス段階**        | Task/Milestone/Project は 5 段階(完了/進行中/遅延/警告/予定)                                                           | **4 段階**(完了 / 進行中 / 遅延 / 未着手)            |
| **集約バー RenderStatus** | 6 状態(scheduled / not-started-overdue / completed / overdue-past-deadline / ahead-of-schedule / delayed-pre-deadline) | **廃止**(バー塗りつぶし自体がなくなる)               |
| **-20% 警告閾値**         | あり                                                                                                                   | **廃止**                                             |
| **今日線**                | 3 役(現在日付 + 各バー上の予定% 位置 + 実績との境界)                                                                   | **単純な縦線**(現在日付の表示のみ)                   |
| **連鎖予測 / 完了予測日** | あり(forecast.ts)                                                                                                      | **Phase 5 へ送り**(v4.0 では実装しない)              |
| **画面構成**              | A1〜A5 + V1/V2/V3/V4 + I1                                                                                              | A1〜A5 + **ガント表示 / 工程管理 / 進捗入力** に集約 |
| **日報入力(I1)**          | デュアルチェックボックス UI                                                                                            | **進捗入力に統合**(タスク単位で着手日/完了日入力)    |

**残るもの:** プロダクト名 / ビジョン / 4階層データモデル / 認証(Auth.js v5 + Credentials + bcrypt + 招待制) / Docker Compose / GitHub Actions CI / フェーズ構成 / AWS デプロイ(Phase 4) / Terraform。

---

## 1. プロダクト概要

### 1.1 ビジョン

> **「遅延を予兆段階で気づく」**

期日が来てから「間に合わなかった」と気づくのではなく、計画進捗と実績進捗の乖離が出た瞬間に検知し、手を打てる状態を作る。v4.0 では複雑な閾値判定や連鎖予測ではなく、**予定% と実績% を並べて見せる** だけで「乖離している」ことが視覚的に分かる構成にする。

### 1.2 想定ユーザー

- **当面の利用者:** 本人 + PM の2名
- **役割区分:** なし(全員フラット、全員が全操作可能)
- **用途:** ソフトウェア開発プロジェクトのスケジュール管理

### 1.3 非対象

- 大規模組織での運用
- リアルタイム同時編集
- 細粒度の権限管理
- 連鎖予測 / 完了予測日(Phase 5 で再検討)

---

## 2. 設計理念

### 2.1 期間と進捗は分離する

ガントバーは **期間を表す物差し**。進捗は数値で読み取らせる。同じ図形で 2 つの情報を表現しない。

### 2.2 ToDo は二値(0% / 100%)に倒す

中間進捗の自己申告は不正確になりがち。ToDo は「着手日が入る」「完了日が入る」の 2 段階で表現し、% を人が入力する余地を消す。

### 2.3 4階層は意味を保ったまま集計

`ToDo → Task → Milestone → Project` と集計するが、**重み付けはしない**(単純な完了数 / 総数の比率)。

### 2.4 工程の構造管理と進捗入力は分離する

- **工程管理画面**: プロジェクト構造の CRUD のみ(予定開始/終了日を含む)
- **進捗入力画面**: タスク単位で開き、配下 ToDo の着手日 / 完了日のみ入力

「予定をいじりにきたつもりが実績を上書きしてしまった」を構造的に防ぐ。

### 2.5 学習段階に応じたフェーズ分割

機能実装(Phase 0〜3)とインフラ構築(Phase 4)を明確に分離する。

---

## 3. データ階層構造

### 3.1 4階層

```
Project (プロジェクト全体)
  └─ Milestone (リリース内の節目)
       └─ Task (機能・課題単位)
            └─ ToDo (作業ステップ)
```

### 3.2 階層ごとの責務

| 階層          | 進捗の決まり方                                     |
| ------------- | -------------------------------------------------- |
| **ToDo**      | `actualEndDate` の有無で 0% or 100%                |
| **Task**      | 配下 ToDo の `(完了 ToDo 数) / (全 ToDo 数)` × 100 |
| **Milestone** | 配下 Task の実績% を期間日数で加重平均             |
| **Project**   | 配下 Milestone の実績% を期間日数で加重平均        |

ToDo に重みカラムは持たない。Task/Milestone/Project レベルでの加重平均は「期間日数」を重みとする(規模に比例)。

### 3.3 標準 ToDo

Task 作成時、デフォルトで以下 5 件の ToDo が自動展開される(`TodoTemplate` モデル経由、`/todo-templates` 画面で編集可能):

```
画面設計 → DB設計 → BE開発 → FE開発 → レビュー
```

直列スケジュールが基本だが、開始日 / 終了日は Task の期間内で自動配分(均等割り)し、ユーザーが編集できる。

---

## 4. 進捗計算ロジック

### 4.1 予定進捗(時間軸ベース)

```
予定進捗% = clamp((today - startDate) / (endDate - startDate) × 100, 0, 100)
```

`today < startDate` のときは 0%、`today > endDate` のときは 100%。

### 4.2 実績進捗

**ToDo:**

```
実績% = actualEndDate != null ? 100 : 0
```

**Task:**

```
Task 実績% = (完了 ToDo 数 / 全 ToDo 数) × 100
```

**Milestone:**

```
Milestone 実績% = Σ(Task 実績% × Task 期間日数) / Σ(Task 期間日数)
```

**Project:**

```
Project 実績% = Σ(Milestone 実績% × Milestone 期間日数) / Σ(Milestone 期間日数)
```

### 4.3 ステータス自動判定(4段階)

| ステータス | 条件                                                 | 色     |
| ---------- | ---------------------------------------------------- | ------ |
| **完了**   | 実績% = 100                                          | 緑     |
| **進行中** | 実績% > 0 AND 実績% < 100                            | 青     |
| **遅延**   | 実績% < 予定% AND (進行中 OR 開始予定日超過で未着手) | 赤     |
| **未着手** | 実績% = 0 AND today < startDate                      | グレー |

「未着手リスク」は **`未着手 AND today > startDate`** のサブカテゴリとしてフィルター/サマリーで使う(独立ステータスにはしない)。

### 4.4 ガントバー描画ルール

- **予定バー(青系)**: `startDate` から `endDate` まで。常に表示。
- **実績バー(緑系)**:
  - 完了済み(`actualEndDate != null`): `actualStartDate` から `actualEndDate`
  - 進行中(`actualStartDate != null && actualEndDate == null`): `actualStartDate` から **今日線まで**(今日より右に伸ばさない)
  - 未着手(`actualStartDate == null`): **表示しない**
- **hover ツールチップ**:
  - 予定バー: `予定：MM/DD → MM/DD（N日）`
  - 実績バー(完了): `実績：MM/DD → MM/DD（N日）`
  - 実績バー(進行中): `実績：MM/DD →（N日経過）`

### 4.5 今日線

ガント領域に縦線を 1 本引く。`今日(MM/DD)` のラベルを上部に表示。**v3.x で持たせた「3役」(現在日付 / 予定% 位置 / 実績境界)は廃止し、単純な現在日付マーカーに戻す**。

### 4.6 進捗カラム表示

各行に 2 段で表示:

```
予定  80%   (黒)
実績  60%   (赤 = 実績 < 予定)
```

色ルール:

- 「予定」「実績」のラベル: 黒
- 予定% の数値: 黒
- 実績% の数値: 実績 >= 予定 で **緑**、実績 < 予定 で **赤**

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

#### 業務系(集約後の 3 画面)

| #   | 画面名         | 目的                                                                                               |
| --- | -------------- | -------------------------------------------------------------------------------------------------- |
| G1  | **ガント表示** | プロジェクト全体をツリー展開しガントチャートで一望。サマリーカード + フィルター。**メイン画面**    |
| G2  | **工程管理**   | プロジェクト / マイルストーン / タスク / ToDo の追加・編集・削除(予定期間まで)。実績日は入力しない |
| G3  | **進捗入力**   | タスク単位で開く。配下 ToDo の着手日 / 完了日を入力                                                |

### 5.2 G1 ガント表示

#### 上部ツールバー

- 今日 / 表示期間表示
- すべて展開 / すべて折りたたみ
- 画面切替(ガント表示 / 工程管理)

#### サマリーカード

- **全体進捗サマリー**: 予定進捗 / 実績進捗(2 つの数値、実績は色付け)
- **遅延サマリー**: 遅延中の件数 / 最大遅れ日数 / 未着手リスク件数

#### フィルター

`すべて / 遅延 / 未着手リスク / 進行中 / 完了` のピル。タブではなくフィルター。

- **遅延**: 4.3 の「遅延」条件にマッチ
- **未着手リスク**: 未着手 AND `today > startDate`
- **進行中**: 4.3 の「進行中」
- **完了**: 4.3 の「完了」

該当する子を持つ親階層はフィルター適用時も表示する。

#### ガント表

カラム構成:

| WBS | 工程名 | ステータス | 進捗 | ガント領域 |
| --- | ------ | ---------- | ---- | ---------- |

- 工程名カラムは展開/折りたたみトグル + 工程名 + Type ピル(Project/Milestone/Task/ToDo)
- Task 行のみ工程名の下に **「進捗入力」ボタン** を表示 → G3 に遷移
- ステータスカラム: 4 段階バッジ
- 進捗カラム: 予定 / 実績 の 2 段
- ガント領域: 4.4 のルールでバー描画 + 今日線

### 5.3 G2 工程管理

ツリー形式のフォーム。各行に:

- レベルマーク(P / M / T / To)
- 工程名(編集可)
- 予定開始日(date input)
- 予定終了日(date input)
- 同階層追加ボタン(`+`)
- 削除ボタン(`×`)

タスク追加時は標準 ToDo 5 件を自動展開する(展開内容は `/todo-templates` で管理)。実績日(`actualStartDate` / `actualEndDate`)はこの画面では一切扱わない。

### 5.4 G3 進捗入力

G1 のタスク行から開く。1 タスクの配下 ToDo を縦に並べ、各行に:

- ToDo 名(readonly)
- 着手日(date input → `actualStartDate`)
- 完了日(date input → `actualEndDate`)
- 進捗バッジ(完了日ありで `100%` 緑、なしで `0%` グレー)

右側にこのタスクの「完了 ToDo / 全 ToDo」と「実績進捗%」のサマリー。

---

## 6. 技術スタック

### 6.1 採用技術

```
[フロントエンド]
  Next.js 15 (App Router) / React 19 / TypeScript / Tailwind CSS / shadcn/ui
  dnd-kit (G2 でドラッグ&ドロップ並び替え)

[バックエンド]
  Next.js Server Actions / Prisma ORM
  Auth.js v5 (Credentials Provider + bcrypt)

[データベース]
  PostgreSQL 16
  - ローカル: Docker Compose
  - 本番: AWS RDS

[コンテナ / CI / 本番]
  Docker / Docker Compose / GitHub Actions
  AWS (ECS Fargate / RDS / ALB / ECR / VPC / Route53 / ACM / Secrets Manager)

[IaC]
  Terraform
```

### 6.2 データモデル(v4.0 Prisma スキーマ抜粋)

```prisma
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
  id              String   @id @default(cuid())
  taskId          String
  task            Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  name            String
  order           Int
  startDate       DateTime  // 予定開始日
  endDate         DateTime  // 予定終了日
  actualStartDate DateTime? // 着手日 (= 実績バー開始)
  actualEndDate   DateTime? // 完了日 (= 100% 判定)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([taskId, order])
}

model TodoTemplate {
  id        String   @id @default(cuid())
  name      String
  order     Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([order])
}
```

**v3.3 からの削除カラム / モデル:**

- `Todo.weight` (重み廃止)
- `Todo.started` / `Todo.startedAt` / `Todo.completedAt` / `Todo.completed` (dual checkbox 廃止)
- DB CHECK 制約 `completed=true → started=true` (上記カラム廃止により不要)
- `DailyReport` モデル(I1 日報入力廃止に伴い廃止、過去履歴は v4.0 初期化時に破棄)

Auth.js 標準テーブル(User / Account / Session / VerificationToken)・Invitation・ProjectMember は v3.3 と同じ。

### 6.3 認証方針

- **認証ライブラリ:** Auth.js v5
- **プロバイダ:** Credentials Provider のみ(メール + パスワード)
- **ハッシュ:** bcrypt(saltRounds: 12)
- **セッション:** Database session(Prisma adapter)
- **認可:** ログイン済み AND `ProjectMember` に含まれるユーザーのみ全操作可能
- **登録:** 招待制のみ。`/invite/{token}` から A2 画面で初回パスワード設定 → 自動サインイン

### 6.4 環境変数

| ファイル       | 用途                     | git    |
| -------------- | ------------------------ | ------ |
| `.env`         | Docker Compose 用        | ignore |
| `.env.local`   | Next.js ホスト直接起動用 | ignore |
| `.env.example` | 上記2つのテンプレート    | commit |

両方の用途を考慮せず片方だけ書くと、もう一方の起動方式が壊れる(v3.x で確立した方針を踏襲)。

### 6.5 ディレクトリ構成

v3.x と同じ。v4.0 リセットで以下を撤去:

- `src/components/gantt/gantt-bar.tsx` の 5 状態描画ロジック(v4.0 は期間バーのみ)
- `src/components/gantt/hatch-pattern.tsx`(overdue ハッチ描画、廃止)
- `src/components/gantt/today-line.tsx` の 3 役判定(単純縦線に置換)
- `src/lib/weight.ts` + 関連テスト(重み廃止)
- `src/lib/forecast.ts` + 関連テスト(連鎖予測廃止)
- `src/lib/progress.ts` の `calcAggregateRenderStatus` / `renderStatus` 関連(廃止)
- `src/lib/__tests__/daily-report*.ts` の dual checkbox / actualPct テスト(廃止)

新規:

- `src/components/gantt/period-bar.tsx`(予定バー + 実績バー、期間のみ)
- `src/components/gantt/today-marker.tsx`(単純縦線)
- `src/lib/status.ts`(4 段階ステータス判定)
- `src/lib/progress.ts`(単純な完了率集計、期間日数加重)

### 6.6 CI / Docker / インフラ

v3.x と同じ。`compose.yaml`、`.github/workflows/ci.yml`、本番用 Dockerfile、Terraform モジュール構成はそのまま使用する。

---

## 7. 開発計画

### 7.1 段階的リリース

| フェーズ          | 内容                                                   | 価値                             | 状態 / 期間目安 |
| ----------------- | ------------------------------------------------------ | -------------------------------- | --------------- |
| **Phase 0**       | ローカル開発環境整備(Docker / DB / Auth / CI)          | 開発を始められる土台             | ✅ 完了         |
| **Phase 1**       | 認証 + 最低限の閲覧/入力(A1〜A5)+ G1/G2/G3 基本機能    | ログインして登録・進捗入力できる | ✅ 完了 (v4.0)  |
| Phase 2           | フィルター / サマリー / ドラッグ&ドロップ / 細部 UX    | 運用に耐える品質                 | 未着手          |
| Phase 3           | 遅延サマリーの強化 / ボトルネック可視化                | 予兆検知の実用                   | 未着手          |
| Phase 4           | AWS デプロイ(Terraform + ECS Fargate + RDS)            | 本番稼働                         | 未着手          |
| Phase 5 (Pending) | 連鎖予測 / 完了予測日 / 通知 / メール送信 / 履歴グラフ | 運用快適性の向上                 | —               |

### 7.2 v4.0 リセットの作業順序

Phase 0 の資産(認証 / DB / Docker / CI / Auth.js 二重構成 / 招待フロー / A1〜A5)は保持。Phase 1〜3 で積んだガント / 進捗計算 / dual checkbox を撤去し、v4.0 仕様で書き直す。

詳細は `plans/spec-v4-reset.md` を参照。

### 7.3 AI 駆動開発の活用方針

v3.x と同じ。`/blueprint` → 各ステップを `/implement` で進める。

---

## 8. 運用方針

### 8.1 認証・認可

- Auth.js v5 + Credentials Provider(メール + パスワード、bcrypt saltRounds: 12)
- 招待制(全体招待 or プロジェクト単位の招待)
- プロジェクトメンバー = 全操作可能(フラット)

### 8.2 データ運用(Phase 4 以降)

- バックアップ: RDS の自動バックアップ機能(7 日間保持)
- マイグレーション: Prisma Migrate、本番反映は CI から手動 trigger
- v4.0 移行時は `prisma migrate reset` を許容(独り動きフェーズのため)

### 8.3 拡張可能性(Phase 5 で再検討)

| 拡張                  | 想定実装                             |
| --------------------- | ------------------------------------ |
| 招待メール自動送信    | AWS SES                              |
| 通知                  | Slack webhook                        |
| 連鎖予測 / 完了予測日 | v3.x の `forecast.ts` を参考に再導入 |
| ロール区分            | `ProjectMember` に `role` 列を追加   |
| 履歴グラフ            | 日次スナップショットテーブルを追加   |

---

## 9. 非機能要件

| 項目               | 要件                                    |
| ------------------ | --------------------------------------- |
| 同時利用ユーザー数 | 当面2名、将来10名以内                   |
| 応答速度           | 主要操作 200ms 以内                     |
| 可用性             | ベストエフォート                        |
| ブラウザ対応       | Chrome / Safari / Firefox / Edge 最新版 |
| モバイル対応       | 閲覧のみ(入力は PC 優先)                |

---

## 10. 確定事項と Pending

### 10.1 確定事項(v4.0)

- [x] プロダクト名: フォーサイトマネジメント(リポジトリ名: `foresight`)
- [x] AI 駆動開発のキャッチアップが主目的、副目的として2人で実利用
- [x] 4階層構造(Project / Milestone / Task / ToDo)
- [x] 認証は Auth.js v5 + Credentials Provider(メール+パスワード、bcrypt)
- [x] ローカル: Docker Compose + PostgreSQL、本番: AWS RDS for PostgreSQL
- [x] 本番: AWS ECS Fargate + ALB + VPC、IaC: Terraform
- [x] CI: GitHub Actions、Phase 0 から導入
- [x] **【v4.0】ガントバーは期間のみを表す(進捗の塗りつぶしはしない)**
- [x] **【v4.0】進捗は数値のみで表す(予定 X% / 実績 Y%)**
- [x] **【v4.0】ToDo の進捗は `actualEndDate` の有無で 0% or 100%**
- [x] **【v4.0】Task 実績% = 完了 ToDo 数 / 全 ToDo 数(重みなし)**
- [x] **【v4.0】Milestone/Project 実績% は期間日数で加重平均**
- [x] **【v4.0】ステータスは 4 段階(完了 / 進行中 / 遅延 / 未着手)**
- [x] **【v4.0】今日線は単純な現在日付マーカー(3 役を兼ねない)**
- [x] **【v4.0】工程管理画面と進捗入力画面を分離(実績日は工程管理で扱わない)**
- [x] **【v4.0】Task 作成時に標準 ToDo 5 件を自動展開 (管理画面 /todo-templates で編集可)**

### 10.2 Pending(Phase 5 以降)

- [ ] 連鎖予測 / 完了予測日(v3.x で実装したが v4.0 で削除、再導入時は新仕様で)
- [ ] 招待メールの自動送信(AWS SES)
- [ ] パスワードリセット
- [ ] Slack / メール通知
- [ ] リアルタイム同期
- [ ] 履歴グラフ
- [ ] モバイル入力 UI
- [ ] エクスポート(CSV / PDF)
- [ ] ロール区分
- [ ] 5 段階以上のステータス細分化 / -20% 警告閾値

### 10.3 v3.x から明示的に破棄したもの

以下は v4.0 では実装しない / コードから削除する:

- 重み概念(`Todo.weight`、`redistributeWeights`)
- 集約バー 6 状態 RenderStatus(`calcAggregateRenderStatus`)
- ahead-of-schedule(M-04)/ dual checkbox(M-03)
- 5 段階ステータス / -20% 警告閾値
- 連鎖予測 / 完了予測日 / `forecast.ts`
- 今日線 3 役
- `DailyReport` モデル / I1 日報入力画面
- StatusPill 5 状態 / DaysPill / 集約バー描画ロジック

これらは Phase 5 で再評価する。再導入する場合も「バーで進捗を塗りつぶす」アプローチには戻らない。

---

## 改訂履歴

| 日付           | 版       | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-11     | v1.0     | 初版作成                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-12     | v2.0     | 管理系画面追加、ツリービュー上のインライン編集、ToDo重み均等割り、招待制ユーザー登録、ProjectMember / Invitation スキーマ追加                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-12     | v2.1     | プロダクト名「フォーサイトマネジメント」確定、Supabase 廃止 → 自前 PostgreSQL、Docker Compose 化、Phase 0 新設、GitHub Actions CI 追加                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-12     | v3.0     | 認証を Google OAuth から Credentials に変更。本番先を AWS ECS Fargate + RDS に変更。Terraform で IaC 化                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-13     | v3.1     | M-01: 日報を完了チェックボックスのみに変更、`actualPct` 廃止。M-02: `TodoTemplate` 自動展開                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-14     | v3.2     | M-03: ToDo に `started` 追加、デュアルチェックボックス化。GanttBar 5 状態視覚化                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-05-15     | v3.3     | M-04: `RenderStatus` に `'ahead-of-schedule'` 追加(集約バーで前倒し進行中描画)                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **2026-05-15** | **v4.0** | **大幅リセット。「バーで期間と進捗を同時に表現する」設計を破棄。バー=期間のみ、進捗=数値のみに方針転換。重み概念 / 今日線 3 役 / ahead-of-schedule / dual checkbox / 5 段階ステータス / -20% 閾値 / 連鎖予測 を全廃止。画面を A1〜A5 + G1(ガント表示) + G2(工程管理) + G3(進捗入力) に集約。ステータスは 4 段階。DB は `Todo.weight` / `started` / `startedAt` / `completedAt` / `completed` を削除し `actualStartDate` / `actualEndDate` を追加。`DailyReport` モデル廃止。新規 migration でリセット。詳細計画は `plans/spec-v4-reset.md`** |
| 2026-05-18     | v4.0.1   | 5 件目『テスト』→『レビュー』、他 4 件も短縮形に統一 (DB設計/BE開発/FE開発)。TodoTemplate 編集画面 `/todo-templates` を追加 (CRUD + 上下並び替え)。既存 Task に展開済みの Todo は変更なし (独立レコードのため)。                                                                                                                                                                                                                                                                                                                             |
