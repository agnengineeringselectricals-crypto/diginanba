import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import Facebook from 'next-auth/providers/facebook';
import Apple from 'next-auth/providers/apple';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import Twitter from 'next-auth/providers/twitter';
import { compare } from 'bcryptjs';
import { db } from './db';

function hasPair(id: string | undefined, secret: string | undefined) {
  return Boolean(id && secret);
}

const socialProviders = [
  ...(hasPair(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET)
    ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! })]
    : []),
  ...(hasPair(process.env.FACEBOOK_CLIENT_ID, process.env.FACEBOOK_CLIENT_SECRET)
    ? [Facebook({ clientId: process.env.FACEBOOK_CLIENT_ID!, clientSecret: process.env.FACEBOOK_CLIENT_SECRET! })]
    : []),
  ...(hasPair(process.env.APPLE_CLIENT_ID, process.env.APPLE_CLIENT_SECRET)
    ? [Apple({ clientId: process.env.APPLE_CLIENT_ID!, clientSecret: process.env.APPLE_CLIENT_SECRET! })]
    : []),
  ...(hasPair(process.env.MICROSOFT_CLIENT_ID, process.env.MICROSOFT_CLIENT_SECRET)
    ? [MicrosoftEntraID({ clientId: process.env.MICROSOFT_CLIENT_ID!, clientSecret: process.env.MICROSOFT_CLIENT_SECRET! })]
    : []),
  ...(hasPair(process.env.TWITTER_CLIENT_ID, process.env.TWITTER_CLIENT_SECRET)
    ? [Twitter({ clientId: process.env.TWITTER_CLIENT_ID!, clientSecret: process.env.TWITTER_CLIENT_SECRET! })]
    : []),
];

export const { handlers, auth, signIn, signOut } = NextAuth({
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
          [email]
        );
        const user = result.rows[0];
        if (!user || user.status !== 'active' || !user.password_hash) return null;
        const ok = await compare(password, user.password_hash);
        if (!ok) return null;
        return { id: user.id, email: user.email, name: user.display_name ?? user.email };
      },
    }),
    ...socialProviders,
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account || account.type !== 'oauth') return true;
      const email = user.email?.trim().toLowerCase();
      if (!email) return '/login?error=SocialAccountNeedsEmail';

      const existing = await db.query(
        'SELECT id, status FROM users WHERE email = $1 LIMIT 1',
        [email]
      );

      if (existing.rows[0]) {
        if (existing.rows[0].status !== 'active') return '/login?error=AccountDisabled';
        return true;
      }

      const created = await db.query(
        'INSERT INTO users (email, display_name, status) VALUES ($1, $2, $3) RETURNING id',
        [email, user.name?.trim() || email, 'active']
      );
      user.id = created.rows[0].id;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        if (user.id) token.userId = user.id;
        if (!token.userId && user.email) {
          const result = await db.query(
            'SELECT id FROM users WHERE email = $1 LIMIT 1',
            [user.email.trim().toLowerCase()]
          );
          if (result.rows[0]) token.userId = result.rows[0].id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) session.user.id = String(token.userId);
      return session;
    },
  },
});
