import { test, expect, type Page } from '@playwright/test'

async function navigateToTaskDetail(page: Page, taskName: string) {
  await page.goto('/projects')
  await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
  await page.waitForURL(/\/projects\/[a-z0-9]+$/)

  // タスク名の隣にある「→」(aria-label="タスク詳細を開く") リンクで遷移
  // 対象タスクのセクションを特定してからクリック
  const taskLink = page
    .locator('div')
    .filter({ hasText: taskName })
    .getByRole('link', { name: 'タスク詳細を開く' })
    .first()
  await taskLink.click()
  await page.waitForURL(/\/tasks\/[a-z0-9]+$/)
}

test.describe('タスク詳細 (V3)', () => {
  test('タスク詳細リンク（→）が各タスクに表示される', async ({ page }) => {
    await page.goto('/projects')
    await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
    await page.waitForURL(/\/projects\/[a-z0-9]+$/)

    const taskDetailLinks = page.getByRole('link', { name: 'タスク詳細を開く' })
    await expect(taskDetailLinks.first()).toBeVisible()
  })

  test('タスク詳細ページにタスク名と ToDo 一覧が表示される', async ({ page }) => {
    await navigateToTaskDetail(page, 'ユーザーヒアリング')

    await expect(page.getByRole('heading', { name: 'ユーザーヒアリング' })).toBeVisible()
    await expect(page.getByText('ToDo 一覧')).toBeVisible()
    await expect(page.getByText('利用者インタビュー')).toBeVisible()
    await expect(page.getByText('ペルソナ定義')).toBeVisible()
    await expect(page.getByText('ユースケース整理')).toBeVisible()
  })

  test('パンくずリストにプロジェクト・マイルストーン・タスク名が表示される', async ({ page }) => {
    await navigateToTaskDetail(page, 'ユーザーヒアリング')

    await expect(
      page.getByRole('link', { name: 'フォーサイト開発プロジェクト(サンプル)' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: '要件定義フェーズ' })).toBeVisible()
    await expect(page.getByText('ユーザーヒアリング').first()).toBeVisible()
  })

  test('タスク進捗バーと StatusPill が表示される', async ({ page }) => {
    await navigateToTaskDetail(page, 'ユーザーヒアリング')

    await expect(page.getByText('タスク進捗')).toBeVisible()
    // StatusPill: completed/on-track/delayed/warning/scheduled のいずれか
    await expect(page.getByText(/完了|進行中|遅延|警告|予定/).first()).toBeVisible()
  })

  test('「+」ボタンで ToDo 追加フォームが開く', async ({ page }) => {
    await navigateToTaskDetail(page, 'ユーザーヒアリング')

    await page.getByRole('button', { name: '+' }).click()

    await expect(page.getByPlaceholder('ToDo 名')).toBeVisible()
    await expect(page.getByRole('button', { name: '追加' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'キャンセル' })).toBeVisible()
  })

  test('追加フォームをキャンセルで閉じられる', async ({ page }) => {
    await navigateToTaskDetail(page, 'ユーザーヒアリング')

    await page.getByRole('button', { name: '+' }).click()
    await expect(page.getByPlaceholder('ToDo 名')).toBeVisible()

    await page.getByRole('button', { name: 'キャンセル' }).click()
    await expect(page.getByPlaceholder('ToDo 名')).not.toBeVisible()
  })

  test('ToDo を追加したあと削除できる', async ({ page }) => {
    await navigateToTaskDetail(page, 'ユーザーヒアリング')

    // テスト実行ごとにユニークな名前を使う（DB に残った前回のデータと衝突しないため）
    const todoName = `E2E テスト用 ToDo ${Date.now()}`

    // 追加フォームを開く
    await page.getByRole('button', { name: '+' }).click()
    await page.getByPlaceholder('ToDo 名').fill(todoName)

    // 日付は当日から3日後（開始 < 終了 を保証）
    const today = new Date()
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const startStr = fmt(today)
    const endDate = new Date(today)
    endDate.setDate(endDate.getDate() + 3)
    const endStr = fmt(endDate)

    await page.locator('label').filter({ hasText: '開始日' }).locator('+ input').fill(startStr)
    await page.locator('label').filter({ hasText: '終了日' }).locator('+ input').fill(endStr)
    await page.getByRole('button', { name: '追加' }).click()

    // 追加されたことを確認
    await expect(page.getByText(todoName)).toBeVisible()

    // 追加した ToDo の行を特定して削除（confirm ダイアログを許可）
    const todoRow = page.locator('div.rounded-md').filter({ hasText: todoName })
    page.once('dialog', (dialog) => dialog.accept())
    await todoRow.getByRole('button', { name: 'ToDo を削除' }).click()

    await expect(page.getByText(todoName)).not.toBeVisible()
  })

  test('「← プロジェクトに戻る」リンクでプロジェクト詳細に戻れる', async ({ page }) => {
    await navigateToTaskDetail(page, 'ユーザーヒアリング')

    await page.getByRole('link', { name: '← プロジェクトに戻る' }).click()

    await expect(page).toHaveURL(/\/projects\/[a-z0-9]+$/)
  })
})
