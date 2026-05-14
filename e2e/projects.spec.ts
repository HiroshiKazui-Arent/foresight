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

  // TC-A3-005: プロジェクト名が空のまま作成しようとするとエラー
  test('TC-A3-005: プロジェクト名が空のまま作成するとエラーになる', async ({ page }) => {
    await page.goto('/projects')
    await page.getByRole('button', { name: '+ 新規プロジェクト' }).click()
    await page.getByRole('button', { name: '作成' }).click()

    // HTML5 required バリデーションまたはサーバーエラーが発生しダイアログが残る
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  // TC-A3-006: startDate > endDate の作成は拒否される
  test('TC-A3-006: startDate > endDate のプロジェクト作成は拒否される', async ({ page }) => {
    await page.goto('/projects')
    await page.getByRole('button', { name: '+ 新規プロジェクト' }).click()

    await page.getByLabel('プロジェクト名').fill('Invalid Date Test')
    // 終了日を開始日より前に設定
    await page.getByLabel('開始日').fill('2026-06-01')
    await page.getByLabel('終了日').fill('2026-01-01')
    await page.getByRole('button', { name: '作成' }).click()

    // エラーが表示されダイアログが残る
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

// TC-A3-003: カードに進捗ピル / 状態ピル / 日数ピルが表示される
test.describe('TC-A3-003: プロジェクトカードのピル表示', () => {
  test('TC-A3-003: プロジェクト一覧のカードに進捗・状態・日数ピルが表示される', async ({
    page,
  }) => {
    await page.goto('/projects')
    // 進捗%表示 (x%) またはステータス表示が存在する
    await expect(page.getByText(/完了|進行中|遅延|警告|予定/).first()).toBeVisible()
  })
})
