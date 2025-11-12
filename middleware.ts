import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  console.log("Middleware checking:", request.nextUrl.pathname);
  
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  
  console.log("Token found:", !!token, "for path:", request.nextUrl.pathname);

  // If user is not authenticated and trying to access protected route
  if (!token) {
    console.log("No token, redirecting to login");
    return NextResponse.redirect(new URL("/login", request.url));
  }

  console.log("Token valid, allowing access");
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
     * - /api/migrate (database migration endpoint)
     * - /api/db-test (database test endpoint)
     * - /api/check-env (environment check endpoint)
     * - /_next (Next.js internals)
     * - /favicon.ico, /robots.txt (static files)
     */
    "/((?!login|test-session|api/auth|api/setup|api/migrate|api/db-test|api/check-env|api/test-login|_next|favicon.ico|robots.txt).*)",
  ],
};
