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

// M-03: デュアルチェックボックス + 5状態視覚確認
test.describe('日報入力 (M-03: デュアルチェックボックス)', () => {
  test('各 ToDo に「開始」チェックボックスが表示される', async ({ page }) => {
    await navigateToDailyReport(page)

    const startedCheckboxes = page.getByRole('checkbox', { name: '開始' })
    await expect(startedCheckboxes.first()).toBeVisible()
    const count = await startedCheckboxes.count()
    expect(count).toBeGreaterThan(0)
  })

  test('「開始」と「完了」チェックボックスの件数が一致する', async ({ page }) => {
    await navigateToDailyReport(page)

    const startedCount = await page.getByRole('checkbox', { name: '開始' }).count()
    const completedCount = await page.getByRole('checkbox', { name: '完了' }).count()
    expect(startedCount).toBe(completedCount)
    expect(startedCount).toBeGreaterThan(0)
  })

  test('未開始の ToDo は「完了」チェックボックスが disabled', async ({ page }) => {
    await navigateToDailyReport(page)

    // シードデータの "[State4]" ToDo は started=false (未着手 overdue)
    await expect(page.getByText('[State4]')).toBeVisible()

    // data-testid="todo-input-row" を持つ行の中で "[State4]" を含むものを特定
    const state4Row = page
      .locator('[data-testid="todo-input-row"]')
      .filter({ has: page.getByText('[State4]') })
    const completedCb = state4Row.getByRole('checkbox', { name: '完了' })
    await expect(completedCb).toBeDisabled()
  })

  test('M-03 ハッピーパス: 「開始」→「完了」遷移 ([State4] 未着手 ToDo)', async ({ page }) => {
    await navigateToDailyReport(page)

    await expect(page.getByText('[State4]')).toBeVisible()

    const state4Row = page
      .locator('[data-testid="todo-input-row"]')
      .filter({ has: page.getByText('[State4]') })
    const startedCb = state4Row.getByRole('checkbox', { name: '開始' })
    const completedCb = state4Row.getByRole('checkbox', { name: '完了' })

    // 初期状態: 開始=false, 完了=disabled
    await expect(startedCb).not.toBeChecked()
    await expect(completedCb).toBeDisabled()

    // 「開始」クリック → 完了が enabled に
    await startedCb.click()
    await expect(completedCb).toBeEnabled({ timeout: 5000 })
    await expect(startedCb).toBeChecked()

    // 「完了」クリック → 両方チェック済みに
    await completedCb.click()
    await expect(completedCb).toBeChecked({ timeout: 5000 })
    await expect(startedCb).toBeChecked()
  })

  test('5状態デモ: ツリービューに超過・未着ステータスが表示される', async ({ page }) => {
    await navigateToDailyReport(page)

    // シードデータの [State3] / [State4] に対応するピルが表示される
    await expect(page.getByText('[State3]')).toBeVisible()
    await expect(page.getByText('[State4]')).toBeVisible()

    // StatusPill に「超過」または「未着」ラベルが存在する
    const overdueLabels = page.getByText(/超過|未着/)
    await expect(overdueLabels.first()).toBeVisible()
  })
})
