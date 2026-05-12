// 注意: middleware.ts (Edge) ではなく Server Component / Server Action から呼ぶ
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'

export async function requireProjectMember(projectId: string): Promise<string> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) redirect('/login')
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  })
  if (!member) notFound()
  return userId
}
