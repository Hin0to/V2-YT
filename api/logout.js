// ============================================================
// GET/POST /api/logout — clears the session cookie, back to /login.
// ============================================================
export default function handler(req, res) {
  res.setHeader('Set-Cookie',
    'dash_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
  res.writeHead(302, { Location: '/login.html' });
  res.end();
}
