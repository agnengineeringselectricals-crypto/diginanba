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
      const providerAccountId = account.providerAccountId;
      if (!email || !providerAccountId) return '/login?error=SocialAccountNeedsEmail';

      const linked = await db.query(
        'SELECT u.id, u.email, u.display_name, u.status FROM user_auth_accounts a JOIN users u ON u.id = a.user_id WHERE a.provider = $1 AND a.provider_account_id = $2 LIMIT 1',
        [account.provider, providerAccountId]
      );

      if (linked.rows[0]) {
        if (linked.rows[0].status !== 'active') return '/login?error=AccountDisabled';
        user.id = linked.rows[0].id;
        user.email = linked.rows[0].email;
        user.name = linked.rows[0].display_name ?? user.name ?? user.email;
        return true;
      }

      const existing = await db.query(
        'SELECT id, status FROM users WHERE email = $1 LIMIT 1',
        [email]
      );

      if (existing.rows[0]) {
        return '/login?error=AccountAlreadyExists';
      }

      const created = await db.query(
        'INSERT INTO users (email, display_name, status) VALUES ($1, $2, $3) RETURNING id',
        [email, user.name?.trim() || email, 'active']
      );

      await db.query(
        'INSERT INTO user_auth_accounts (user_id, provider, provider_account_id) VALUES ($1, $2, $3)',
        [created.rows[0].id, account.provider, providerAccountId]
      );

      user.id = created.rows[0].id;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      if (!token.userId && user?.email) {
        const result = await db.query(
          'SELECT id FROM users WHERE email = $1 LIMIT 1',
          [user.email.trim().toLowerCase()]
        );
        if (result.rows[0]) token.userId = result.rows[0].id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) session.user.id = String(token.userId);
      return session;
    },
  },
});
