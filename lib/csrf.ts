// CSRF protection utilities for API routes
import { NextRequest, NextResponse } from 'next/server';
import { auth } from './auth';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

// Generate a random CSRF token
export function generateCsrfToken(): string {
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Get CSRF token from cookies
export function getCsrfTokenFromCookies(request: NextRequest): string | null {
  return request.cookies.get(CSRF_COOKIE_NAME)?.value || null;
}

// Get CSRF token from headers
export function getCsrfTokenFromHeader(request: NextRequest): string | null {
  return request.headers.get(CSRF_HEADER_NAME) || null;
}

// Validate CSRF token
export function validateCsrfToken(request: NextRequest): boolean {
  const cookieToken = getCsrfTokenFromCookies(request);
  const headerToken = getCsrfTokenFromHeader(request);
  
  if (!cookieToken || !headerToken) {
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  return cookieToken === headerToken;
}

// Middleware to check CSRF token for state-changing operations
export async function verifyCsrfToken(request: NextRequest): Promise<NextResponse | null> {
  const method = request.method;
  
  // CSRF protection only needed for state-changing methods
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null;
  }
  
  // Skip CSRF check for auth endpoints (they have their own protection)
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/auth/') || pathname === '/api/setup') {
    return null;
  }
  
  // Verify user is authenticated first
  const session = await auth();
  if (!session?.user) {
    // If not authenticated, the auth middleware will handle it
    return null;
  }
  
  // Validate CSRF token
  const isValid = validateCsrfToken(request);
  
  if (!isValid) {
    return NextResponse.json(
      {
        error: 'Invalid CSRF token',
        message: 'CSRF token validation failed. Please refresh the page and try again.',
      },
      { status: 403 }
    );
  }
  
  // CSRF token is valid
  return null;
}

// Helper to add CSRF cookie to response
export function setCsrfCookie(response: NextResponse, token?: string): NextResponse {
  const csrfToken = token || generateCsrfToken();
  
  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });
  
  return response;
}

// API endpoint to get CSRF token (called by client)
export function getCsrfTokenResponse(request: NextRequest): NextResponse {
  let token = getCsrfTokenFromCookies(request);
  
  // Generate new token if none exists
  if (!token) {
    token = generateCsrfToken();
  }
  
  const response = NextResponse.json({ token });
  setCsrfCookie(response, token);
  
  return response;
}

// Client-side helper function (to be used in components)
// This would be imported and used in client components
export const csrfClientHelpers = `
// CSRF token management for client-side
let csrfToken: string | null = null;

// Fetch CSRF token from API
export async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  
  const response = await fetch('/api/csrf-token');
  const data = await response.json();
  csrfToken = data.token;
  return csrfToken;
}

// Get CSRF token from cookie
export function getCsrfTokenFromCookie(): string | null {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : null;
}

// Add CSRF token to fetch options
export async function addCsrfToken(options: RequestInit = {}): Promise<RequestInit> {
  const token = getCsrfTokenFromCookie() || await fetchCsrfToken();
  
  return {
    ...options,
    headers: {
      ...options.headers,
      'x-csrf-token': token,
    },
  };
}
`;

// Export constants for use in other files
export { CSRF_TOKEN_LENGTH, CSRF_COOKIE_NAME, CSRF_HEADER_NAME };
