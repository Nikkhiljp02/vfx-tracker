import { NextRequest, NextResponse } from 'next/server';
import { getCsrfTokenResponse } from '@/lib/csrf';

// GET /api/csrf-token - Get CSRF token for client-side requests
export async function GET(request: NextRequest) {
  return getCsrfTokenResponse(request);
}
