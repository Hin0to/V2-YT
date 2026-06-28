// ============================================================
// Vercel Routing Middleware — site-wide auth via a signed cookie.
//
// Instead of a native Basic-Auth popup, unauthenticated visitors are
// redirected to a styled /login page. /api/login sets an HttpOnly,
// signed session cookie; this middleware verifies it on every request
// (pages AND /api functions) and redirects to /login if missing/invalid.
//
// The cookie is signed with HMAC-SHA256 keyed on DASHBOARD_PASS, so it
// can't be forged and it auto-invalidates if the password changes.
// No extra secret needed.
//
//   DASHBOARD_USER  /  DASHBOARD_PASS   (Vercel env vars)
//
// Fails CLOSED: if either is unset, every route returns 503.
// ============================================================
import { next } from '@vercel/functions';

// Reachable without a session (so the login page can load + authenticate).
const PUBLIC = new Set([
  '/login', '/login.html', '/api/login', '/api/logout',
  '/theme.css', '/anim.js', '/favicon.ico',
]);

export default async function middleware(request) {
  const user = process.env.DASHBOARD_USER;
  const pass = process.env.DASHBOARD_PASS;
  if (!user || !pass) {
    return new Response('Dashboard not configured: set DASHBOARD_USER and DASHBOARD_PASS.', { status: 503 });
  }

  const { pathname } = new URL(request.url);
  if (PUBLIC.has(pathname)) return next();

  const token = readCookie(request, 'dash_session');
  if (token && await verifyToken(token, pass)) return next();

  // Not authenticated.
  if (pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }
  const url = new URL('/login.html', request.url);
  if (pathname && pathname !== '/') url.searchParams.set('next', pathname);
  return Response.redirect(url, 302);
}

function readCookie(request, name) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}

async function verifyToken(token, secret) {
  const i = token.lastIndexOf('.');
  if (i < 0) return false;
  const exp = token.slice(0, i), sig = token.slice(i + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = await hmacHex(secret, exp);
  return safeEqual(expected, sig);
}

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let m = 0;
  for (let i = 0; i < a.length; i++) m |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return m === 0;
}
