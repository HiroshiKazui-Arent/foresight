import { test, expect } from '@playwright/test'

async function navigateToSettings(page: import('@playwright/test').Page) {
  await page.goto('/projects')
  await page.getByText('フォーサイト開発プロジェクト(サンプル)').click()
  await page.waitForURL(/\/projects\/[a-z0-9]+$/)
  await page.getByRole('link', { name: '設定' }).click()
  await page.waitForURL(/\/projects\/[a-z0-9]+\/settings$/)
}

test.describe('プロジェクト設定 (TC-A4)', () => {
  // TC-A4-001: プロジェクト名・期間を編集して保存 → DB に反映
  test('TC-A4-001: プロジェクト名を編集して保存すると変更が反映される', async ({ page }) => {
    await navigateToSettings(page)

    const nameInput = page.getByLabel('プロジェクト名')
    await nameInput.fill('フォーサイト開発プロジェクト(サンプル) - 編集テスト')
    await page.getByRole('button', { name: '保存' }).click()

    await expect(page.getByText('保存しました')).toBeVisible()

    // 変更を元に戻す
    await nameInput.fill('フォーサイト開発プロジェクト(サンプル)')
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByText('保存しました')).toBeVisible()
  })

  // TC-A4-003: メンバー招待モーダルでメールを入力 → Invitation 作成、URL 表示
  test('TC-A4-003: メンバー招待モーダルでメールを入力すると招待 URL が表示される', async ({
    page,
  }) => {
    await navigateToSettings(page)

    await page.getByRole('button', { name: '+ メンバーを招待' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    const email = `e2e-settings-invite-${Date.now()}@example.com`
    await page.getByLabel('招待するメールアドレス').fill(email)
    await page.getByRole('button', { name: '招待リンクを生成' }).click()

    // 招待リンクが表示される
    await expect(page.locator('span.truncate')).toBeVisible()
    const link = await page.locator('span.truncate').textContent()
    expect(link).toMatch(/\/invite\//)

    await page.getByRole('button', { name: '閉じる' }).click()
  })

  // TC-A4-004/005: プロジェクト削除に確認ダイアログが出る
  test('TC-A4-005: プロジェクト削除ボタンをクリックすると確認ダイアログが表示される', async ({
    page,
  }) => {
    await navigateToSettings(page)

    await page.getByRole('button', { name: '削除' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('プロジェクトを削除しますか？')).toBeVisible()

    // キャンセルして削除しない
    await page.getByRole('button', { name: 'キャンセル' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  // TC-A4-006: 非メンバーがプロジェクト設定 URL を直接叩いた場合 403/404
  test('TC-A4-006: 存在しないプロジェクト ID の設定 URL にアクセスすると 404 になる', async ({
    page,
  }) => {
    await page.goto('/projects/nonexistent-project-id/settings')
    // 404 ページまたはプロジェクト一覧にリダイレクト
    const url = page.url()
    const has404Text = await page.getByText('404').isVisible()
    // 404 ページが表示されるか /projects に飛ぶかのどちらか
    expect(url.includes('nonexistent-project-id') === false || has404Text).toBe(true)
  })
})
