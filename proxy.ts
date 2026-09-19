import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function getEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY', legacyName: 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY') {
  const value = process.env[name] || process.env[legacyName];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const allCookies = request.cookies.getAll();
  const hasAuthCookie = allCookies.some((c) => c.name.startsWith('sb-') || c.name.includes('auth-token') || c.name.includes('access_token'));
  const hasAuthHeader = Boolean(request.headers.get('authorization') || request.headers.get('Authorization'));

  // Fast-path: If request has no auth credentials, skip outbound Supabase auth call
  if (!hasAuthCookie && !hasAuthHeader) {
    return response;
  }

  const supabase = createServerClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'),
    getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY'),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    '/api/auth/:path*',
    '/api/profile/:path*',
    '/api/users/:path*',
    '/api/roles/:path*',
    '/api/notifications/:path*',
    '/api/applications/:path*',
    '/api/upload/:path*',
    '/api/save-all/:path*',
    '/api/pin/:path*'
  ]
};

