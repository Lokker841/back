import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/dashboard', '/objects', '/areas', '/monitoring'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // allow next internals and api routes
  if (pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('sportgid_token')?.value;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (pathname.startsWith('/login')) {
    if (token) {
      const url = req.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isProtected && !token) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*).*)'],
};

