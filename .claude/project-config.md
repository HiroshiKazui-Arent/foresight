# Project Config

## レイヤー構造

| パスプレフィックス              | commit type(scope) | 説明                               |
| ------------------------------- | ------------------ | ---------------------------------- |
| prisma/                         | feat(db)           | スキーマ・マイグレーション・シード |
| src/types/                      | feat(types)        | 型定義                             |
| src/lib/                        | feat(lib)          | ビジネスロジック・ユーティリティ   |
| src/lib/**tests**/              | test(lib)          | lib のテスト                       |
| src/server/                     | feat(server)       | Server Actions                     |
| src/components/                 | feat(ui)           | UI コンポーネント                  |
| src/components/**tests**/       | test(ui)           | UI コンポーネントのテスト          |
| src/app/                        | feat(page)         | ページ・ルート                     |
| e2e/                            | test(e2e)          | Playwright E2E テスト              |
| playwright.config.ts            | test(e2e)          | Playwright 設定                    |
| .github/workflows/              | ci                 | GitHub Actions ワークフロー        |
| plans/ docs/                    | docs               | ドキュメント・計画                 |
| package.json package-lock.json  | chore(deps)        | 依存関係                           |
| .gitignore .prettierrc eslint\* | chore              | ツール設定                         |
