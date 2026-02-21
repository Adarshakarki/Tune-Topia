/* ════════════════════════════════════════════════════════════
   api.js — Invidious search wrapper
   Strategy: probe ALL known instances IN PARALLEL with a
   lightweight /api/v1/stats call and race them — whichever
   responds first (and passes CORS) wins. This is much faster
   than the old serial fallback chain.
   ════════════════════════════════════════════════════════════ */

const API = (() => {

  // Every known public Invidious instance as of 2025.
  // Probed in parallel; first to respond wins.
  const ALL_INSTANCES = [
    'https://yewtu.be',
    'https://invidious.privacydev.net',
    'https://inv.nadeko.net',
    'https://inv.tux.pizza',
    'https://invidious.protokolla.fi',
    'https://invidious.private.coffee',
    'https://yt.drgnz.club',
    'https://iv.datura.network',
    'https://invidious.perennialte.ch',
    'https://invidious.drgns.space',
    'https://invidious.jing.rocks',
    'https://invidious.privacyredirect.com',
    'https://invidious.reallyaweso.me',
    'https://invidious.materialio.us',
    'https://invidious.incogniweb.net',
    'https://inv.us.projectsegfau.lt',
    'https://inv.in.projectsegfau.lt',
    'https://invidious.lunar.icu',
    'https://iv.ggtyler.dev',
    'https://inv.zzls.xyz',
    'https://invidious.flokinet.to',
    'https://invidious.projectsegfau.lt',
    'https://inv.bp.projectsegfau.lt',
    'https://invidious.slipfox.xyz',
    'https://invidious.tiekoetter.com',
    'https://vid.priv.au',
    // User-specified instances
    'https://inv.nadeko.net',
    'https://invidious.fdn.fr',
    'https://yt.artemislena.eu',
    'https://invidious.nerdvpn.de',
    'https://iv.melmac.space',
  ];

  let activeInstance  = null;
  let pickingPromise  = null;  // deduplicate concurrent picks

  const pill = () => document.getElementById('pill');

  // ── Probe a single instance using an actual search request ──
  // Stats endpoint can have different CORS settings than search,
  // so we must probe with the exact endpoint we intend to use.
  async function probe(inst) {
    const r = await fetch(
      `${inst}/api/v1/search?q=test&type=video&fields=videoId`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) throw new Error(`${inst} returned ${r.status}`);
    return inst;
  }

  // ── Race all instances; first healthy one wins ──
  function pickInstance() {
    // If a pick is already in flight, reuse it
    if (pickingPromise) return pickingPromise;

    const p = pill();
    if (p) { p.textContent = '⌛ finding server…'; p.className = 'server-pill'; }

    pickingPromise = Promise.any(ALL_INSTANCES.map(probe))
      .then(winner => {
        activeInstance = winner;
        const label = winner.replace('https://', '');
        if (p) { p.textContent = '● ' + label; p.className = 'server-pill ok'; }
        return true;
      })
      .catch(() => {
        if (p) { p.textContent = '✕ No server available'; p.className = 'server-pill err'; }
        return false;
      })
      .finally(() => { pickingPromise = null; });

    return pickingPromise;
  }

  // ── Search ──
  async function search(query) {
    if (!activeInstance) {
      const ok = await pickInstance();
      if (!ok) throw new Error('No reachable Invidious server found');
    }

    const url = `${activeInstance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&fields=videoId,title,author,videoThumbnails,lengthSeconds`;
    let r;
    try {
      r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    } catch {
      activeInstance = null;
      throw new Error('Connection lost — please try again');
    }

    if (!r.ok) {
      activeInstance = null;
      throw new Error(`Server error ${r.status} — try again`);
    }

    return r.json();
  }

  // ── Helpers ──
  function getBestThumb(thumbs) {
    if (!thumbs?.length) return '';
    const pref = ['medium', 'default', 'high', 'maxres'];
    for (const q of pref) {
      const t = thumbs.find(x => x.quality === q);
      if (t?.url) return t.url;
    }
    return thumbs[0]?.url || '';
  }

  function mapResults(data) {
    return data.map(v => ({
      id:    v.videoId,
      title: v.title,
      ch:    v.author,
      thumb: getBestThumb(v.videoThumbnails),
      dur:   v.lengthSeconds,
    }));
  }

  // Kick off parallel probe immediately on page load
  pickInstance();

  return { search, mapResults };
})();