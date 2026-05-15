import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// v4.0: 4 ステータス + 未着手リスク の 5 種類デモを 1 タスク配下に配置
// spec.md v4.0 / plans/spec-v4-reset.md Section 3.3 参照
async function seedDemoMilestone(projectId: string, today: Date) {
  const ms3Start = addDays(today, -20)
  const ms3End = addDays(today, 20)
  const nextOrder = await prisma.milestone.count({ where: { projectId } })
  const ms3 = await prisma.milestone.create({
    data: {
      projectId,
      name: '4状態デモ + 未着手リスク',
      startDate: ms3Start,
      endDate: ms3End,
      order: nextOrder,
    },
  })

  const taskDemo = await prisma.task.create({
    data: {
      milestoneId: ms3.id,
      name: 'v4.0 状態確認',
      startDate: ms3Start,
      endDate: ms3End,
      order: 0,
    },
  })

  await Promise.all([
    // 1. completed: actualStart + actualEnd 両方あり (緑バー、100%)
    prisma.todo.create({
      data: {
        taskId: taskDemo.id,
        name: '[completed] 期日内完了',
        startDate: addDays(today, -20),
        endDate: addDays(today, -5),
        actualStartDate: addDays(today, -18),
        actualEndDate: addDays(today, -8),
        order: 0,
      },
    }),
    // 2. in-progress (順調): actualStart あり / actualEnd なし / actualPct >= scheduledPct
    //   進行中で 1/2 ToDo 完了相当の挙動を作るため、別 Task を Task1 に追加して
    //   集計上 actualPct >= scheduledPct になるよう調整するのは G1 完成時 (S8) で行う。
    //   ここでは単一 ToDo で「着手済み・未完」状態を作る。
    prisma.todo.create({
      data: {
        taskId: taskDemo.id,
        name: '[in-progress 順調] 着手済み・未完',
        startDate: addDays(today, -10),
        endDate: addDays(today, 10),
        actualStartDate: addDays(today, -10),
        actualEndDate: null,
        order: 1,
      },
    }),
    // 3. in-progress (遅延): actualStart あり / actualEnd なし / actualPct < scheduledPct
    //   このサンプルは Task 単位での actualPct と scheduledPct の比較で「遅延」に倒れる
    //   よう、開始日からかなり経過しても完了していない状態にする
    prisma.todo.create({
      data: {
        taskId: taskDemo.id,
        name: '[delayed 進行中] 遅延中',
        startDate: addDays(today, -15),
        endDate: addDays(today, -3),
        actualStartDate: addDays(today, -15),
        actualEndDate: null,
        order: 2,
      },
    }),
    // 4. not-started (開始日前): actualStart なし / startDate 未来
    prisma.todo.create({
      data: {
        taskId: taskDemo.id,
        name: '[not-started] 開始日が未来',
        startDate: addDays(today, 5),
        endDate: addDays(today, 15),
        actualStartDate: null,
        actualEndDate: null,
        order: 3,
      },
    }),
    // 5. not-started-risk (delayed の subset): actualStart なし / startDate 過去
    prisma.todo.create({
      data: {
        taskId: taskDemo.id,
        name: '[delayed 未着手リスク] 開始日超過・未着手',
        startDate: addDays(today, -8),
        endDate: addDays(today, 5),
        actualStartDate: null,
        actualEndDate: null,
        order: 4,
      },
    }),
  ])
}

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', name: '管理者', passwordHash },
  })

  const pm = await prisma.user.upsert({
    where: { email: 'pm@example.com' },
    update: {},
    create: { email: 'pm@example.com', name: 'PM', passwordHash },
  })

  // ──────────────────────────────────────────────
  // TodoTemplate: Task 作成時に自動展開される標準 5 件 (v4.0)
  // spec.md v4.0 / plans/spec-v4-reset.md 1.3 参照
  // ──────────────────────────────────────────────
  const todoTemplates = [
    { name: '画面設計', order: 1 },
    { name: 'データベース設計', order: 2 },
    { name: 'バックエンド開発', order: 3 },
    { name: 'フロントエンド開発', order: 4 },
    { name: 'テスト', order: 5 },
  ]
  for (const t of todoTemplates) {
    await prisma.todoTemplate.upsert({
      where: { id: `seed-tpl-${t.order}` },
      update: { name: t.name, order: t.order },
      create: { id: `seed-tpl-${t.order}`, name: t.name, order: t.order },
    })
  }

  // ──────────────────────────────────────────────
  // テスト用プロジェクト: 全60日(30日前〜30日後)
  // ──────────────────────────────────────────────
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const projectStart = addDays(today, -30)
  const projectEnd = addDays(today, 30)
  const ms1Start = projectStart
  const ms1End = addDays(projectStart, 30) // today
  const ms2Start = addDays(projectStart, 30)
  const ms2End = projectEnd

  const existing = await prisma.project.findFirst({
    where: { name: 'フォーサイト開発プロジェクト(サンプル)' },
    include: { milestones: true },
  })
  if (existing) {
    const demoMsExists = existing.milestones.some((m) => m.name === '4状態デモ + 未着手リスク')
    if (!demoMsExists) {
      await seedDemoMilestone(existing.id, today)
      console.log('Seed: 4状態デモ を追加しました。')
    } else {
      console.log('Seed: テストプロジェクトは既に存在します。スキップ。')
    }
    console.log('Seed complete:', { admin: admin.email, pm: pm.email })
    return
  }

  const project = await prisma.project.create({
    data: {
      name: 'フォーサイト開発プロジェクト(サンプル)',
      startDate: projectStart,
      endDate: projectEnd,
    },
  })
  await prisma.projectMember.create({ data: { projectId: project.id, userId: admin.id } })
  await prisma.projectMember.create({ data: { projectId: project.id, userId: pm.id } })

  // ── Milestone 1 ── 要件定義フェーズ (一部 ToDo は完了済み)
  const ms1 = await prisma.milestone.create({
    data: {
      projectId: project.id,
      name: '要件定義フェーズ',
      startDate: ms1Start,
      endDate: ms1End,
      order: 0,
    },
  })

  const task1_1 = await prisma.task.create({
    data: {
      milestoneId: ms1.id,
      name: 'ユーザーヒアリング',
      startDate: ms1Start,
      endDate: addDays(ms1Start, 15),
      order: 0,
    },
  })
  const task1_2 = await prisma.task.create({
    data: {
      milestoneId: ms1.id,
      name: '要件ドキュメント作成',
      startDate: addDays(ms1Start, 15),
      endDate: ms1End,
      order: 1,
    },
  })

  // task1_1 の ToDo x3 (1/2 完了 + 1 進行中)
  await Promise.all([
    prisma.todo.create({
      data: {
        taskId: task1_1.id,
        name: '利用者インタビュー',
        startDate: ms1Start,
        endDate: addDays(ms1Start, 5),
        actualStartDate: ms1Start,
        actualEndDate: addDays(ms1Start, 5),
        order: 0,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task1_1.id,
        name: 'ペルソナ定義',
        startDate: addDays(ms1Start, 5),
        endDate: addDays(ms1Start, 10),
        actualStartDate: addDays(ms1Start, 5),
        actualEndDate: addDays(ms1Start, 10),
        order: 1,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task1_1.id,
        name: 'ユースケース整理',
        startDate: addDays(ms1Start, 10),
        endDate: addDays(ms1Start, 15),
        actualStartDate: addDays(ms1Start, 10),
        actualEndDate: null,
        order: 2,
      },
    }),
  ])

  // task1_2 の ToDo x3 (すべて未着手)
  await Promise.all([
    prisma.todo.create({
      data: {
        taskId: task1_2.id,
        name: '機能一覧作成',
        startDate: addDays(ms1Start, 15),
        endDate: addDays(ms1Start, 20),
        order: 0,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task1_2.id,
        name: '画面設計書(ワイヤーフレーム)',
        startDate: addDays(ms1Start, 20),
        endDate: addDays(ms1Start, 25),
        order: 1,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task1_2.id,
        name: 'レビュー・承認',
        startDate: addDays(ms1Start, 25),
        endDate: ms1End,
        order: 2,
      },
    }),
  ])

  // ── Milestone 2 ── 開発フェーズ (すべて未着手、未来)
  const ms2 = await prisma.milestone.create({
    data: {
      projectId: project.id,
      name: '開発フェーズ',
      startDate: ms2Start,
      endDate: ms2End,
      order: 1,
    },
  })

  const task2_1 = await prisma.task.create({
    data: {
      milestoneId: ms2.id,
      name: 'バックエンド実装',
      startDate: ms2Start,
      endDate: addDays(ms2Start, 15),
      order: 0,
    },
  })
  const task2_2 = await prisma.task.create({
    data: {
      milestoneId: ms2.id,
      name: 'フロントエンド実装',
      startDate: addDays(ms2Start, 15),
      endDate: ms2End,
      order: 1,
    },
  })

  await Promise.all([
    prisma.todo.create({
      data: {
        taskId: task2_1.id,
        name: 'API設計',
        startDate: ms2Start,
        endDate: addDays(ms2Start, 7),
        order: 0,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task2_1.id,
        name: 'API実装',
        startDate: addDays(ms2Start, 7),
        endDate: addDays(ms2Start, 15),
        order: 1,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task2_2.id,
        name: 'UI実装',
        startDate: addDays(ms2Start, 15),
        endDate: addDays(ms2Start, 22),
        order: 0,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task2_2.id,
        name: '結合テスト',
        startDate: addDays(ms2Start, 22),
        endDate: ms2End,
        order: 1,
      },
    }),
  ])

  // ── Milestone 3 ── 4 状態デモ + 未着手リスク
  await seedDemoMilestone(project.id, today)

  console.log('Seed complete:', {
    admin: admin.email,
    pm: pm.email,
    project: project.name,
    milestones: 3,
    tasks: [task1_1.name, task1_2.name, task2_1.name, task2_2.name],
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
