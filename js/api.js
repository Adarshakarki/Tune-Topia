const API = (() => {
  const ALL_INSTANCES = [
    'https://iv.melmac.space',
    'https://invidious.slipfox.xyz',
    'https://invidious.privacydev.net',
    'https://yt.cdaut.de',
    'https://invidious.flokinet.to',
  ];

  const PROXIES = [
    (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://thingproxy.freeboard.io/fetch/${url}`
  ];

  let activeInstance = null;
  let activeProxy    = 0;
  let pickingPromise = null;

  function setPill(text, state) {
    const pill = document.getElementById('pill');
    const txt  = document.getElementById('pill-text');
    if (txt)  txt.textContent = text;
    if (pill) pill.className  = `server-pill${state ? ' ' + state : ''}`;
  }

  async function probe(inst, proxyIdx) {
    const url = PROXIES[proxyIdx](`${inst}/api/v1/stats`);
    const r   = await fetch(url, { signal: AbortSignal.timeout(5000) });
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
      for (let pi = 0; pi < PROXIES.length; pi++) {
        attempts.push(
          probe(inst, pi).then(() => ({ inst, pi }))
        );
      }
    }

    pickingPromise = Promise.any(attempts)
      .then(({ inst, pi }) => {
        activeInstance = inst;
        activeProxy    = pi;
        setPill('● ' + inst.replace('https://', ''), 'ok');
        return true;
      })
      .catch(() => {
        setPill('✕ no server', 'err');
        return false;
      })
      .finally(() => { pickingPromise = null; });

    return pickingPromise;
  }

  async function fetchViaProxy(url) {
    const proxied = PROXIES[activeProxy](url);
    const r = await fetch(proxied, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return data.contents ? JSON.parse(data.contents) : data;
  }

  async function search(query) {
    if (!activeInstance) {
      const ok = await pickInstance();
      if (!ok) throw new Error('No server reachable — try again');
    }
    const url  = `${activeInstance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
    const data = await fetchViaProxy(url);
    if (!Array.isArray(data)) throw new Error('Unexpected server response');
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

  // BUG FIX: mockTracks was called in home.js but never defined.
  // Returns empty array so the section gracefully shows "no results"
  // instead of crashing with TypeError.
  function mockTracks() {
    return [];
  }

  pickInstance();

  return { search, mapResults, pickInstance, mockTracks };
})();