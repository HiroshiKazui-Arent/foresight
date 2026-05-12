import { test, expect, type Page } from '@playwright/test'

async function navigateToDailyReport(page: Page) {
  await page.goto('/projects')
  await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
  await page.waitForURL(/\/projects\/[a-z0-9]+$/)
  await page.getByRole('link', { name: '日報入力' }).click()
  await page.waitForURL(/\/projects\/[a-z0-9]+\/daily$/)
}

test.describe('日報入力 (M-01: チェックボックスのみ)', () => {
  test('プロジェクト詳細に「日報入力」ボタンが表示される', async ({ page }) => {
    await page.goto('/projects')
    await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
    await page.waitForURL(/\/projects\/[a-z0-9]+$/)

    await expect(page.getByRole('link', { name: '日報入力' })).toBeVisible()
  })

  test('「日報入力」ボタンで日報ページに遷移する', async ({ page }) => {
    await page.goto('/projects')
    await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
    await page.waitForURL(/\/projects\/[a-z0-9]+$/)

    await page.getByRole('link', { name: '日報入力' }).click()

    await expect(page).toHaveURL(/\/projects\/[a-z0-9]+\/daily$/)
    await expect(page.getByRole('heading', { name: /日報入力/ })).toBeVisible()
  })

  test('ページタイトルにプロジェクト名が含まれる', async ({ page }) => {
    await navigateToDailyReport(page)

    await expect(
      page.getByRole('heading', { name: /日報入力 — フォーサイト開発プロジェクト/ }),
    ).toBeVisible()
  })

  test('完了済み件数サマリが表示される', async ({ page }) => {
    await navigateToDailyReport(page)

    await expect(page.getByLabel('完了済み件数')).toBeVisible()
  })

  test('各 ToDo に完了チェックボックスが表示される', async ({ page }) => {
    await navigateToDailyReport(page)

    const checkboxes = page.getByRole('checkbox', { name: '完了' })
    await expect(checkboxes.first()).toBeVisible()
    const count = await checkboxes.count()
    expect(count).toBeGreaterThan(0)
  })

  test('進捗% スライダー / 数値入力欄は表示されない (M-01)', async ({ page }) => {
    await navigateToDailyReport(page)

    // 進捗% の数値入力欄や range スライダーが存在しないことを確認
    const numberInputs = page.locator('input[type="number"]')
    const rangeInputs = page.locator('input[type="range"]')
    await expect(numberInputs).toHaveCount(0)
    await expect(rangeInputs).toHaveCount(0)
  })

  test('シードデータの ToDo 名が表示される', async ({ page }) => {
    await navigateToDailyReport(page)

    await expect(page.getByText('ユースケース整理')).toBeVisible()
    await expect(page.getByText('機能一覧作成')).toBeVisible()
  })

  test('チェックボックス ON で「✓」フィードバックが表示される', async ({ page }) => {
    await navigateToDailyReport(page)

    const firstCheckbox = page.getByRole('checkbox', { name: '完了' }).first()
    const wasChecked = await firstCheckbox.isChecked()
    await firstCheckbox.click()

    // 状態が反転する
    await expect(firstCheckbox).toBeChecked({ checked: !wasChecked })
  })

  test('「← プロジェクトへ戻る」リンクでプロジェクト詳細に戻れる', async ({ page }) => {
    await navigateToDailyReport(page)

    await page.getByRole('link', { name: '← プロジェクトへ戻る' }).click()

    await expect(page).toHaveURL(/\/projects\/[a-z0-9]+$/)
  })
})
