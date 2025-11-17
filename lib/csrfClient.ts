// Client-side CSRF token management
let csrfToken: string | null = null;

// Fetch CSRF token from API
export async function fetchCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  
  try {
    const response = await fetch('/api/csrf-token');
    const data = await response.json();
    csrfToken = data.token;
    return data.token;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    throw error;
  }
}

// Get CSRF token from cookie
export function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : null;
}

// Add CSRF token to fetch options
export async function addCsrfHeaders(headers: HeadersInit = {}): Promise<HeadersInit> {
  const token = getCsrfTokenFromCookie() || await fetchCsrfToken();
  
  return {
    ...headers,
    'x-csrf-token': token,
  };
}

// Wrapper for fetch with CSRF token
export async function fetchWithCsrf(url: string, options: RequestInit = {}): Promise<Response> {
  const csrfHeaders = await addCsrfHeaders(options.headers);
  
  return fetch(url, {
    ...options,
    headers: csrfHeaders,
  });
}

// Clear cached token (call after logout)
export function clearCsrfToken(): void {
  csrfToken = null;
}
