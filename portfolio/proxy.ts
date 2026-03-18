import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Add security headers that supplement next.config.ts headers
  response.headers.set('X-Request-Id', crypto.randomUUID());

  // Verify traffic origin (optional: block direct access bypassing NPM)
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const forwardedHost = request.headers.get('x-forwarded-host');

  // In production, you can enforce that requests come through the reverse proxy
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.ENFORCE_PROXY === 'true' &&
    !forwardedHost
  ) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // Log requests in development for debugging reverse proxy
  if (process.env.NODE_ENV === 'development') {
    console.info(
      `[Middleware] ${request.method} ${forwardedProto || 'http'}://${forwardedHost || 'localhost'}${request.nextUrl.pathname}`
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public folder assets
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|images/|documents/).*)',
  ],
};
