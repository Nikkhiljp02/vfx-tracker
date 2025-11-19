import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  const session = await auth();

  // If user is authenticated and on login page, redirect to home
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If user is not authenticated and trying to access protected route
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Check if user has any active sessions in database (for force logout support)
  // Only check on page navigations, not on API calls or static resources
  const shouldCheckSession = !pathname.startsWith('/api') && 
                             !pathname.startsWith('/_next') &&
                             pathname !== '/';
  
  if (shouldCheckSession) {
    try {
      const user = session.user as any;
      const activeSessions = await prisma.session.count({
        where: {
          userId: user.id,
          isActive: true,
          expires: { gt: new Date() },
        },
      });

      if (activeSessions === 0) {
        // Clear the session and redirect to login
        const response = NextResponse.redirect(new URL("/login?session=expired", request.url));
        response.cookies.delete("authjs.session-token");
        response.cookies.delete("__Secure-authjs.session-token");
        return response;
      }
    } catch (error) {
      console.error("Session validation error:", error);
      // Don't block access if database check fails
    }
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
     * - /api/migrate (database migration endpoint)
     * - /api/db-test (database test endpoint)
     * - /api/check-env (environment check endpoint)
     * - /api/resource (resource forecast API - has own auth checks)
     * - /_next (Next.js internals)
     * - /favicon.ico, /robots.txt (static files)
     * - /manifest.json, /sw.js (PWA files)
     */
    "/((?!login|test-session|api/auth|api/setup|api/migrate|api/db-test|api/check-env|api/test-login|api/seed-permissions|api/resource|_next|favicon.ico|robots.txt|manifest.json|sw.js|workbox-.*.js|icon-.*\\.png|.well-known).*)",
  ],
};
