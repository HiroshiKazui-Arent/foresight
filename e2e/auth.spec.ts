import { test, expect } from '@playwright/test'

// このファイルの大半のテストは認証不要 (storageState を上書きして使う)
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('ログイン画面', () => {
  test('未ログイン時は /login にリダイレクトされる', async ({ page }) => {
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/login/)
  })

  test('ログイン画面が表示される', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('メールアドレス')).toBeVisible()
    await expect(page.getByLabel('パスワード')).toBeVisible()
    await expect(page.getByRole('button', { name: 'サインイン' })).toBeVisible()
  })

  test('正しい認証情報でログインできる', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('メールアドレス').fill('admin@example.com')
    await page.getByLabel('パスワード').fill('password123')
    await page.getByRole('button', { name: 'サインイン' }).click()

    await expect(page).toHaveURL('/projects')
    await expect(page.getByRole('heading', { name: 'プロジェクト一覧' })).toBeVisible()
  })

  test('誤った認証情報でエラーが表示される', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('メールアドレス').fill('admin@example.com')
    await page.getByLabel('パスワード').fill('wrongpassword')
    await page.getByRole('button', { name: 'サインイン' }).click()

    await expect(page.getByText('メールアドレスまたはパスワードが正しくありません')).toBeVisible()
    await expect(page).toHaveURL('/login')
  })

  // TC-A1-004: パスワード未入力で送信 → フォームバリデーションエラー
  test('TC-A1-004: パスワード未入力で送信するとバリデーションエラーが発生する', async ({
    page,
  }) => {
    await page.goto('/login')
    await page.getByLabel('メールアドレス').fill('admin@example.com')
    await page.getByRole('button', { name: 'サインイン' }).click()

    // HTML5 required バリデーションまたはサーバーエラーが発生し /login に留まる
    await expect(page).toHaveURL('/login')
  })

  // TC-A1-005: メール形式不正で送信 → フォームバリデーションエラー
  test('TC-A1-005: メール形式不正で送信するとバリデーションエラーが発生する', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('メールアドレス').fill('not-an-email')
    await page.getByLabel('パスワード').fill('password123')
    await page.getByRole('button', { name: 'サインイン' }).click()

    // HTML5 email バリデーションまたはサーバーエラーが発生し /login に留まる
    await expect(page).toHaveURL('/login')
  })
})

// TC-A1-006: ログイン済みで /login にアクセス → /projects にリダイレクト
test.describe('ログイン済みの /login アクセス', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test('TC-A1-006: ログイン済みユーザーが /login にアクセスすると /projects にリダイレクトされる', async ({
    page,
  }) => {
    await page.goto('/login')
    await expect(page).toHaveURL('/projects')
  })
})
