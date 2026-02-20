// ── api.js — Invidious search via corsproxy.io ──
// No API key needed. All requests proxied to bypass CORS.

const API = (() => {

  const CORS_PROXY = 'https://corsproxy.io/?url=';

  const INSTANCES = [
    'https://inv.nadeko.net',
    'https://invidious.fdn.fr',
    'https://invidious.privacydev.net',
    'https://invidious.nerdvpn.de',
    'https://iv.melmac.space',
    'https://yt.artemislena.eu',
  ];

  const FIELDS   = 'videoId,title,author,videoThumbnails,lengthSeconds';
  const TIMEOUT  = 6000;

  let activeInstance = null;

  // ── proxy-wrapped fetch ─────────────────────────────────────────────
  async function pfetch(url, timeout = TIMEOUT) {
    const proxied = CORS_PROXY + encodeURIComponent(url);
    const res = await fetch(proxied, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  }

  // ── pick a working instance ─────────────────────────────────────────
  async function pickInstance(onStatus) {
    onStatus?.('connecting');
    for (const inst of INSTANCES) {
      try {
        const r = await pfetch(`${inst}/api/v1/search?q=music&type=video&fields=videoId`);
        if (r.ok) {
          activeInstance = inst;
          onStatus?.('ok', inst.replace('https://', ''));
          return true;
        }
      } catch { /* try next */ }
    }
    onStatus?.('error');
    return false;
  }

  // ── search ──────────────────────────────────────────────────────────
  async function search(query, onStatus) {
    if (!activeInstance) {
      const ok = await pickInstance(onStatus);
      if (!ok) throw new Error('No server available. Try refreshing.');
    }

    const url = `${activeInstance}/api/v1/search?` + new URLSearchParams({
      q:      query,
      type:   'video',
      fields: FIELDS,
    });

    let res;
    try {
      res = await pfetch(url, 10000);
    } catch {
      // instance dropped — reset and retry once
      activeInstance = null;
      const ok = await pickInstance(onStatus);
      if (!ok) throw new Error('Search failed. Try again.');
      res = await pfetch(`${activeInstance}/api/v1/search?` + new URLSearchParams({ q: query, type: 'video', fields: FIELDS }), 10000);
    }

    const items = await res.json();
    return items.map(mapItem).filter(Boolean);
  }

  // ── map raw API item to clean track object ───────────────────────────
  function mapItem(v) {
    if (!v?.videoId) return null;
    return {
      id:    v.videoId,
      title: v.title    || 'Unknown Title',
      ch:    v.author   || 'Unknown Artist',
      thumb: bestThumb(v.videoThumbnails),
      dur:   v.lengthSeconds ?? 0,
    };
  }

  function bestThumb(arr) {
    if (!arr?.length) return '';
    for (const q of ['medium', 'high', 'default']) {
      const t = arr.find(x => x.quality === q);
      if (t?.url) return t.url;
    }
    return arr[0]?.url || '';
  }

  return { search, pickInstance };

})();

window.API = API;
