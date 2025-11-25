import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Check for auth session cookie (lightweight check)
  const sessionCookie = request.cookies.get("authjs.session-token") || 
                       request.cookies.get("__Secure-authjs.session-token");

  // If user is authenticated and on login page, redirect to home
  if (sessionCookie && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // If user is not authenticated and trying to access protected route
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Note: Full session validation is handled by client-side polling (useSessionValidator hook)
  // Middleware only does basic cookie check to avoid large bundle size
  
  return NextResponse.next();
}

// Protect all routes except /login, /api/auth, and /api/setup
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /login (login page)
     * - /api/auth (NextAuth API routes)
     * - /api/google-sheets (Google Sheets API - has own auth)
     * - /api/setup (one-time setup endpoint)
     * - /api/migrate (database migration endpoint)
     * - /api/db-test (database test endpoint)
     * - /api/check-env (environment check endpoint)
     * - /api/resource (resource forecast API - has own auth checks)
     * - /_next (Next.js internals)
     * - /favicon.ico, /robots.txt (static files)
     * - /manifest.json, /sw.js (PWA files)
     */
    "/((?!login|test-session|api/auth|api/google-sheets|api/setup|api/migrate|api/db-test|api/check-env|api/test-login|api/seed-permissions|api/resource|_next|favicon.ico|robots.txt|manifest.json|sw.js|workbox-.*.js|icon-.*\\.png|.well-known).*)",
  ],
};
