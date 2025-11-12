import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export default {
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        return null; // This is handled in lib/auth.ts
      },
    }),
  ],
  trustHost: true,
} satisfies NextAuthConfig;
