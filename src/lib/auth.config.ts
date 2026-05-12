import type { NextAuthConfig } from 'next-auth'

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAuthPage = nextUrl.pathname.startsWith('/login')
      const isInvitePage = nextUrl.pathname.startsWith('/invite')
      const isApiAuth = nextUrl.pathname.startsWith('/api/auth')

      if (isApiAuth || isInvitePage) return true
      if (isLoggedIn && isAuthPage) return Response.redirect(new URL('/', nextUrl))
      if (!isLoggedIn && !isAuthPage) return false

      return true
    },
    async session({ session, user }) {
      if (user) {
        session.user.id = user.id
      }
      return session
    },
  },
  providers: [],
}
