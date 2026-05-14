import { test, expect } from '@playwright/test'

test.describe('ユーザー管理 (TC-A5)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/users')
  })

  // TC-A5-001: 全ユーザー一覧が表示される
  test('TC-A5-001: ユーザー一覧が表示される', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'ユーザー管理' })).toBeVisible()
    await expect(page.getByText('ユーザー一覧')).toBeVisible()
    // シードデータのユーザーが表示される
    await expect(page.getByText('admin@example.com')).toBeVisible()
  })

  // TC-A5-002: PENDING Invitation 一覧が表示される
  test('TC-A5-002: 招待一覧セクションが表示される', async ({ page }) => {
    await expect(page.getByText('招待一覧')).toBeVisible()
    await expect(page.getByRole('button', { name: '+ ユーザーを招待' })).toBeVisible()
  })

  // TC-A5-003: 招待取り消しで status=REVOKED に更新される
  test('TC-A5-003: PENDING 招待を作成して取り消すと「取り消し済」になる', async ({ page }) => {
    const email = `e2e-revoke-${Date.now()}@example.com`

    // 招待を作成
    await page.getByRole('button', { name: '+ ユーザーを招待' }).click()
    await page.getByLabel('招待するメールアドレス').fill(email)
    await page.getByRole('button', { name: '招待リンクを生成' }).click()
    await page.getByRole('button', { name: '閉じる' }).click()

    // 招待一覧に表示される
    await expect(page.getByText(email)).toBeVisible()
    await expect(page.getByText('招待中').first()).toBeVisible()

    // 取り消し
    const row = page.locator('tr').filter({ hasText: email })
    await row.getByRole('button', { name: '取り消し' }).click()

    // 「取り消し済」に変わる
    await expect(
      page.locator('tr').filter({ hasText: email }).getByText('取り消し済'),
    ).toBeVisible()
  })

  // TC-A5-004: 招待 URL のコピーボタンが表示される
  test('TC-A5-004: 招待生成後にコピーボタンが表示される', async ({ page }) => {
    await page.getByRole('button', { name: '+ ユーザーを招待' }).click()
    await page.getByLabel('招待するメールアドレス').fill(`e2e-copy-${Date.now()}@example.com`)
    await page.getByRole('button', { name: '招待リンクを生成' }).click()

    await expect(page.getByRole('button', { name: 'コピー' })).toBeVisible()
    await page.getByRole('button', { name: '閉じる' }).click()
  })
})
