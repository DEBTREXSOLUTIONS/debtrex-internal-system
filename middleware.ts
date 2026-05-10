import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/setup'];
const JWT_SECRET_RAW = process.env.JWT_SECRET!;
const secret = new TextEncoder().encode(JWT_SECRET_RAW);

// Twilio webhook routes — accessed by Twilio's servers, not the browser.
// They MUST be public. In production, validate Twilio's signature header.
const TWILIO_WEBHOOK_PREFIXES = [
  '/api/twilio/twiml',
  '/api/twilio/status',
  '/api/twilio/recording',
];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Allow static files, public paths, OAuth callback, Twilio webhooks
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api/google/callback') ||
    TWILIO_WEBHOOK_PREFIXES.some(p => path.startsWith(p)) ||
    path === '/favicon.ico' ||
    PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'))
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('debtrex_session')?.value;
  if (!token) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
