import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireProjectMember } from '@/lib/authz'
import { ProjectSettingsClient } from './settings-client'

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireProjectMember(id)

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })
  if (!project) notFound()

  return (
    <ProjectSettingsClient
      project={{
        id: project.id,
        name: project.name,
        startDate: project.startDate.toISOString(),
        endDate: project.endDate.toISOString(),
        members: project.members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
        })),
      }}
    />
  )
}
