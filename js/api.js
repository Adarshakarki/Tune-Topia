// ── api.js — YouTube Data API v3 (native CORS, no proxy needed) ──

const API = (() => {

  const YT_KEY      = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
  const YT_BASE     = 'https://www.googleapis.com/youtube/v3';
  const MAX_RESULTS = 15;

  // ── pick "instance" — just validates the key works ─────────────────
  async function pickInstance(onStatus) {
    onStatus?.('connecting');
    try {
      const url = `${YT_BASE}/search?` + new URLSearchParams({
        part:           'id',
        type:           'video',
        videoEmbeddable: 'true',
        maxResults:     '1',
        q:              'music',
        key:            YT_KEY,
      });
      const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (r.ok) {
        onStatus?.('ok', 'youtube.com');
        return true;
      }
      const err = await r.json();
      throw new Error(err?.error?.message || `HTTP ${r.status}`);
    } catch (e) {
      onStatus?.('error');
      console.warn('[API] key check failed:', e.message);
      return false;
    }
  }

  // ── search ──────────────────────────────────────────────────────────
  async function search(query, onStatus) {
    const url = `${YT_BASE}/search?` + new URLSearchParams({
      part:            'snippet',
      type:            'video',
      videoEmbeddable: 'true',
      maxResults:      String(MAX_RESULTS),
      q:               query,
      key:             YT_KEY,
    });

    let res;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    } catch (e) {
      throw new Error('Network error — check your connection.');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg  = body?.error?.message || `HTTP ${res.status}`;
      // quota exceeded — common issue
      if (res.status === 403) throw new Error(`API quota exceeded or key invalid: ${msg}`);
      throw new Error(msg);
    }

    const data = await res.json();
    return (data.items || []).map(mapItem).filter(Boolean);
  }

  // ── map YouTube API item → clean track object ───────────────────────
  function mapItem(item) {
    const id = item?.id?.videoId;
    if (!id) return null;
    const s = item.snippet || {};
    return {
      id,
      title: s.title                               || 'Unknown Title',
      ch:    s.channelTitle                        || 'Unknown Artist',
      thumb: s.thumbnails?.medium?.url
          || s.thumbnails?.default?.url            || '',
      dur:   0, // YT search doesn't return duration; use contentDetails if needed
    };
  }

  return { search, pickInstance };

})();

window.API = API;

