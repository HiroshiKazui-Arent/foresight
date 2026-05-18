/**
 * TodoTemplate 管理画面 E2E
 *
 * /todo-templates での CRUD + 並び替えを検証する。
 * seed で投入される 5 件 (画面設計/DB設計/BE開発/FE開発/レビュー) を前提とする。
 */

import { test, expect } from '@playwright/test'
import { prisma } from './fixtures/prisma-fixture'

test.describe.configure({ mode: 'serial' })

// seed の 5 件に戻す (DB が汚染されていても確実にリセット)
async function resetTemplates() {
  const defaults = [
    { id: 'seed-tpl-1', name: '画面設計', order: 1 },
    { id: 'seed-tpl-2', name: 'DB設計', order: 2 },
    { id: 'seed-tpl-3', name: 'BE開発', order: 3 },
    { id: 'seed-tpl-4', name: 'FE開発', order: 4 },
    { id: 'seed-tpl-5', name: 'レビュー', order: 5 },
  ]
  for (const t of defaults) {
    await prisma.todoTemplate.upsert({
      where: { id: t.id },
      update: { name: t.name, order: t.order },
      create: { id: t.id, name: t.name, order: t.order },
    })
  }
  // seed 以外に追加された E2E テスト用レコードを削除
  await prisma.todoTemplate.deleteMany({ where: { id: { notIn: defaults.map((t) => t.id) } } })
}

test.describe('テンプレート管理 (TC-T1)', () => {
  test.beforeAll(async () => {
    await resetTemplates()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/todo-templates')
  })

  // TC-T1-001: 一覧に seed 5 件が表示される
  test('TC-T1-001: seed の 5 件が表示される', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'テンプレート管理' })).toBeVisible()
    await expect(page.getByText('画面設計')).toBeVisible()
    await expect(page.getByText('DB設計')).toBeVisible()
    await expect(page.getByText('BE開発')).toBeVisible()
    await expect(page.getByText('FE開発')).toBeVisible()
    await expect(page.getByText('レビュー')).toBeVisible()
  })

  // TC-T1-002: 追加 → 6 件目が末尾に出現
  test('TC-T1-002: テンプレートを追加すると末尾に表示される', async ({ page }) => {
    const newName = `打合せ_${Date.now()}`

    await page.getByRole('button', { name: '+ テンプレートを追加' }).click()
    await page.getByLabel('テンプレート名').fill(newName)
    await page.getByRole('button', { name: '追加' }).click()

    await expect(page.getByText(newName)).toBeVisible()

    // 末尾の行に表示されていることを確認
    const rows = page.locator('tbody tr')
    const lastRow = rows.last()
    await expect(lastRow).toContainText(newName)

    // 後始末: 追加した行を削除してテスト独立性を保つ
    page.on('dialog', (dialog) => dialog.accept())
    await lastRow.getByRole('button', { name: '削除' }).click()
    await expect(page.getByText(newName)).not.toBeVisible()
  })

  // TC-T1-003: インライン編集 → リロードで保持
  test('TC-T1-003: インライン編集で名前を変更するとリロード後も保持される', async ({ page }) => {
    const originalName = '画面設計'
    const updatedName = `画面設計_編集_${Date.now()}`

    // 対象行の名前セルをクリックして編集開始
    const firstRow = page.locator('tbody tr').first()
    await firstRow.getByText(originalName, { exact: true }).click()

    // インライン input が出現するまで待つ
    const editInput = firstRow.locator('input[type="text"], input:not([type])')
    await editInput.waitFor({ state: 'visible' })
    await editInput.fill(updatedName)
    await editInput.press('Enter')

    // 更新後の名前が表示される
    await expect(page.getByText(updatedName)).toBeVisible()

    // リロードしても保持される
    await page.reload()
    await expect(page.getByText(updatedName)).toBeVisible()

    // 後始末: 元の名前に戻す
    const firstRowAfter = page.locator('tbody tr').first()
    await firstRowAfter.getByText(updatedName, { exact: true }).click()
    const restoreInput = firstRowAfter.locator('input[type="text"], input:not([type])')
    await restoreInput.waitFor({ state: 'visible' })
    await restoreInput.fill(originalName)
    await restoreInput.press('Enter')
    // exact: true で完全一致。サブストリングマッチによる誤 PASS を防ぐ
    await expect(page.getByText(originalName, { exact: true })).toBeVisible()
    // server action + router.refresh() の完了を確実に待つ
    await expect(page.getByText(updatedName)).not.toBeVisible({ timeout: 10000 })
  })

  // TC-T1-004: ↓ ボタンで順位入替
  test('TC-T1-004: ↓ ボタンで 1 件目が 2 件目と入れ替わる', async ({ page }) => {
    const rows = page.locator('tbody tr')
    const firstRow = rows.first()

    // 1 件目の名前を取得
    const firstNameBefore = await firstRow.locator('td').nth(1).innerText()

    // ↓ ボタンをクリック
    await firstRow.getByTitle('下に移動').click()

    // リフレッシュ後に 2 件目に移動している
    await page.waitForURL('/todo-templates')
    const secondRowAfter = rows.nth(1)
    await expect(secondRowAfter).toContainText(firstNameBefore.trim())

    // 後始末: ↑ ボタンで元に戻す
    await secondRowAfter.getByTitle('上に移動').click()
    await page.waitForURL('/todo-templates')
    await expect(rows.first()).toContainText(firstNameBefore.trim())
  })

  // TC-T1-005: 削除 → 該当行が消える
  test('TC-T1-005: 削除すると該当行が一覧から消える', async ({ page }) => {
    const tempName = `削除テスト_${Date.now()}`

    // 一時的なテンプレートを追加
    await page.getByRole('button', { name: '+ テンプレートを追加' }).click()
    await page.getByLabel('テンプレート名').fill(tempName)
    await page.getByRole('button', { name: '追加' }).click()
    await expect(page.getByText(tempName)).toBeVisible()

    // 削除 (window.confirm を自動承認)
    page.on('dialog', (dialog) => dialog.accept())
    const row = page.locator('tbody tr').filter({ hasText: tempName })
    await row.getByRole('button', { name: '削除' }).click()

    await expect(page.getByText(tempName)).not.toBeVisible()
  })
})

// TC-T1-006 (回帰): 新規 Task 作成時に展開される ToDo 名がテンプレートと一致する
test.describe('TC-T1-006: Task 作成時の ToDo 展開回帰', () => {
  test('新規 Task 作成で DB に 5 件の ToDo が展開される', async ({ page }) => {
    // seed プロジェクトのマイルストーンを取得
    const milestone = await prisma.milestone.findFirst({
      where: { project: { name: { contains: 'フォーサイト' } } },
      include: { project: true },
    })
    expect(milestone, 'seed milestone が存在').toBeTruthy()
    if (!milestone) return

    const projectId = milestone.projectId

    // G2 工程管理画面でタスクの「同階層を追加」ボタンをクリック
    await page.goto(`/projects/${projectId}/manage`)

    // Task レベル行の「同階層を追加」ボタンをクリック (最初の Task 行)
    const taskRow = page.locator('[aria-label="レベル: task"]').first().locator('..')
    await taskRow.getByRole('button', { name: '同階層を追加' }).click()

    // 新規タスク行が出現するまで待つ (management-tree が refresh する)
    await page.waitForTimeout(2000)

    // 最新タスクの ToDo を DB で確認
    const task = await prisma.task.findFirst({
      where: { milestoneId: milestone.id },
      include: { todos: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
    expect(task, '作成したタスクが存在').toBeTruthy()
    expect(task?.todos.length).toBe(5)
    expect(task?.todos.map((t) => t.name)).toEqual([
      '画面設計',
      'DB設計',
      'BE開発',
      'FE開発',
      'レビュー',
    ])
  })
})
