import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { db } from './db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [Credentials({
    credentials: { email: {}, password: {} },
    async authorize(credentials) {
      const email = String(credentials?.email ?? '').trim().toLowerCase();
      const password = String(credentials?.password ?? '');
      if (!email || !password) return null;
      const result = await db.query('SELECT id, email, display_name, status, password_hash FROM users WHERE email = $1 LIMIT 1', [email]);
      const user = result.rows[0];
      if (!user || user.status !== 'active' || !user.password_hash) return null;
      const ok = await compare(password, user.password_hash);
      if (!ok) return null;
      return { id: user.id, email: user.email, name: user.display_name ?? user.email };
    },
  })],
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
