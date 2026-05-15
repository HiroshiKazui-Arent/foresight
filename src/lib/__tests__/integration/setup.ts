import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, beforeEach } from 'vitest'

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL } },
})

export async function truncateAll() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "Todo","Task","Milestone","ProjectMember","Project",' +
      '"Invitation","Session","Account","User","TodoTemplate","VerificationToken" ' +
      'RESTART IDENTITY CASCADE',
  )
}

beforeAll(async () => {
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  await truncateAll()
})
