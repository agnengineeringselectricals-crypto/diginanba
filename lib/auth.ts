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
      async authorize(credentials, request) {
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

        // Record successful sign-ins from each device/network. Edge headers provide best-effort IP geolocation.
        try {
          const headers = request.headers;
          const forwarded = headers.get('x-forwarded-for');
          const ip = headers.get('x-real-ip') || (forwarded ? forwarded.split(',').at(-1)?.trim() : null);
          const country = headers.get('x-vercel-ip-country')?.toUpperCase().slice(0, 2) || null;
          const region = headers.get('x-vercel-ip-country-region') || null;
          const cityHeader = headers.get('x-vercel-ip-city');
          let city: string | null = null;
          if (cityHeader) {
            try { city = decodeURIComponent(cityHeader).slice(0, 200); } catch { city = cityHeader.slice(0, 200); }
          }
          const userAgent = headers.get('user-agent')?.slice(0, 1000) || null;
          await db.query(
            "INSERT INTO user_login_events (user_id, ip_address, country_code, region, city, user_agent, login_method) VALUES ($1, NULLIF($2, '')::inet, $3, $4, $5, $6, 'credentials')",
            [user.id, ip || '', country, region, city, userAgent],
          );
        } catch (error) {
          // Don't block valid logins while the audit schema is being rolled out to previews.
          console.error('Unable to record successful sign-in audit event', error);
        }
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
