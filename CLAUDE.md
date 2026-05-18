# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクトの性質

**フォーサイトマネジメント** — 開発スケジュール管理ツール。「遅延を予兆段階で気づく」がビジョン。

- **主目的:** AI 駆動開発(Claude Code 等)のキャッチアップ
- **副目的:** 本人 + PM の2名で実利用
- 仕様の単一情報源は **`docs/spec.md`** (v3.0)。設計判断で迷ったら必ず参照すること。

## 開発計画と現在地

Phase 構成は `docs/spec.md` 7節に詳細あり。

| Phase       | 内容                                                                      | 状態           |
| ----------- | ------------------------------------------------------------------------- | -------------- |
| **Phase 0** | ローカル開発環境 (Docker / Prisma / Auth.js / CI)                         | ✅ 完了        |
| **Phase 1** | 認証 + A1〜A5 + G1 ガント表示 + G2 工程管理 + G3 進捗入力 (v4.0 リセット) | ✅ 完了 (v4.0) |
| Phase 2     | フィルター / サマリー / 細部 UX 強化                                      | 未着手         |
| Phase 3     | 遅延サマリー強化 / ボトルネック可視化                                     | 未着手         |
| Phase 4     | AWS デプロイ (Terraform + ECS Fargate)                                    | 未着手         |
| Phase 5     | Pending (連鎖予測 / 完了予測 / 通知 / メール送信等)                       | —              |

Phase 4 までは AWS を触らない。インフラ作業を機能実装に混ぜないこと。

## よく使うコマンド

### 開発サーバー

```bash
# Docker Compose (推奨、postgres + app 両方起動)
docker compose up -d

# ホスト直接 (postgres だけ Docker)
docker compose up -d postgres
npm run dev
```

### CI と等価のチェック (PR 前に必ず)

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest (一回実行)
npm run build       # next build
```

単体テストのウォッチ実行は `npm run test:watch`。

### DB 操作

```bash
npm run db:migrate    # prisma migrate dev (スキーマ変更時)
npm run db:push       # prisma db push (スキーマ→DB を migration なしで反映、検証用)
npm run db:seed       # 初期ユーザー投入 (admin@example.com / pm@example.com、password: password123)
npm run db:studio     # Prisma Studio で DB を GUI 確認
npm run db:generate   # Prisma Client 再生成
```

DB スキーマを編集したら **必ず** `npm run db:migrate` で migration ファイルを生成すること。`db:push` は migration を残さないので恒久利用しないこと。

## アーキテクチャ要点

### 4階層データモデル (`docs/spec.md` 3節)

```
Project → Milestone → Task → ToDo
```

- **ToDo のみ人が直接入力** (進捗% または完了チェック)
- **Task/Milestone/Project は配下から自動算出** (重み付き合計)
- **ToDo の重みは UI から入力不可、均等割り**。端数は最後の ToDo に寄せる (`docs/spec.md` 6.7節)

### 進捗計算ロジック (`docs/spec.md` 4節)

- 予定進捗 = 経過日数比例 (`(今日 - 開始日) / (期日 - 開始日) × 100`)
- Task 以上の重みは **期間日数**を使う (ToDo の重みは別)
- 5段階ステータス: 完了 / 進行中 / 遅延 / 警告 / 予定 — 閾値は **-20%** (警告)
- 「今日線」はガントチャート上で **3役を兼ねる**: 現在日付 + 各バーの予定%位置 + 実績との境界。設計上の中核なので無闇に分割しないこと。

### Auth.js v5 の二重構成 (重要)

`src/lib/` に2ファイルあるのは意図的:

- **`auth.config.ts`** — Edge runtime 対応の軽量設定 (callbacks, pages のみ)。`middleware.ts` から import される。
- **`auth.ts`** — `auth.config.ts` をスプレッドし、`PrismaAdapter` と `Credentials` provider (bcrypt 利用) を追加。Server Component / Server Action から import する。

**理由:** Prisma と bcrypt は Node.js API に依存し Edge runtime で動かないため。middleware に `auth.ts` を import するとビルドで warning + middleware bundle が 25kB ほど肥大化する。

新しい認証ロジックを追加する際は、Edge で動くもの → `auth.config.ts`、Node でしか動かないもの → `auth.ts` に分けること。

### 認証フロー

- **方式:** Auth.js v5 + Credentials Provider (メール + パスワード、bcrypt saltRounds: 12)
- **セッション:** Database session (Prisma adapter 経由)
- **認可:** ログイン済み AND `ProjectMember` に含まれるユーザーのみ、当該プロジェクトを全操作可能 (ロール区分なし、フラット)
- **登録:** 招待制のみ。`/invite/{token}` から A2 画面でパスワード設定 → 自動サインイン。メール自動送信は Phase 5 (現状はリンクをコピーして手渡し)

### 環境変数の二重管理

| ファイル       | 用途                                              | git    |
| -------------- | ------------------------------------------------- | ------ |
| `.env`         | **Docker Compose** が `${AUTH_SECRET}` 展開に使う | ignore |
| `.env.local`   | **Next.js 直接起動**時に Next.js が読む           | ignore |
| `.env.example` | 上記2つのテンプレート                             | commit |

両方の用途を考慮せず片方だけ書くと、もう一方の起動方式が壊れる。

### CI と本番ビルドの整合

`compose.yaml` の `app` サービスが使う `Dockerfile.dev` と、CI (`.github/workflows/ci.yml`) と、Phase 4 で使う `docker/app/Dockerfile` (本番) は **同一の `package.json` / `prisma generate` を前提**に動く。依存追加時はこの 3 経路すべてが通ることを意識する。

## 仕様変更の判断基準

- `docs/spec.md` 10.1節「確定事項」に列挙された設計判断は **動かさない** (4階層 / 重み均等割り / 今日線3役 / -20%閾値 / 招待制 / Auth.js v5 / AWS ECS Fargate / Terraform 等)
- 「Pending」(10.2節) に該当する機能は Phase 5 まで実装しない
- 仕様を変える必要が出たら spec.md を先に更新し、改訂履歴に追記する

## コードスタイル

- Prettier: セミコロン無し、シングルクォート、`printWidth: 100`、`trailingComma: all`
- パスエイリアス: `@/*` → `src/*`
- UI 文言は日本語、コメントも日本語可
- `lint-staged` が pre-commit で `eslint --fix` + `prettier --write` を走らせる
