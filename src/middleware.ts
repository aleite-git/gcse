import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE_NAME = 'gcse_session';

// Routes that require authentication
const protectedRoutes = ['/quiz', '/progress'];

// Routes that require admin
const adminRoutes = ['/admin'];

// Public routes
const publicRoutes = ['/', '/api/login'];
const publicApiRoutes = [
  '/api/mobile/register',
  '/api/mobile/login',
  '/api/mobile/username/check',
  '/api/mobile/oauth/google',
  '/api/mobile/oauth/apple',
];

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }
  return new TextEncoder().encode(secret);
}

async function verifyToken(token: string): Promise<{ label: string; isAdmin: boolean } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return {
      label: payload.label as string,
      isAdmin: payload.isAdmin as boolean,
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and API routes (except those we want to protect)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg')
  ) {
    return NextResponse.next();
  }

  // Check if public route
  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith('/api/login')
  );
  const isPublicApiRoute = publicApiRoutes.some((route) => pathname.startsWith(route));

  if (isPublicRoute || isPublicApiRoute) {
    return NextResponse.next();
  }

  // API routes check
  const isApiRoute = pathname.startsWith('/api');

  // Get session token (cookie first, then Authorization header for API)
  let token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token && isApiRoute) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      token = authHeader.slice(7).trim();
    }
  }

  // Check if route requires authentication
  const requiresAuth = protectedRoutes.some((route) => pathname.startsWith(route));
  const requiresAdmin = adminRoutes.some((route) => pathname.startsWith(route));

  if (requiresAuth || requiresAdmin || isApiRoute) {
    if (!token) {
      if (isApiRoute) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/', request.url));
    }

    const session = await verifyToken(token);

    if (!session) {
      // Invalid token - clear cookie and redirect
      const response = isApiRoute
        ? NextResponse.json({ error: 'Invalid session' }, { status: 401 })
        : NextResponse.redirect(new URL('/', request.url));

      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    // Check admin requirement
    if (requiresAdmin && !session.isAdmin) {
      if (isApiRoute) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/quiz/today', request.url));
    }

    // Add session info to headers for downstream use
    const response = NextResponse.next();
    response.headers.set('x-user-label', session.label);
    response.headers.set('x-user-is-admin', session.isAdmin ? 'true' : 'false');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
