const { NextResponse } = require('next/server');

const publicPaths = ['/login'];
const authPath = '/login';

function isPublic(pathname) {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(process.env.COOKIE_NAME || 'multi_llm_session');
  const hasSession = !!sessionCookie?.value;

  if (pathname === '/register') {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (isPublic(pathname)) {
    if (hasSession && pathname === '/login') {
      return NextResponse.redirect(new URL('/app', request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const login = new URL(authPath, request.url);
    login.searchParams.set('from', pathname);
    return NextResponse.redirect(login);
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
