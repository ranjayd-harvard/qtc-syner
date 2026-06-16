import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { getDb } from './mongodb';

const ADMIN_EMAIL = 'ranjay.kumar@flashparking.com';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const db = await getDb();

      // Auto-provision the admin on first sign-in
      if (user.email === ADMIN_EMAIL) {
        await db.collection('users').updateOne(
          { email: ADMIN_EMAIL },
          { $setOnInsert: { email: ADMIN_EMAIL, name: user.name ?? 'Admin', role: 'admin', createdAt: new Date() } },
          { upsert: true }
        );
        return true;
      }

      // All other users must already exist in the users collection
      const existing = await db.collection('users').findOne({ email: user.email });
      return !!existing;
    },
    async jwt({ token, account }) {
      if (account?.provider === 'google' && token.email) {
        const db = await getDb();
        const dbUser = await db.collection('users').findOne({ email: token.email });
        if (dbUser) token.id = dbUser._id.toString();
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
