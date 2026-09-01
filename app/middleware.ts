import { NextResponse, type NextRequest } from 'next/server';

// Paths that require authentication
const PROTECTED_PATHS = ['/admin', '/agent', '/client'];

// Paths that should not be accessed by authenticated users (e.g., login)
const AUTH_PATHS = ['/login', '/register', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for session cookie
  const sessionCookie = request.cookies.get('shivaksa-session')?.value;

  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  const isAuthPage = AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(path));

  // If trying to access protected area without session, redirect to login
  if (isProtected && !sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    // Add redirect back to the original destination
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirect', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated and trying to access login/register, redirect to home
  // In Phase 3, this will redirect to role-appropriate dashboard
  if (isAuthPage && sessionCookie) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/agent/:path*',
    '/client/:path*',
    '/login',
    '/register',
    '/reset-password',
  ],
};
