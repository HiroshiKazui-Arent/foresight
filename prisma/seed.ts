import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
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
  })
  if (existing) {
    console.log('Seed: テストプロジェクトは既に存在します。スキップ。')
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
        actualPct: 100,
        completed: true,
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
        actualPct: 100,
        completed: true,
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
        actualPct: 60,
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
        actualPct: 80,
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
        actualPct: 30,
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
        actualPct: 0,
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
      actualPct: 100,
      completed: true,
      comment: '予定通り完了',
    },
  })
  await prisma.dailyReport.create({
    data: {
      todoId: t1_1_todos[1].id,
      reportedBy: admin.id,
      date: yesterday,
      actualPct: 100,
      completed: true,
    },
  })
  await prisma.dailyReport.create({
    data: {
      todoId: t1_1_todos[2].id,
      reportedBy: pm.id,
      date: today,
      actualPct: 60,
      completed: false,
      comment: '残り40%、明日完了予定',
    },
  })

  // ── Milestone 2 ──
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
        actualPct: 0,
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
        actualPct: 0,
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
        actualPct: 0,
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
        actualPct: 0,
        completed: false,
        startDate: addDays(ms2Start, 22),
        endDate: ms2End,
        order: 1,
      },
    }),
  ])

  console.log('Seed complete:', {
    admin: admin.email,
    pm: pm.email,
    project: project.name,
    milestones: 2,
    tasks: [task1_1.name, task1_2.name, task2_1.name, task2_2.name],
  })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
