import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  basePath: "/api/auth",
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          console.log("Authorize called with:", { username: credentials?.username });
          
          if (!credentials?.username || !credentials?.password) {
            console.log("Missing credentials");
            return null;
          }

          const username = credentials.username as string;
          const password = credentials.password as string;

          console.log("Looking for user:", username);
          
          // Find user in database
          const user = await prisma.user.findUnique({
            where: { username },
          });

          console.log("User found:", user ? "yes" : "no");

          if (!user) {
            console.log("User not found");
            return null;
          }

          if (!user.isActive) {
            console.log("User not active");
            return null;
          }

          // Verify password
          const passwordMatch = await bcrypt.compare(password, user.password);
          console.log("Password match:", passwordMatch);

          if (!passwordMatch) {
            console.log("Password mismatch");
            return null;
          }

          // Return user object
          const returnUser = {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email || `${user.username}@vfxtracker.com`,
            username: user.username,
            role: user.role,
            firstName: user.firstName,
            lastName: user.lastName,
          };
          
          console.log("Returning user:", returnUser);
          return returnUser;
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.role = (user as any).role;
        token.firstName = (user as any).firstName;
        token.lastName = (user as any).lastName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).username = token.username;
        (session.user as any).role = token.role;
        (session.user as any).firstName = token.firstName;
        (session.user as any).lastName = token.lastName;
      }
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
      if (user?.id) {
        try {
          const { trackLoginAttempt } = await import("@/lib/session-tracking");
          await trackLoginAttempt(user.id, (user as any).username, true);
        } catch (error) {
          console.error("Error tracking login:", error);
        }
      }
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      }
    },
  },
  trustHost: true,
  debug: process.env.NODE_ENV === 'development',
});
