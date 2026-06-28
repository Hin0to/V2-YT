# Dashboard — Setup Guide (private, single-user)

A static dashboard (plain HTML/JS) that deploys on **Vercel**. It is locked behind a
**password** (HTTP Basic Auth) so only you can open it, and all secrets (Supabase,
Anthropic, WHOOP) live in **server-side environment variables** — none are ever sent to
the browser.

> Set the environment variables below in **Vercel → your project → Settings →
> Environment Variables**, then **redeploy**. Nothing is configured in the code.

---

## 1. Deploy + set your password

1. Push this repo to your GitHub (it's your fork).
2. **vercel.com → Add New → Project → Import** your fork.
3. Framework Preset: **Other**. Root Directory: **`./`**. Build/output: leave blank (static).
4. Add these two env vars (this is your login):

   | Variable | Value |
   |---|---|
   | `DASHBOARD_USER` | any username you want |
   | `DASHBOARD_PASS` | a strong password |

5. **Deploy.** Visit the URL — you'll land on a styled **login page**. Enter the user/pass
   above; you stay signed in for 7 days (an HttpOnly cookie), or hit **Log out** in Settings.

> If `DASHBOARD_USER`/`DASHBOARD_PASS` are not set, the site stays **locked** (returns a
> 503) on purpose — it never accidentally goes public.

The gate is `middleware.js` (runs before **every** page + API route); it redirects to
`/login.html`, which posts to `/api/login` and sets a cookie signed with your password —
no extra secret to configure.

---

## 2. Supabase (cross-device sync) — required for sync

Create a free project at **supabase.com**. Sync now goes through the server (`/api/state`)
using the **service_role** key, and the data table is fully locked to the public.

### SQL — run in **SQL Editor → New query → Run**
```sql
-- Sync table
create table if not exists public.app_state (
  key        text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Lock it down: RLS on, NO policies = nobody can touch it with a public key.
-- The server (service_role) bypasses RLS, so /api/state still works.
alter table public.app_state enable row level security;
```

### Progress-photo storage (only if you use gym photos)
Create a **PRIVATE** bucket named `progress-photos`:
- Supabase → **Storage → New bucket** → name `progress-photos` → **leave "Public" OFF**.

Photos upload through `/api/upload-photo` and are viewed through `/api/photo` (both behind
your password). They are never public. No storage policy is needed — the server uses the
service_role key.

### Env vars (Vercel)
Supabase → **Project Settings → API**:

| Variable | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | your Project URL | |
| `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** secret | server-only — **never** put this in client code |

> The old public **anon key is no longer used anywhere** and should not be added.

---

## 3. Nova / AI Polish (Anthropic) — optional

Get a key at **console.anthropic.com**. It stays on the server.

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your `sk-ant-...` key |

The browser calls `/api/claude`; the key never reaches the page. If it's not set, AI
features just fail softly.

---

## 4. WHOOP (optional)

1. **developer.whoop.com** → create an app.
2. Set its **Redirect URI** to exactly `https://your-app.vercel.app/api/whoop-callback`
   (your real Vercel domain).
3. Put your app's **Client ID** in [`health.html`](health.html) (`const CLIENT_ID = '...'`)
   and add the two env vars:

   | Variable | Value |
   |---|---|
   | `WHOOP_CLIENT_ID` | your WHOOP app's Client ID |
   | `WHOOP_CLIENT_SECRET` | your WHOOP app's Client Secret (**secret**) |

4. Open the site → Health page → **Connect WHOOP**.

> The callback auto-detects the domain, so no `WHOOP_REDIRECT_URI` env var is needed.

---

## All environment variables at a glance

| Variable | Required | Purpose |
|---|---|---|
| `DASHBOARD_USER` | ✅ | login username |
| `DASHBOARD_PASS` | ✅ | login password |
| `SUPABASE_URL` | for sync | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | for sync | server-only DB + storage access |
| `ANTHROPIC_API_KEY` | optional | Nova / AI polish |
| `WHOOP_CLIENT_ID` | optional | WHOOP OAuth |
| `WHOOP_CLIENT_SECRET` | optional | WHOOP OAuth |

After adding or changing any of these, **redeploy** for them to take effect.
