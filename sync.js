// =============================================================
// Shared cloud-sync helper for the dashboard.
// Each page calls initCloudSync({...}) once with its config:
//   appKey         — string row key in the public.app_state table
//   syncedKeys     — exact localStorage keys to mirror
//   syncedPrefixes — localStorage key prefixes to mirror (e.g. 'goals:')
//   onApplied      — optional callback after remote state has been applied
//
// All cloud access goes through the first-party /api/state proxy, which
// holds the Supabase service_role key SERVER-SIDE. No Supabase key ships
// to the browser, and the whole site sits behind Basic Auth. There is no
// realtime websocket anymore; instead we pull on load and whenever the
// tab regains focus (good enough for a single-user dashboard).
//
// Just include it: <script src="sync.js" defer></script>
// =============================================================
(function () {
  'use strict';

  const STATE_URL = '/api/state';

  window.initCloudSync = function (config) {
    const appKey = config && config.appKey;
    const syncedKeys = (config && config.syncedKeys) || [];
    const syncedPrefixes = (config && config.syncedPrefixes) || [];
    const onApplied = config && config.onApplied;
    if (!appKey) return;

    let pushTimer = null;
    let suppressSync = false;
    let lastSyncedJson = null;

    function matches(k) {
      if (!k) return false;
      if (syncedKeys.indexOf(k) !== -1) return true;
      for (let i = 0; i < syncedPrefixes.length; i++) {
        if (k.indexOf(syncedPrefixes[i]) === 0) return true;
      }
      return false;
    }
    function listAllKeys() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (matches(k)) out.push(k);
      }
      return out;
    }
    function collect() {
      const out = {};
      for (const k of listAllKeys()) {
        const v = localStorage.getItem(k);
        if (v == null) continue;
        try { out[k] = JSON.parse(v); } catch (e) { out[k] = v; }
      }
      return out;
    }

    const origSet = localStorage.setItem.bind(localStorage);
    const origRemove = localStorage.removeItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      origSet(k, v);
      try { if (!suppressSync && matches(k)) schedulePush(); } catch (e) {}
    };
    localStorage.removeItem = function (k) {
      origRemove(k);
      try { if (!suppressSync && matches(k)) schedulePush(); } catch (e) {}
    };

    function applyRemote(remote) {
      if (!remote || typeof remote !== 'object') return false;
      suppressSync = true;
      let changed = false;
      try {
        for (const k of Object.keys(remote)) {
          if (!matches(k)) continue;
          const incoming = JSON.stringify(remote[k]);
          const local = localStorage.getItem(k);
          if (local !== incoming) {
            try { origSet(k, incoming); changed = true; } catch (e) {}
          }
        }
        for (const k of listAllKeys()) {
          if (!(k in remote)) {
            try { origRemove(k); changed = true; } catch (e) {}
          }
        }
      } finally { suppressSync = false; }
      if (changed && typeof onApplied === 'function') {
        try { onApplied(); } catch (e) {}
      }
      return changed;
    }

    async function pull() {
      try {
        const r = await fetch(STATE_URL + '?key=' + encodeURIComponent(appKey), {
          headers: { 'Accept': 'application/json' },
        });
        if (!r.ok) return;
        const j = await r.json();
        const remote = j && j.data;
        if (remote && typeof remote === 'object' && Object.keys(remote).length > 0) {
          const incoming = JSON.stringify(remote);
          if (incoming === lastSyncedJson) return;
          lastSyncedJson = incoming;
          applyRemote(remote);
        }
      } catch (e) {}
    }

    async function pushNow() {
      const state = collect();
      const json = JSON.stringify(state);
      if (json === lastSyncedJson) return;
      try {
        const r = await fetch(STATE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: appKey, data: state }),
        });
        if (r.ok) lastSyncedJson = json;
      } catch (e) {}
    }
    function schedulePush() {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(pushNow, 250);
    }
    function flushOnUnload() {
      const state = collect();
      const json = JSON.stringify(state);
      if (json === lastSyncedJson) return;
      try {
        fetch(STATE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: appKey, data: state }),
          keepalive: true,
        }).catch(() => {});
        lastSyncedJson = json;
      } catch (e) {}
    }

    (async function init() {
      await pull();
      if (lastSyncedJson === null && Object.keys(collect()).length > 0) {
        schedulePush();
      }
    })();

    window.addEventListener('beforeunload', flushOnUnload);
    window.addEventListener('pagehide', flushOnUnload);
    window.addEventListener('storage', (e) => {
      if (e.key && matches(e.key)) schedulePush();
    });
    // No realtime socket — pull the latest whenever we come back to the tab.
    window.addEventListener('focus', pull);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
  };
})();
