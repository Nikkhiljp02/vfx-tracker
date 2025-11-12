import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  // If user is not authenticated and trying to access protected route
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

// Protect all routes except /login, /api/auth, and /api/setup
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login (login page)
     * - /api/auth (NextAuth API routes)
     * - /api/setup (one-time setup endpoint)
     * - /_next (Next.js internals)
     * - /favicon.ico, /robots.txt (static files)
     */
    "/((?!login|api/auth|api/setup|_next|favicon.ico|robots.txt).*)",
  ],
};
