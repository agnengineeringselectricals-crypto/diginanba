import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { compare } from 'bcryptjs';
import { db } from './db';

const googleOAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Explicitly set the secret so Preview and Production do not depend on
  // provider-specific environment-variable inference.
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  // Enable Auth.js diagnostic logs only on non-production deployments.
  debug: process.env.VERCEL_ENV !== 'production',
  // Explicitly trust Vercel's forwarded host headers for Auth.js v5.
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase();
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;
        const result = await db.query(
          'SELECT id, email, display_name, status, password_hash FROM users WHERE email = $1 LIMIT 1',
          [email],
        );
        const user = result.rows[0];
        if (!user || user.status !== 'active' || !user.password_hash) return null;
        const ok = await compare(password, user.password_hash);
        if (!ok) return null;
        return { id: String(user.id), email: user.email, name: user.display_name ?? user.email };
      },
    }),
    // Keep email/password login available if Google credentials have not yet
    // been added to this deployment's environment.
    ...(googleOAuthConfigured
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) session.user.id = String(token.userId);
      return session;
    },
  },
});
