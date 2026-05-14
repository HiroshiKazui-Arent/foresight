import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

async function seedDemoMilestone(projectId: string, today: Date) {
  const ms3Start = addDays(today, -20)
  const ms3End = addDays(today, 20)
  const nextOrder = await prisma.milestone.count({ where: { projectId } })
  const ms3 = await prisma.milestone.create({
    data: {
      projectId,
      name: '5状態デモ(M-03)',
      startDate: ms3Start,
      endDate: ms3End,
      order: nextOrder,
    },
  })

  const taskDemo = await prisma.task.create({
    data: {
      milestoneId: ms3.id,
      name: 'GanttBar 5状態確認',
      startDate: ms3Start,
      endDate: ms3End,
      order: 0,
    },
  })

  await Promise.all([
    prisma.todo.create({
      data: {
        taskId: taskDemo.id,
        name: '[State0] 予定 — 開始日が未来',
        weight: 20,
        started: false,
        completed: false,
        startDate: addDays(today, 5),
        endDate: addDays(today, 15),
        order: 0,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: taskDemo.id,
        name: '[State1] 完了 — 期日内完了',
        weight: 20,
        started: true,
        completed: true,
        startedAt: addDays(today, -18),
        completedAt: addDays(today, -8),
        startDate: addDays(today, -20),
        endDate: addDays(today, -5),
        order: 1,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: taskDemo.id,
        name: '[State2] 遅延(期日前) — 進捗遅れ',
        weight: 20,
        started: true,
        completed: false,
        startedAt: addDays(today, -10),
        startDate: addDays(today, -10),
        endDate: addDays(today, 10),
        order: 2,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: taskDemo.id,
        name: '[State3] 超過 — 期日を過ぎて未完',
        weight: 20,
        started: true,
        completed: false,
        startedAt: addDays(today, -15),
        startDate: addDays(today, -15),
        endDate: addDays(today, -3),
        order: 3,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: taskDemo.id,
        name: '[State4] 未着 — 開始日超過・未開始',
        weight: 20,
        started: false,
        completed: false,
        startDate: addDays(today, -8),
        endDate: addDays(today, 5),
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
  // TodoTemplate: Task 作成時に自動展開される 6 件(M-02)
  // ──────────────────────────────────────────────
  const todoTemplates = [
    { name: '画面設計', order: 1 },
    { name: 'データベース設計', order: 2 },
    { name: 'バックエンド開発', order: 3 },
    { name: 'フロントエンド開発', order: 4 },
    { name: 'テストコードの実装', order: 5 },
    { name: 'テスト・レビュー', order: 6 },
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
    // M-03: 5状態デモミルストーンが未存在なら追加
    const demoMsExists = existing.milestones.some((m) => m.name === '5状態デモ(M-03)')
    if (!demoMsExists) {
      await seedDemoMilestone(existing.id, today)
      console.log('Seed: 5状態デモ(M-03) を追加しました。')
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

  // ── Milestone 1 ──
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

  // task1_1 の ToDo x3 (weights: 33/33/34, 進捗あり)
  const t1_1_todos = await Promise.all([
    prisma.todo.create({
      data: {
        taskId: task1_1.id,
        name: '利用者インタビュー',
        weight: 33,
        started: true,
        completed: true,
        startedAt: ms1Start,
        completedAt: addDays(ms1Start, 5),
        startDate: ms1Start,
        endDate: addDays(ms1Start, 5),
        order: 0,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task1_1.id,
        name: 'ペルソナ定義',
        weight: 33,
        started: true,
        completed: true,
        startedAt: addDays(ms1Start, 5),
        completedAt: addDays(ms1Start, 10),
        startDate: addDays(ms1Start, 5),
        endDate: addDays(ms1Start, 10),
        order: 1,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task1_1.id,
        name: 'ユースケース整理',
        weight: 34,
        completed: false,
        startDate: addDays(ms1Start, 10),
        endDate: addDays(ms1Start, 15),
        order: 2,
      },
    }),
  ])

  // task1_2 の ToDo x3 (weights: 33/33/34, 一部進捗)
  await Promise.all([
    prisma.todo.create({
      data: {
        taskId: task1_2.id,
        name: '機能一覧作成',
        weight: 33,
        completed: false,
        startDate: addDays(ms1Start, 15),
        endDate: addDays(ms1Start, 20),
        order: 0,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task1_2.id,
        name: '画面設計書(ワイヤーフレーム)',
        weight: 33,
        completed: false,
        startDate: addDays(ms1Start, 20),
        endDate: addDays(ms1Start, 25),
        order: 1,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task1_2.id,
        name: 'レビュー・承認',
        weight: 34,
        completed: false,
        startDate: addDays(ms1Start, 25),
        endDate: ms1End,
        order: 2,
      },
    }),
  ])

  // DailyReport サンプル (task1_1 の最初の2件)
  const yesterday = addDays(today, -1)
  await prisma.dailyReport.create({
    data: {
      todoId: t1_1_todos[0].id,
      reportedBy: admin.id,
      date: yesterday,
      completed: true,
      comment: '予定通り完了',
    },
  })
  await prisma.dailyReport.create({
    data: {
      todoId: t1_1_todos[1].id,
      reportedBy: admin.id,
      date: yesterday,
      completed: true,
    },
  })
  await prisma.dailyReport.create({
    data: {
      todoId: t1_1_todos[2].id,
      reportedBy: pm.id,
      date: today,
      completed: false,
      comment: '残り40%、明日完了予定',
    },
  })

  // ── Milestone 2 ──  (M-03: 5状態デモ用)
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

  // task2_1, task2_2 各 ToDo x2 (weights: 50/50)
  await Promise.all([
    prisma.todo.create({
      data: {
        taskId: task2_1.id,
        name: 'API設計',
        weight: 50,
        completed: false,
        startDate: ms2Start,
        endDate: addDays(ms2Start, 7),
        order: 0,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task2_1.id,
        name: 'API実装',
        weight: 50,
        completed: false,
        startDate: addDays(ms2Start, 7),
        endDate: addDays(ms2Start, 15),
        order: 1,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task2_2.id,
        name: 'UI実装',
        weight: 50,
        completed: false,
        startDate: addDays(ms2Start, 15),
        endDate: addDays(ms2Start, 22),
        order: 0,
      },
    }),
    prisma.todo.create({
      data: {
        taskId: task2_2.id,
        name: '結合テスト',
        weight: 50,
        completed: false,
        startDate: addDays(ms2Start, 22),
        endDate: ms2End,
        order: 1,
      },
    }),
  ])

  // ── Milestone 3 ── (M-03: GanttBar 5状態デモ用)
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
