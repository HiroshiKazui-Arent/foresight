import { test, expect } from '@playwright/test'

test.describe('プロジェクト一覧', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects')
  })

  test('プロジェクト一覧が表示される', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'プロジェクト一覧' })).toBeVisible()
    await expect(page.getByRole('button', { name: '+ 新規プロジェクト' })).toBeVisible()
  })

  test('シードデータのプロジェクトが表示される', async ({ page }) => {
    await expect(page.getByText('フォーサイト開発プロジェクト(サンプル)')).toBeVisible()
  })

  test('プロジェクトをクリックすると詳細ページに遷移する', async ({ page }) => {
    await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
    await expect(page).toHaveURL(/\/projects\/[a-z0-9]+$/)
    await expect(page.getByText('フォーサイト開発プロジェクト(サンプル)')).toBeVisible()
  })
})

test.describe('プロジェクト詳細', () => {
  test('マイルストーン一覧が表示される', async ({ page }) => {
    await page.goto('/projects')
    await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
    await page.waitForURL(/\/projects\/[a-z0-9]+$/)

    await expect(page.getByText('要件定義フェーズ')).toBeVisible()
    await expect(page.getByText('開発フェーズ')).toBeVisible()
  })

  test('「日報入力」リンクが表示される', async ({ page }) => {
    await page.goto('/projects')
    await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
    await page.waitForURL(/\/projects\/[a-z0-9]+$/)

    await expect(page.getByRole('link', { name: '日報入力' })).toBeVisible()
  })
})

test.describe('新規プロジェクト作成', () => {
  test('ダイアログが開閉できる', async ({ page }) => {
    await page.goto('/projects')
    await page.getByRole('button', { name: '+ 新規プロジェクト' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: '新規プロジェクト作成' })).toBeVisible()

    await page.getByRole('button', { name: 'キャンセル' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })
})
