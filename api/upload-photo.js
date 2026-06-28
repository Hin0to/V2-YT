// ============================================================
// POST /api/upload-photo   body: { dataUrl: "data:image/jpeg;base64,..." }
// Uploads the image to the PRIVATE Supabase Storage bucket
// 'progress-photos' using the server-only service_role key, and
// returns a same-origin viewer URL: { url: "/api/photo?path=<file>" }.
//
// The bucket is private — photos are only viewable through /api/photo,
// which sits behind the Basic-Auth middleware. Nothing is public.
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Bucket:   create a PRIVATE bucket named 'progress-photos' in Supabase.
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ error: 'server not configured' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const dataUrl = body && body.dataUrl;
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    return res.status(400).json({ error: 'dataUrl required' });
  }

  const comma = dataUrl.indexOf(',');
  if (comma === -1) return res.status(400).json({ error: 'malformed dataUrl' });
  const meta = dataUrl.slice(5, comma);
  const isB64 = /;base64/i.test(meta);
  const bytes = isB64
    ? Buffer.from(dataUrl.slice(comma + 1), 'base64')
    : Buffer.from(decodeURIComponent(dataUrl.slice(comma + 1)));
  // Always store as JPEG (the gym compresses to JPEG before upload). Don't
  // trust the client-supplied content-type — prevents storing an object
  // that would later be served as text/html or svg from /api/photo.
  const contentType = 'image/jpeg';

  const filename = 'photo_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10) + '.jpg';
  try {
    const up = await fetch(url + '/storage/v1/object/progress-photos/' + filename, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: 'Bearer ' + serviceKey,
        'Content-Type': contentType,
      },
      body: bytes,
    });
    if (!up.ok) return res.status(502).json({ error: 'upload failed: ' + (await up.text()) });
    return res.status(200).json({ url: '/api/photo?path=' + encodeURIComponent(filename) });
  } catch (e) {
    return res.status(502).json({ error: 'upload error: ' + (e && e.message ? e.message : String(e)) });
  }
}
