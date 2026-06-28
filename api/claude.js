// ============================================================
// POST /api/claude
// Body: a normal Anthropic Messages API payload
//       { model, max_tokens, system?, messages: [...] }
// Forwards it to https://api.anthropic.com/v1/messages using the
// ANTHROPIC_API_KEY stored ONLY on the server (Vercel env var).
// The key never reaches the browser. Returns Claude's JSON as-is.
//
// Env var required on Vercel:
//   ANTHROPIC_API_KEY   (your sk-ant-... key)
//
// This whole route sits behind the Basic-Auth middleware, so only
// the logged-in dashboard owner can call it.
// ============================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'method not allowed' } });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'server not configured (missing ANTHROPIC_API_KEY)' } });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body || typeof body !== 'object' || !Array.isArray(body.messages)) {
    return res.status(400).json({ error: { message: 'invalid request body (expected { model, max_tokens, messages })' } });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    res.status(r.status).setHeader('Content-Type', 'application/json');
    return res.send(text);
  } catch (e) {
    return res.status(502).json({ error: { message: 'proxy fetch failed: ' + (e && e.message ? e.message : String(e)) } });
  }
}
