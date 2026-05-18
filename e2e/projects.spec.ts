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

  test('「入力」ボタンが Task 行に表示される (v4.0)', async ({ page }) => {
    await page.goto('/projects')
    await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
    await page.waitForURL(/\/projects\/[a-z0-9]+$/)

    // G1 ガント表示の Task 行に「入力」ボタン (進捗入力モーダルの Trigger) が描画される
    await expect(page.getByRole('button', { name: '入力', exact: true }).first()).toBeVisible()
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

// TC-A3-003 (v3.x) はプロジェクトカードのピル表示を検証していたが、
// v4.0 ではプロジェクト一覧カードにステータス/進捗ピルを表示しない仕様 (spec v4.0)。
// → テスト撤去。G1 ガント表示画面でのステータスピル表示は v4-happy-path.spec.ts でカバー。
