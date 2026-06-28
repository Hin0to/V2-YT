// ============================================================
// GET /api/whoop-authorize
// Starts the WHOOP OAuth flow from the SERVER so the client_id comes
// from env (single source of truth, matches the secret's app) and the
// redirect_uri is derived from the live host (always matches the
// token-exchange redirect_uri in /api/whoop-callback). Sets a short
// CSRF `state` cookie, then 302s the browser to WHOOP.
//
// Env: WHOOP_CLIENT_ID
// ============================================================
import crypto from 'node:crypto';

const SCOPES = 'read:recovery read:sleep read:workout read:cycles read:profile read:body_measurement offline';

export default function handler(req, res) {
  const clientId = process.env.WHOOP_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send('WHOOP not configured (missing WHOOP_CLIENT_ID).');
  }

  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = proto + '://' + host + '/api/whoop-callback';

  const state = crypto.randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie',
    `whoop_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);

  const url = 'https://api.prod.whoop.com/oauth/oauth2/auth'
    + '?client_id='    + encodeURIComponent(clientId)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&response_type=code'
    + '&scope='        + encodeURIComponent(SCOPES)
    + '&state='        + state;

  res.writeHead(302, { Location: url });
  res.end();
}
