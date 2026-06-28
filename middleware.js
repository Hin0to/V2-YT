// ============================================================
// Vercel Routing Middleware — site-wide HTTP Basic Auth.
//
// Runs BEFORE every request (static .html pages AND /api functions),
// so the whole dashboard is private: a browser must send the right
// username + password or it gets a 401 login prompt and nothing else.
//
// No matcher is set on purpose -> every route is gated, including
// assets. Credentials live in Vercel env vars, never in code:
//   DASHBOARD_USER
//   DASHBOARD_PASS
//
// Set them in Vercel → Project → Settings → Environment Variables
// (or `vercel env add DASHBOARD_USER` / `... DASHBOARD_PASS`).
// ============================================================
import { next } from '@vercel/functions';

export default function middleware(request) {
  const expectedUser = process.env.DASHBOARD_USER;
  const expectedPass = process.env.DASHBOARD_PASS;

  // If the gate isn't configured, fail CLOSED (locked) rather than open.
  if (!expectedUser || !expectedPass) {
    return new Response('Dashboard not configured: set DASHBOARD_USER and DASHBOARD_PASS.', {
      status: 503,
    });
  }

  const auth = request.headers.get('authorization');
  if (auth) {
    const [scheme, encoded] = auth.split(' ');
    if (scheme && scheme.toLowerCase() === 'basic' && encoded) {
      let decoded = '';
      try { decoded = atob(encoded); } catch { decoded = ''; }
      const idx = decoded.indexOf(':');            // split on FIRST colon (passwords may contain ':')
      if (idx !== -1) {
        const user = decoded.slice(0, idx);
        const pass = decoded.slice(idx + 1);
        if (safeEqual(user, expectedUser) && safeEqual(pass, expectedPass)) {
          return next();                           // creds OK -> serve the page / API
        }
      }
    }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Private dashboard", charset="UTF-8"' },
  });
}

// Length-aware constant-time-ish compare (Edge runtime has no timingSafeEqual).
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
