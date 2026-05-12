import { test as base } from '@playwright/test'

// global.setup.ts で保存した認証状態を使うフィクスチャ
// playwright.config.ts の storageState で自動適用されるため、
// 現状は base の再エクスポートのみ。追加フィクスチャはここに追記する。
export { expect } from '@playwright/test'
export const test = base
