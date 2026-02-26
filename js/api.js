const API = (() => {
  // Only the 3 officially maintained public Invidious instances (docs.invidious.io/instances)
  // Plus nadeko's numbered backends for redundancy — all confirmed alive Feb 2026
  const ALL_INSTANCES = [
    'https://inv.nadeko.net',
    'https://yewtu.be',
    'https://invidious.nerdvpn.de',
    'https://inv1.nadeko.net',
    'https://inv2.nadeko.net',
  ];

  // Only allorigins — the only proxy that actually works reliably.
  // REMOVED: corsproxy.io (530/523/502), thingproxy (dead DNS), codetabs (400 errors)
  const PROXIES = [
    (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  let activeInstance = null;
  let activeProxy    = null;  // null = direct (no proxy needed)
  let pickingPromise = null;

  function setPill(text, state) {
    const pill = document.getElementById('pill');
    const txt  = document.getElementById('pill-text');
    if (txt)  txt.textContent = text;
    if (pill) pill.className  = `server-pill${state ? ' ' + state : ''}`;
  }

  // Try direct fetch first — some Invidious instances allow CORS natively
  async function probeDirect(inst) {
    const r = await fetch(`${inst}/api/v1/stats`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function probeViaProxy(inst, proxyIdx) {
    const url = PROXIES[proxyIdx](`${inst}/api/v1/stats`);
    const r   = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return data.contents ? JSON.parse(data.contents) : data;
  }

  function pickInstance() {
    if (activeInstance) return Promise.resolve(true);
    if (pickingPromise)  return pickingPromise;

    setPill('connecting…', '');

    const attempts = [];
    for (const inst of ALL_INSTANCES) {
      // Try direct first (fastest if CORS is supported)
      attempts.push(probeDirect(inst).then(() => ({ inst, proxyIdx: null })));
      // Try each proxy in parallel
      for (let pi = 0; pi < PROXIES.length; pi++) {
        attempts.push(probeViaProxy(inst, pi).then(() => ({ inst, proxyIdx: pi })));
      }
    }

    pickingPromise = Promise.any(attempts)
      .then(({ inst, proxyIdx }) => {
        activeInstance = inst;
        activeProxy    = proxyIdx;
        const label    = proxyIdx === null
          ? 'direct'
          : ['allorigins', 'codetabs', 'allorigins/raw'][proxyIdx];
        setPill(`● ${inst.replace('https://', '')} (${label})`, 'ok');
        return true;
      })
      .catch(() => {
        setPill('✕ no server reachable', 'err');
        return false;
      })
      .finally(() => { pickingPromise = null; });

    return pickingPromise;
  }

  async function fetchAPI(path) {
    const fullUrl = `${activeInstance}${path}`;

    if (activeProxy === null) {
      // Direct — no proxy
      const r = await fetch(fullUrl, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }

    // Via proxy
    const proxied = PROXIES[activeProxy](fullUrl);
    const r = await fetch(proxied, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return data.contents ? JSON.parse(data.contents) : data;
  }

  async function search(query) {
    if (!activeInstance) {
      const ok = await pickInstance();
      if (!ok) throw new Error('No server reachable — check your connection');
    }
    const data = await fetchAPI(`/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
    if (!Array.isArray(data)) throw new Error('Unexpected response from server');
    return data;
  }

  function mapResults(data) {
    if (!Array.isArray(data)) return [];
    return data.map(v => ({
      id:    v.videoId,
      title: v.title  || 'Unknown',
      ch:    v.author || 'Unknown',
      thumb: v.videoThumbnails?.find(t => t.quality === 'medium')?.url
          || v.videoThumbnails?.[0]?.url || '',
      dur:   v.lengthSeconds || 0,
    }));
  }

  function mockTracks() { return []; }

  pickInstance();

  return { search, mapResults, pickInstance, mockTracks };
})();