// ============================================================
// GET /api/photo?path=<filename>
// Streams a progress photo from the PRIVATE 'progress-photos' bucket
// using the server-only service_role key. This route is behind the
// Basic-Auth middleware, so photos are only viewable when logged in.
//
// `path` is restricted to plain filenames (no slashes / '..') so it
// can't be used to reach other objects.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).end();

  const path = req.query && req.query.path;
  if (!path || typeof path !== 'string' || !/^[A-Za-z0-9._-]+$/.test(path)) {
    return res.status(400).end();
  }

  try {
    const r = await fetch(url + '/storage/v1/object/progress-photos/' + path, {
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey },
    });
    if (!r.ok) return res.status(r.status).end();
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(502).end();
  }
}
