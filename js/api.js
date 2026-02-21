const API = (() => {
  const ALL_INSTANCES = [
    'https://iv.melmac.space',
  ];

  const PROXIES = [
    (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://thingproxy.freeboard.io/fetch/${url}`
  ];

  let activeInstance  = null;
  let currentProxyIdx = 0;

  // ── Update the pill element (text + ok/err class) ──
  function setPill(text, state) {
    const pill     = document.getElementById('pill');
    const pillText = document.getElementById('pill-text');
    if (pillText) pillText.textContent = text;
    if (pill)     pill.className = `server-pill${state ? ' ' + state : ''}`;
  }

  // ── Fetch through proxy chain, rotate on failure ──
  async function fetchWithFallback(url) {
    for (let i = 0; i < PROXIES.length; i++) {
      try {
        const proxiedUrl = PROXIES[currentProxyIdx](url);
        const r = await fetch(proxiedUrl, { signal: AbortSignal.timeout(7000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        // allorigins wraps in .contents as a JSON string
        return data.contents ? JSON.parse(data.contents) : data;
      } catch (e) {
        console.warn(`Proxy ${currentProxyIdx} failed (${e.message}), trying next…`);
        currentProxyIdx = (currentProxyIdx + 1) % PROXIES.length;
      }
    }
    throw new Error('All proxies are currently blocked or down.');
  }

  // ── Find a live instance ──
  async function pickInstance() {
    setPill('connecting…', '');

    for (const inst of ALL_INSTANCES) {
      try {
        const data = await fetchWithFallback(`${inst}/api/v1/stats`);
        if (data) {
          activeInstance = inst;
          const label = inst.replace('https://', '');
          setPill('● ' + label, 'ok');
          return true;
        }
      } catch { continue; }
    }

    setPill('✕ proxy error', 'err');
    return false;
  }

  // ── Search ──
  async function search(query) {
    if (!activeInstance) {
      const ok = await pickInstance();
      if (!ok) throw new Error('No Invidious server reachable');
    }
    const url = `${activeInstance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
    const data = await fetchWithFallback(url);
    if (!Array.isArray(data)) throw new Error('Unexpected response from server');
    return data;
  }

  // ── Map raw API results to track objects ──
  function mapResults(data) {
    if (!Array.isArray(data)) return [];
    return data.map(v => ({
      id:    v.videoId,
      title: v.title    || 'Unknown',
      ch:    v.author   || 'Unknown',
      thumb: v.videoThumbnails?.find(t => t.quality === 'medium')?.url
          || v.videoThumbnails?.[0]?.url || '',
      dur:   v.lengthSeconds || 0,
    }));
  }

  return { search, mapResults, pickInstance };
})();

API.pickInstance();