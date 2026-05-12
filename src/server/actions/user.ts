'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import type { User, Project } from '@prisma/client'

const userSelectFields = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  image: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function getAllUsers(): Promise<Omit<User, 'passwordHash'>[]> {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  return prisma.user.findMany({
    select: userSelectFields,
    orderBy: { createdAt: 'desc' },
  })
}

export type InvitationSummary = {
  id: string
  email: string
  status: string
  expiresAt: Date
  acceptedAt: Date | null
  createdAt: Date
  projectId: string | null
  invitedById: string
  project: Project | null
  invitedBy: Omit<User, 'passwordHash'>
}

export async function getAllInvitations(): Promise<InvitationSummary[]> {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  return prisma.invitation.findMany({
    select: {
      id: true,
      email: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      createdAt: true,
      projectId: true,
      invitedById: true,
      project: true,
      invitedBy: { select: userSelectFields },
    },
    orderBy: { createdAt: 'desc' },
  }) as Promise<InvitationSummary[]>
}
