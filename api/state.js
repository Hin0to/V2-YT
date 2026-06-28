// ============================================================
// Cloud-sync proxy. The ONLY thing that talks to Supabase.
//
//   GET  /api/state?key=<rowKey>   -> { data: <object|null> }
//   POST /api/state  { key, data } -> upserts the row, { ok: true }
//
// Uses the Supabase service_role key, which lives ONLY on the server
// (Vercel env var) and bypasses Row Level Security. No Supabase key is
// ever sent to the browser. The app_state table has RLS enabled with
// NO policies (deny-all), so the only way in is through this route —
// which itself sits behind the Basic-Auth middleware.
//
// Env vars required on Vercel:
//   SUPABASE_URL                 (https://<project>.supabase.co)
//   SUPABASE_SERVICE_ROLE_KEY    (Settings → API → service_role secret)
// ============================================================
export default async function handler(req, res) {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return res.status(500).json({ error: 'server not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' });
  }

  const baseHeaders = {
    apikey: serviceKey,
    Authorization: 'Bearer ' + serviceKey,
    'Content-Type': 'application/json',
  };

  try {
    if (req.method === 'GET') {
      const key = req.query && req.query.key;
      if (!key) return res.status(400).json({ error: 'key required' });
      const r = await fetch(
        url + '/rest/v1/app_state?select=data&key=eq.' + encodeURIComponent(key),
        { headers: baseHeaders }
      );
      if (!r.ok) return res.status(502).json({ error: 'select failed: ' + (await r.text()) });
      const rows = await r.json();
      return res.status(200).json({ data: (Array.isArray(rows) && rows[0] && rows[0].data) || null });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
      const key = body && body.key;
      const data = body && body.data;
      if (!key || typeof data === 'undefined') {
        return res.status(400).json({ error: 'key and data required' });
      }
      const r = await fetch(url + '/rest/v1/app_state?on_conflict=key', {
        method: 'POST',
        headers: { ...baseHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ key, data, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) return res.status(502).json({ error: 'upsert failed: ' + (await r.text()) });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    return res.status(502).json({ error: 'state proxy failed: ' + (e && e.message ? e.message : String(e)) });
  }
}
