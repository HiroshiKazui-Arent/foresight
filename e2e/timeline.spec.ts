import { test, expect, type Page } from '@playwright/test'

async function navigateToMilestonePage(page: Page) {
  await page.goto('/projects')
  await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
  await page.waitForURL(/\/projects\/[a-z0-9]+$/)

  // 最初のマイルストーン(要件定義フェーズ)のタイムラインアイコンリンク
  await page.getByRole('link', { name: 'タイムラインビューで開く' }).first().click()
  await page.waitForURL(/\/milestones\/[a-z0-9]+$/)
}

// TC-V2-001: URL クエリで特定 Milestone 指定 → その期間にズームされる
test('TC-V2-001: マイルストーン詳細 URL に直接アクセスしてタイムラインが表示される', async ({
  page,
}) => {
  // プロジェクト詳細から milestone URL を取得
  await page.goto('/projects')
  await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
  await page.waitForURL(/\/projects\/[a-z0-9]+$/)

  const link = page.getByRole('link', { name: 'タイムラインビューで開く' }).first()
  const href = await link.getAttribute('href')
  expect(href).toMatch(/\/milestones\/[a-z0-9]+$/)

  await page.goto(href!)
  await expect(page.getByText('要件定義フェーズ').first()).toBeVisible()
})

// TC-V2-002: V1 と同じ視覚言語 (バー/ピル/今日線) の踏襲確認
test('TC-V2-002: タイムライン画面にステータスピルが存在する', async ({ page }) => {
  await page.goto('/projects')
  await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
  await page.waitForURL(/\/projects\/[a-z0-9]+$/)
  await page.getByRole('link', { name: 'タイムラインビューで開く' }).first().click()
  await page.waitForURL(/\/milestones\/[a-z0-9]+$/)

  // 少なくとも 1 つのステータス表示が存在する
  await expect(page.getByText(/完了|進行中|遅延|警告|予定/).first()).toBeVisible()
})

// TC-V2-003: Milestone 範囲外の Task 表示クリップ確認 (P2)
test.skip('TC-V2-003: Milestone 範囲外の Task 表示クリップ (P2)', () => {})

test.describe('タイムライン画面', () => {
  test('マイルストーンのタイムラインが表示される', async ({ page }) => {
    await navigateToMilestonePage(page)

    await expect(page.getByText('要件定義フェーズ').first()).toBeVisible()
    await expect(page.getByText('ユーザーヒアリング')).toBeVisible()
    await expect(page.getByText('要件ドキュメント作成')).toBeVisible()
  })

  test('パンくずリストで前のページに戻れる', async ({ page }) => {
    await navigateToMilestonePage(page)

    await page.getByRole('link', { name: /← フォーサイト開発プロジェクト/ }).click()
    await expect(page).toHaveURL(/\/projects\/[a-z0-9]+$/)
  })

  test('ToDo 一覧が表示される', async ({ page }) => {
    await navigateToMilestonePage(page)

    // タスク行を展開して ToDo を表示する
    await page.getByRole('button', { name: '展開する' }).first().click()

    await expect(page.getByText('利用者インタビュー')).toBeVisible()
    await expect(page.getByText('ペルソナ定義')).toBeVisible()
  })
})
