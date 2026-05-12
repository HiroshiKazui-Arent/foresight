import { getInvitation } from '@/server/actions/invitation'
import { AcceptInviteForm } from './accept-invite-form'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params
  const invitation = await getInvitation(token)

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow">
          <h1 className="text-xl font-bold text-gray-900">招待が無効です</h1>
          <p className="mt-2 text-sm text-gray-600">
            この招待リンクは無効か、有効期限が切れています。
          </p>
        </div>
      </div>
    )
  }

  return (
    <AcceptInviteForm
      token={token}
      email={invitation.email}
      projectName={invitation.project?.name ?? null}
    />
  )
}
