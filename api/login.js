// ============================================================
// POST /api/login   body: { username, password }
// Verifies against DASHBOARD_USER / DASHBOARD_PASS and, on success,
// sets a signed HttpOnly session cookie that middleware.js trusts.
// ============================================================
import crypto from 'node:crypto';

const MAX_AGE = 7 * 24 * 60 * 60; // 7 days, in seconds

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const USER = process.env.DASHBOARD_USER;
  const PASS = process.env.DASHBOARD_PASS;
  if (!USER || !PASS) return res.status(503).json({ error: 'server not configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const username = (body && body.username) || '';
  const password = (body && body.password) || '';

  if (!safeEqual(username, USER) || !safeEqual(password, PASS)) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }

  const exp = Date.now() + MAX_AGE * 1000;
  const sig = crypto.createHmac('sha256', PASS).update(String(exp)).digest('hex');
  const token = exp + '.' + sig;
  res.setHeader('Set-Cookie',
    `dash_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}`);
  return res.status(200).json({ ok: true });
}

function safeEqual(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let m = 0;
  for (let i = 0; i < a.length; i++) m |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return m === 0;
}
