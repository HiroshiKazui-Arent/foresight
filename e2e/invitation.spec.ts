import { test, expect } from '@playwright/test'
import {
  createTestInvitation,
  deleteTestInvitation,
  deleteTestUser,
} from './fixtures/prisma-fixture'

// 招待フローのテストは認証不要(招待受諾は非ログインユーザー向け)
test.use({ storageState: { cookies: [], origins: [] } })

// TC-A2-001: 有効なトークンでパスワード設定 → 自動サインインで /projects に到達
test('TC-A2-001: 有効なトークンでパスワード設定後、/projects にリダイレクトされる', async ({
  page,
}) => {
  const email = `e2e-valid-${Date.now()}@example.com`
  const invitation = await createTestInvitation({ email })

  try {
    await page.goto(`/invite/${invitation.token}`)
    await expect(page.getByRole('heading', { name: /招待を承認/ })).toBeVisible()

    await page.getByLabel('氏名').fill('E2E Test User')
    await page.getByLabel(/パスワード/).fill('password123')
    await page.getByRole('button', { name: /アカウントを作成/ }).click()

    await expect(page).toHaveURL('/projects', { timeout: 15000 })
  } finally {
    await deleteTestInvitation(invitation.id)
    await deleteTestUser(email)
  }
})

// TC-A2-002: 期限切れトークンでアクセス → エラー画面
test('TC-A2-002: 期限切れトークンでアクセスするとエラー画面が表示される', async ({ page }) => {
  const email = `e2e-expired-${Date.now()}@example.com`
  const invitation = await createTestInvitation({
    email,
    expiresAt: new Date(Date.now() - 1000), // 過去の日時
  })

  try {
    await page.goto(`/invite/${invitation.token}`)
    await expect(page.getByText('招待が無効です')).toBeVisible()
  } finally {
    await deleteTestInvitation(invitation.id)
  }
})

// TC-A2-003: REVOKED トークンでアクセス → エラー画面
test('TC-A2-003: REVOKED トークンでアクセスするとエラー画面が表示される', async ({ page }) => {
  const email = `e2e-revoked-${Date.now()}@example.com`
  const invitation = await createTestInvitation({ email, status: 'REVOKED' })

  try {
    await page.goto(`/invite/${invitation.token}`)
    await expect(page.getByText('招待が無効です')).toBeVisible()
  } finally {
    await deleteTestInvitation(invitation.id)
  }
})

// TC-A2-004: ACCEPTED 済みトークンでアクセス → エラー画面
test('TC-A2-004: ACCEPTED 済みトークンでアクセスするとエラー画面が表示される', async ({ page }) => {
  const email = `e2e-accepted-${Date.now()}@example.com`
  const invitation = await createTestInvitation({ email, status: 'ACCEPTED' })

  try {
    await page.goto(`/invite/${invitation.token}`)
    await expect(page.getByText('招待が無効です')).toBeVisible()
  } finally {
    await deleteTestInvitation(invitation.id)
  }
})

// TC-A2-005: 存在しないトークン → エラー画面
test('TC-A2-005: 存在しないトークンでアクセスするとエラー画面が表示される', async ({ page }) => {
  await page.goto('/invite/this-token-does-not-exist-xyz')
  await expect(page.getByText('招待が無効です')).toBeVisible()
})

// TC-INV-002: 招待リンクが /invite/{token} の形式で表示される (ログイン済みで /users から確認)
test.describe('TC-INV-002: 招待リンクの形式確認', () => {
  test.use({ storageState: 'e2e/.auth/user.json' })

  test('TC-INV-002: /users で招待リンクを生成すると /invite/{token} 形式で表示される', async ({
    page,
  }) => {
    await page.goto('/users')
    await page.getByRole('button', { name: '+ ユーザーを招待' }).click()
    await page.getByLabel('招待するメールアドレス').fill(`e2e-inv002-${Date.now()}@example.com`)
    await page.getByRole('button', { name: '招待リンクを生成' }).click()

    // 招待リンクが /invite/ で始まることを確認
    const linkText = page.locator('span.truncate')
    await expect(linkText).toBeVisible()
    const link = await linkText.textContent()
    expect(link).toMatch(/\/invite\/[A-Za-z0-9_-]+/)
  })
})
