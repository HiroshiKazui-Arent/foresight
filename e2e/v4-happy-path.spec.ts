/**
 * v4.0 ハッピーパス E2E
 *
 * 認証 (storageState) → プロジェクト一覧 → G1 → G1 モーダル進捗入力 → 親再描画
 * の最低限の経路を一気通貫で確認する。
 *
 * v4.0 「進捗入力カラム + モーダル化」リファクタ後:
 *   - Task 行に「入力」ボタンが表示される (列「進捗入力」)
 *   - ボタンクリックで Dialog が開く (画面遷移しない)
 *   - Dialog 内で着手日 / 完了日を入力 → リアルタイム保存 (server action)
 *   - Dialog 閉じる → router.refresh() で親 G1 が再描画
 *
 * `/projects/{id}/tasks/{taskId}/progress` ページは仕様上残置されているため、
 * 直接 URL での DB 書込みパスもスモーク確認する (test 2)。
 *
 * seed の「フォーサイト開発プロジェクト(サンプル)」を前提とする。
 */

import { test, expect } from '@playwright/test'
import { prisma } from './fixtures/prisma-fixture'

// 同一 seed の '要件ドキュメント作成' Task の最初の ToDo を 2 つのテストが共有して書き込む。
// 並列実行で actualStartDate の DB 値が混線するのを避けるため serial にする。
test.describe.configure({ mode: 'serial' })

test.describe('v4.0 ハッピーパス', () => {
  test('A3 → G1 → モーダル進捗入力 → 親再描画 が一気通貫で動作する', async ({ page }) => {
    // seed の '要件ドキュメント作成' Task を狙う (Task 行 + 配下 ToDo が存在する前提)
    const task = await prisma.task.findFirst({
      where: { name: '要件ドキュメント作成' },
      include: {
        milestone: { select: { projectId: true } },
        todos: { take: 1 },
      },
    })
    expect(task, 'seed の task が DB に存在').toBeTruthy()
    if (!task || task.todos.length === 0) return
    const projectId = task.milestone.projectId
    const targetTodoId = task.todos[0].id

    // テスト独立性: 該当 ToDo の実績日を null に戻してから開始
    await prisma.todo.update({
      where: { id: targetTodoId },
      data: { actualStartDate: null, actualEndDate: null },
    })

    // ── A3: プロジェクト一覧
    await page.goto('/projects')
    await expect(page.getByRole('heading', { name: 'プロジェクト一覧' })).toBeVisible({
      timeout: 10000,
    })

    // ── G1: サンプルプロジェクトを開く
    await page
      .getByRole('button', { name: /フォーサイト開発プロジェクト/ })
      .first()
      .click()

    // ナビ + 共通ヘッダ
    await expect(page.getByRole('link', { name: 'ガント表示', exact: true })).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByRole('link', { name: '工程管理', exact: true })).toBeVisible()

    // サマリーカードに「全体進捗」「遅延状況」が表示される
    await expect(page.getByText('全体進捗')).toBeVisible()
    await expect(page.getByText('遅延状況')).toBeVisible()

    // フィルターピル (exact:true で「すべて展開」「すべて折りたたみ」と区別)
    await expect(page.getByRole('button', { name: 'すべて', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '完了', exact: true })).toBeVisible()

    // seed のマイルストーン名がガント表に出る (初期は全展開)
    await expect(page.getByText('要件定義フェーズ').first()).toBeVisible()
    await expect(page.getByText('ユーザーヒアリング').first()).toBeVisible()

    // G1 ヘッダに「進捗入力」カラムが存在 (v4 6 列化)
    await expect(page.getByText('進捗入力').first()).toBeVisible()

    // ── 該当 Task 行の「入力」ボタンをクリック → ダイアログが開く
    const taskRow = page.locator(`[data-row-id="${task.id}"]`)
    await expect(taskRow).toBeVisible()
    await taskRow.getByRole('button', { name: '入力', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // モーダル内に「進捗入力: <task.name>」見出しが描画される
    // (DialogTitle (sr-only) + TaskProgressContent の可視 h2 で同一テキストが 2 つ存在するため .last() で可視側を選択)
    await expect(
      dialog.getByRole('heading', { name: /進捗入力: 要件ドキュメント作成/ }).last(),
    ).toBeVisible()

    // ── ダイアログ内で対象 ToDo の着手日を入力
    const todoRow = dialog.locator(`[data-todo-id="${targetTodoId}"]`)
    await expect(todoRow).toBeVisible()
    const startInput = todoRow.locator('input[aria-label="着手日"]')
    await expect(startInput).toBeVisible()
    await startInput.fill('2026-05-01')
    await startInput.blur()

    // server action (updateTodoActualDates) 完了待ち
    await page.waitForTimeout(700)

    // DB に保存されたことを確認
    const updated = await prisma.todo.findUnique({ where: { id: targetTodoId } })
    expect(updated?.actualStartDate, '着手日が DB に保存される').not.toBeNull()

    // ── ダイアログを閉じる → router.refresh() で親再描画
    // Escape キーで close (Radix Dialog の標準閉鎖経路。Overlay scrollability の影響を受けない)
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()

    // 親 G1 の URL は変更されず、再描画後もサマリーが描画される
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`))
    await expect(page.getByText('全体進捗')).toBeVisible()
  })

  test('/progress ページ直接アクセスでも着手日が DB に保存される (retained route)', async ({
    page,
  }) => {
    // seed の task1_2 (要件ドキュメント作成) を使う — /progress ページが残置されている smoke 確認
    const task = await prisma.task.findFirst({
      where: { name: '要件ドキュメント作成' },
      include: { milestone: { select: { projectId: true } } },
    })
    expect(task, 'seed の task が DB に存在すること').toBeTruthy()
    if (!task) return

    const projectId = task.milestone.projectId
    const taskId = task.id

    await page.goto(`/projects/${projectId}/tasks/${taskId}/progress`)
    await expect(page.getByRole('heading', { name: /進捗入力/ })).toBeVisible({ timeout: 10000 })

    // 最初の ToDo に着手日を入力
    const firstStartInput = page.locator('input[aria-label="着手日"]').first()
    await firstStartInput.fill('2026-05-01')
    await firstStartInput.blur()
    // server action 完了待ち
    await page.waitForTimeout(700)

    // DB に反映を確認
    const firstTodoId = await page.locator('[data-todo-id]').first().getAttribute('data-todo-id')
    expect(firstTodoId).toBeTruthy()
    if (!firstTodoId) return

    const updated = await prisma.todo.findUnique({ where: { id: firstTodoId } })
    expect(updated?.actualStartDate, '着手日が DB に保存される').not.toBeNull()
  })
})
