import { getAllUsers, getAllInvitations } from '@/server/actions/user'
import { UsersClient } from './users-client'

export default async function UsersPage() {
  const [users, invitations] = await Promise.all([getAllUsers(), getAllInvitations()])

  return (
    <UsersClient
      users={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        createdAt: u.createdAt.toISOString(),
      }))}
      invitations={invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        status: inv.status,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
        project: inv.project ? { id: inv.project.id, name: inv.project.name } : null,
        invitedBy: { name: inv.invitedBy.name },
      }))}
    />
  )
}
