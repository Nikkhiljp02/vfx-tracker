import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Please enter username and password");
        }

        const username = credentials.username as string;
        const password = credentials.password as string;

        // Find user in database
        const user = await prisma.user.findUnique({
          where: { username },
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
            showAccess: {
              include: {
                show: true,
              },
            },
          },
        });

        if (!user) {
          throw new Error("Invalid username or password");
        }

        if (!user.isActive) {
          throw new Error("Your account has been deactivated. Please contact your administrator.");
        }

        // Verify password
        const passwordMatch = await bcrypt.compare(
          password,
          user.password
        );

        if (!passwordMatch) {
          throw new Error("Invalid username or password");
        }

        // Return user object (password excluded)
        const userPermissions = (user as any).permissions || [];
        return {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email || "",
          username: user.username,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          permissions: userPermissions
            .filter((up: any) => up.granted)
            .map((up: any) => up.permission.name),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
        token.role = (user as any).role;
        token.firstName = (user as any).firstName;
        token.lastName = (user as any).lastName;
        token.permissions = (user as any).permissions;
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
        (session.user as any).permissions = token.permissions;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt" as const,
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
