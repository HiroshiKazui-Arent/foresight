# フォーサイトマネジメント (foresight)

開発スケジュール管理ツール。「遅延を予兆段階で気づく」がビジョン。

仕様の単一情報源は [`docs/spec.md`](./docs/spec.md)、開発ガイドは [`CLAUDE.md`](./CLAUDE.md) を参照。

## 必要環境

- Node.js 20+
- Docker / Docker Compose

## セットアップ

### 1. 依存インストール

```bash
npm install
```

### 2. 環境変数

`.env.example` を `.env` と `.env.local` の両方にコピーする。

```bash
cp .env.example .env
cp .env.example .env.local
```

`.env` は Docker Compose、`.env.local` は Next.js ホスト直接起動のときに使う（両方必要）。

### 3. PostgreSQL を起動

```bash
docker compose up -d postgres
```

### 4. DB マイグレーション

```bash
npm run db:migrate
```

### 5. シーダー実行（初期データ投入）

```bash
npm run db:seed
```

投入される初期ユーザー:

| メール              | パスワード    | 役割   |
| ------------------- | ------------- | ------ |
| `admin@example.com` | `password123` | 管理者 |
| `pm@example.com`    | `password123` | PM     |

サンプルのプロジェクト / マイルストーン / タスク / ToDo（v4.0 の 4 状態 + 未着手リスクのデモ）も合わせて作成される。

シーダーは冪等ではないので、再投入したい場合は先に DB をリセットする:

```bash
npx prisma migrate reset   # マイグレーション + シード を再実行
```

## 開発サーバー起動

### Docker Compose（推奨、postgres + app 両方）

```bash
docker compose up -d
```

### ホスト直接起動（postgres だけ Docker）

```bash
docker compose up -d postgres
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開いてアクセス。

## よく使うコマンド

### CI と等価のチェック（PR 前に必ず）

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest（単体テスト）
npm run build       # next build
```

### DB 操作

```bash
npm run db:migrate    # prisma migrate dev（スキーマ変更時）
npm run db:push       # prisma db push（マイグレーション無しで反映、検証用）
npm run db:seed       # 初期データ投入
npm run db:studio     # Prisma Studio で DB を GUI 確認
npm run db:generate   # Prisma Client 再生成
```

### E2E テスト

```bash
npm run e2e           # Playwright 実行
npm run e2e:ui        # Playwright UI モード
```

## ドキュメント

- [`docs/spec.md`](./docs/spec.md) — 仕様書（単一情報源、v4.0）
- [`CLAUDE.md`](./CLAUDE.md) — Claude Code / 開発者向けガイド
