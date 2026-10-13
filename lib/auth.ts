import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { compare } from 'bcryptjs';
import { db } from './db';

const googleOAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Explicitly set Auth.js v5 secret for consistent Vercel runtime configuration.
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  // Trust Vercel's forwarded host headers when deployed behind its proxy.
  trustHost: true,
  debug: process.env.VERCEL_ENV !== 'production',
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
