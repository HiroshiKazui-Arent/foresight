import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const root = resolve(__dirname, '../../..')

// TC-AUTH-004: middleware.ts が Prisma/bcrypt を import しない
describe('TC-AUTH-004: middleware.ts が Prisma/bcrypt を import しない', () => {
  const src = readFileSync(resolve(root, 'src/middleware.ts'), 'utf-8')

  it('middleware.ts に @/lib/prisma の import が存在しない', () => {
    expect(src).not.toMatch(/from ['"]@\/lib\/prisma['"]/)
    expect(src).not.toMatch(/from ['"]@prisma\/client['"]/)
  })

  it('middleware.ts に bcrypt の import が存在しない', () => {
    expect(src).not.toMatch(/bcrypt/)
  })
})

// TC-AUTHZ-004: 全 Server Action ファイルが auth() または requireProjectMember を呼び出す
describe('TC-AUTHZ-004: Server Action ファイルに認証チェックが存在する', () => {
  const actionFiles = [
    'project.ts',
    'invitation.ts',
    'milestone.ts',
    'task.ts',
    'todo.ts',
    'user.ts',
  ]

  for (const file of actionFiles) {
    it(`${file} に auth() または requireProjectMember の呼び出しが存在する`, () => {
      const src = readFileSync(resolve(root, `src/server/actions/${file}`), 'utf-8')
      const hasAuthCheck = src.includes('auth(') || src.includes('requireProjectMember')
      expect(hasAuthCheck).toBe(true)
    })
  }
})

// TC-ENV-001: .env.example に必須キーが定義されている
describe('TC-ENV-001: .env.example に必須キーが存在する', () => {
  const env = readFileSync(resolve(root, '.env.example'), 'utf-8')

  it('AUTH_SECRET が定義されている', () => {
    expect(env).toMatch(/^AUTH_SECRET=/m)
  })

  it('DATABASE_URL が定義されている', () => {
    expect(env).toMatch(/^DATABASE_URL=/m)
  })

  it('AUTH_TRUST_HOST が定義されている', () => {
    expect(env).toMatch(/^AUTH_TRUST_HOST=/m)
  })
})

// TC-INV-006: 招待トークンのエントロピー確認 (randomBytes 引数 >= 32)
describe('TC-INV-006: 招待トークンのエントロピーが十分である', () => {
  it('invitation.ts の randomBytes 引数が 32 以上', () => {
    const src = readFileSync(resolve(root, 'src/server/actions/invitation.ts'), 'utf-8')
    const match = src.match(/randomBytes\((\d+)\)/)
    expect(match).not.toBeNull()
    expect(parseInt(match![1])).toBeGreaterThanOrEqual(32)
  })
})
