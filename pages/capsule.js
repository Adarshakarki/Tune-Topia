// Capsule
const $ = (id) => document.getElementById(id)
let _period = '7d'

const THEME = { 
  text: 'var(--text)', 
  muted: 'var(--surface-3)', 
  bars: ['var(--accent)', 'var(--accent-mid)', 'var(--text)', 'var(--text-2)', 'var(--text-3)'] 
};

export function render() {
  const { current, previous, fullPrev } = _getHistory()
  _renderAll(current, previous, fullPrev)
}

export function initEvents() {
  document.querySelectorAll('.capsule-period-btn').forEach((btn) => {
    btn.addEventListener('click', () => { 
      document.querySelectorAll('.capsule-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); _period = btn.dataset.period; render();
    })
  })

  // Heatmap click delegation
  $('capsule-heatmap')?.addEventListener('click', (e) => {
    const cell = e.target.closest('.capsule-heat-cell');
    if (cell && cell.dataset.date) {
      _showHeatmapDetail(cell.dataset.date, _getHistory().current);
    }
  });
}

function _getHistory() {
  try {
    const all = JSON.parse(localStorage.getItem('tt_play_history') || '[]')
    const now = Date.now(), ms = 86400000;
    let current = [], previous = [], fullPrev = [];

    let periodMs = 0;
    if (_period === '1d') periodMs = ms;
    else if (_period === '7d') periodMs = 7 * ms;
    else if (_period === '1m') periodMs = 30 * ms;
    
    if (periodMs > 0) {
      current = all.filter(e => e.playedAt && (now - e.playedAt) < periodMs);
      previous = all.filter(e => e.playedAt && (now - e.playedAt) >= periodMs && (now - e.playedAt) < 2 * periodMs);
      fullPrev = all.filter(e => e.playedAt && (now - e.playedAt) >= periodMs);
    } else {
      current = all;
    }

    return {
      current: current.sort((a, b) => b.playedAt - a.playedAt),
      previous: previous.sort((a, b) => b.playedAt - a.playedAt),
      fullPrev
    }
  } catch {
    return { current: [], previous: [], fullPrev: [] }
  }
}

function _renderAll(h, prevH, fullPrev) {
  _renderSummary(h, prevH)
  _renderListeningTime(h, prevH)
  _renderInsights(h, prevH)
  _renderTopTracks(h)
  _renderPeakHours(h)
  _renderTopArtist(h)
  _renderHighlights(h)
  _renderBehavior(h)
  _renderTopAlbum(h)
  _renderHeatmap(h)
  _renderDiscovery(h, fullPrev)
}

function _renderListeningTime(history) {
  const totalSecs = history.reduce((s, e) => s + (Number(e.listenedMs || 0) / 1000), 0);

  const hrsFloat = totalSecs / 3600;
  const hrs = Math.floor(hrsFloat), mins = Math.floor((totalSecs % 3600) / 60);
  const valEl = $('capsule-hours'), unitEl = $('capsule-ring-unit'), subEl = $('capsule-time-sub'), fill = $('capsule-ring-fill');

  if (valEl) {
    if (hrsFloat >= 1) {
      valEl.textContent = hrsFloat.toFixed(1);
      if (unitEl) unitEl.textContent = 'hrs';
    } else {
      valEl.textContent = mins || '0';
      if (unitEl) unitEl.textContent = 'min';
    }
  }

  if (subEl) subEl.textContent = ''; // Removed subtext to avoid confusion
  if (fill) { const circ = 239, progress = Math.min(totalSecs / 36000, 1); fill.style.stroke = THEME.text; fill.style.strokeDashoffset = String((circ - circ * progress).toFixed(2)); }
}

function _renderTopTracks(history) {
  const el = $('capsule-top-tracks')
  if (!el) return
  const counts = {}

  history.forEach((e) => {
    if (!e.listenedMs) return;
    const key = e.id || `${e.title}-${e.artist}`
    if (!key || key.includes('undefined')) return
    if (!counts[key]) counts[key] = { title: e.title || 'Unknown', count: 0 }
    counts[key].count++
  })

  const top = Object.values(counts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  if (!top.length) {
    el.innerHTML = '<div class="capsule-empty-note">No tracks found</div>'
    return
  }

  const max = top[0].count
  el.innerHTML = top
    .map(
      (t, i) => `
    <div class="capsule-bar-row">
      <div class="capsule-bar-label" style="color:${THEME.text}" title="${t.title}">${t.title}</div>
      <div class="capsule-bar-track" style="background:${THEME.muted}">
        <div class="capsule-bar-fill" style="width:${((t.count / max) * 100).toFixed(1)}%; background:${THEME.bars[i]}"></div>
      </div>
      <span class="capsule-bar-count" style="color:${THEME.text}">${t.count}</span>
    </div>`
    )
    .join('')
}

function _renderPeakHours(history) {
  const el = $('capsule-peak-hours')
  if (!el) return
  const hrs = new Array(24).fill(0)
  history.forEach((e) => {
    if (e.playedAt) hrs[new Date(e.playedAt).getHours()]++
  })

  const max = Math.max(...hrs, 1)
  const peak = hrs.indexOf(Math.max(...hrs))
  const lbl = $('capsule-peak-label')

  if (lbl) {
    const timeStr = new Date(
      new Date().setHours(peak, 0, 0, 0)
    ).toLocaleTimeString([], { hour: 'numeric', hour12: true })
    lbl.textContent =
      history.length && Math.max(...hrs) > 0 ? `Peak: ${timeStr}` : '—'
    lbl.style.color = THEME.text
  }

  el.innerHTML = `<div class="capsule-hours-bars">${hrs
    .map((c, h) => {
      const isPeak = h === peak && history.length > 0
      return `<div class="capsule-hour-bar-wrap" title="${h}:00 — ${c} plays">
        <div class="capsule-hour-bar"
             style="height:${(c / max) * 100 || 4}%;
                    background:${isPeak ? THEME.text : THEME.bars[2]};
                    opacity:${isPeak ? 1 : 0.3}"></div>
      </div>`
    })
    .join('')}</div>`
}

function _renderSummary(h, prevH) {
  const el = $('capsule-summary-text');
  if (!el || !h.length) return;

  const personality = _calculatePersonality(h);
  const totalSecs = h.reduce((s, e) => s + (Number(e.listenedMs || 0) / 1000), 0);
  const hrs = (totalSecs / 3600).toFixed(1);
  const uniqueArtists = new Set(h.map(e => e.artist).filter(Boolean)).size;

  const topArt = _getTopItem(h, 'artist');
  
  let story = `You've been <strong>${personality}</strong> lately. `;
  story += `Spending ${hrs} hours with ${uniqueArtists} different artists. `;
  if (topArt) story += `Your rotation was dominated by <strong>${topArt.name}</strong>.`;

  el.innerHTML = story;
}

function _renderInsights(h, prevH) {
  const el = $('capsule-insights');
  if (!el) return;

  const currentSecs = h.reduce((s, e) => s + (Number(e.listenedMs || 0) / 1000), 0);
  const prevSecs = prevH.reduce((s, e) => s + (Number(e.listenedMs || 0) / 1000), 0);
  
  const timeDiff = prevSecs ? ((currentSecs - prevSecs) / prevSecs * 100).toFixed(0) : 0;
  const uniqueArt = new Set(h.map(e => e.artist).filter(Boolean)).size;
  const prevUniqueArt = new Set(prevH.map(e => e.artist).filter(Boolean)).size;
  const artDiff = prevUniqueArt ? uniqueArt - prevUniqueArt : 0;

  el.innerHTML = `
    <div class="capsule-insight-card">
      <div class="insight-val">${timeDiff > 0 ? '↑' : '↓'} ${Math.abs(timeDiff)}%</div>
      <div class="insight-label">Listening Time</div>
    </div>
    <div class="capsule-insight-card">
      <div class="insight-val">${artDiff >= 0 ? '+' : ''}${artDiff}</div>
      <div class="insight-label">New Artists</div>
    </div>
    <div class="capsule-insight-card">
      <div class="insight-val">${_calculatePersonality(h, true)}</div>
      <div class="insight-label">Personality</div>
    </div>
  `;
}

function _renderBehavior(history) {
  const el = $('capsule-behavior-stats');
  if (!el) return;

  const finishedThreshold = 30000; // 30s considered a "finish" in this context
  const finished = history.filter(e => e.listenedMs > finishedThreshold).length;
  const skips = history.filter(e => e.listenedMs > 0 && e.listenedMs < 10000).length;
  const total = finished + skips || 1;
  const completionRate = Math.round((finished / total) * 100);

  // Find most skipped artist
  const skipCounts = {};
  history.filter(e => e.listenedMs > 0 && e.listenedMs < 10000).forEach(e => {
    if (e.artist) skipCounts[e.artist] = (skipCounts[e.artist] || 0) + 1;
  });
  const mostSkipped = Object.entries(skipCounts).sort((a,b) => b[1]-a[1])[0];

  el.innerHTML = `
    <div class="behavior-row">
      <span>Completion Rate</span>
      <div class="behavior-bar"><div class="behavior-fill" style="width:${completionRate}%"></div></div>
      <span>${completionRate}%</span>
    </div>
    <div class="behavior-summary"> 
      ${mostSkipped ? `You've been avoiding <strong>${mostSkipped[0]}</strong> lately. ` : ''}
      You finished <strong>${finished}</strong> tracks and skipped <strong>${skips}</strong>.
    </div>
  `;
}

function _calculatePersonality(h, short = false) {
  if (!h.length) return "Quiet Listener";
  
  const counts = {};
  const hours = new Array(24).fill(0);
  h.forEach(e => {
    if (e.artist) counts[e.artist] = (counts[e.artist] || 0) + 1;
    if (e.playedAt) hours[new Date(e.playedAt).getHours()]++;
  });

  const uniqueCount = Object.keys(counts).length;
  const totalPlays = h.length;
  const explorerScore = uniqueCount / totalPlays;
  
  // Time of day
  const nightPlays = hours.slice(22, 24).reduce((a,b)=>a+b,0) + hours.slice(0, 4).reduce((a,b)=>a+b,0);
  const morningPlays = hours.slice(5, 10).reduce((a,b)=>a+b,0);

  if (nightPlays > totalPlays * 0.4) return short ? "Night Owl" : "The Night Owl";
  if (morningPlays > totalPlays * 0.4) return short ? "Early Bird" : "The Early Bird";
  if (explorerScore > 0.6) return short ? "Explorer" : "The Explorer";
  if (explorerScore < 0.2) return short ? "Loyalist" : "The Loyalist";
  
  return short ? "Vibe Curator" : "The Vibe Curator";
}

function _renderHighlights(history) {
  const el = $('capsule-highlights');
  if (!el) return;
  if (!history.length) { el.innerHTML = ''; return; }

  // Calculate Streak
  const playedDates = new Set(history.map(e => new Date(e.playedAt).toDateString()));
  let streak = 0;
  let check = new Date();
  while (playedDates.has(check.toDateString())) {
    streak++;
    check.setDate(check.getDate() - 1);
  }

  // Calculate longest session (songs within 15 mins of each other)
  let maxSession = 0, currentSession = 0;
  const sorted = [...history].sort((a, b) => a.playedAt - b.playedAt);
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && (sorted[i].playedAt - (sorted[i-1].playedAt + Number(sorted[i-1].listenedMs || 0))) < 900000) {
      currentSession += Number(sorted[i].listenedMs || 0);
    } else {
      currentSession = Number(sorted[i].listenedMs || 0);
    }
    maxSession = Math.max(maxSession, currentSession);
  }
  const sessionMins = Math.round(maxSession / 60000);

  el.innerHTML = `
    <div class="capsule-highlight-item">
      <div class="highlight-icon"><i class="bi bi-fire"></i></div>
      <div class="highlight-text">
        <div class="highlight-val">${streak} Day Streak</div>
        <div class="highlight-label">Active Listener</div>
      </div>
    </div>
    <div class="capsule-highlight-item">
      <div class="highlight-icon"><i class="bi bi-clock-history"></i></div>
      <div class="highlight-text">
        <div class="highlight-val">${sessionMins}m Session</div>
        <div class="highlight-label">Deepest Dive</div>
      </div>
    </div>
  `;
}

function _renderDiscovery(history, fullPrev) {
  const el = $('capsule-discovery-card');
  if (!el) return;

  const oldArtists = new Set((fullPrev || []).map(e => e.artist));
  const newArtistsInHistory = history.filter(e => e.artist && !oldArtists.has(e.artist));
  const uniqueCount = new Set(newArtistsInHistory.map(e => e.artist)).size;
  const topNew = _getTopItem(newArtistsInHistory, 'artist');

  el.innerHTML = `
    <div class="capsule-card-title">New Discovery</div>
    <div class="capsule-stat-number">${uniqueCount}</div>
    <div class="capsule-stat-sub">${topNew ? `Top: <strong>${topNew.name}</strong>` : 'No new artists found'}</div>
  `;
}

function _getTopItem(h, type) {
  const counts = {};
  h.forEach(e => {
    const val = e[type];
    if (val) counts[val] = (counts[val] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  return sorted.length ? { name: sorted[0][0], count: sorted[0][1] } : null;
}

function _renderTopArtist(history) {
  const el = $('capsule-top-artist-card')
  if (!el) return

  const data = {}
  history.forEach((e) => {
    if (!e.artist || !e.listenedMs) return
    if (!data[e.artist]) data[e.artist] = { count: 0, cover: '' }
    data[e.artist].count++
    if (!data[e.artist].cover && e.cover) data[e.artist].cover = e.cover
  })

  const top = Object.entries(data).sort((a, b) => b[1].count - a[1].count)[0]
  if (!top) {
    el.innerHTML = '<div class="capsule-empty-note">—</div>'
    return
  }

  const [name, { count, cover }] = top
  el.innerHTML = `
    ${cover ? `<div class="capsule-img-thumb-wrap"><img class="capsule-img-thumb" src="${cover}" alt="" /></div>` : ''}
    <div class="capsule-img-card-name">${name}</div>
    <div class="capsule-img-card-sub">${count} play${count !== 1 ? 's' : ''}</div>`
}

function _renderTopAlbum(history) {
  const el = $('capsule-top-album-card')
  if (!el) return

  const data = {}
  history.forEach((e) => {
    // Filter valid
    if (!e.album || !e.listenedMs) return
    if (!data[e.album]) data[e.album] = { count: 0, cover: '' }
    data[e.album].count++
    if (!data[e.album].cover && e.cover) data[e.album].cover = e.cover
  })

  const top = Object.entries(data).sort((a, b) => b[1].count - a[1].count)[0]
  if (!top) {
    el.innerHTML = '<div class="capsule-empty-note">—</div>'
    return
  }

  const [name, { count, cover }] = top
  el.innerHTML = `
    ${cover ? `<div class="capsule-img-thumb-wrap"><img class="capsule-img-thumb" src="${cover}" alt="" /></div>` : ''}
    <div class="capsule-img-card-name">${name}</div>
    <div class="capsule-img-card-sub">${count} play${count !== 1 ? 's' : ''}</div>`
}

function _renderHeatmap(history) {
  const el = $('capsule-heatmap');
  if (!el) return;
  const days = {};

  history.forEach(e => { if (!e.playedAt) return; const d = new Date(e.playedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days[key] = (days[key] || 0) + 1
  })

  const max = Math.max(...Object.values(days), 1)
  const today = new Date()
  const cells = []

  // 56-day grid
  for (let i = 55; i >= 0; i--) {
    const d = new Date()
    d.setDate(today.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const c = days[key] || 0
    const opacity = c === 0 ? 0.05 : Math.max(0.15, (c / max).toFixed(2))
    const readableDate = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    cells.push(`<div class="capsule-heat-cell"
      style="background:${THEME.text}; opacity:${opacity}"
      data-date="${key}"
      title="${readableDate}: ${c} plays"></div>`)
  }

  el.innerHTML = `<div class="capsule-heatmap-grid">${cells.join('')}</div>`
}

function _showHeatmapDetail(dateStr, history) {
  const el = $('capsule-heatmap-details');
  if (!el) return;

  const dayHistory = history.filter(e => {
    if (!e.playedAt) return false;
    const d = new Date(e.playedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return key === dateStr;
  });

  if (!dayHistory.length) {
    el.innerHTML = `<div class="heatmap-detail-empty">No music played on ${dateStr}</div>`;
    return;
  }

  const topTrack = _getTopItem(dayHistory, 'title');
  const d = new Date(dateStr + 'T12:00:00'); // Midday to avoid TZ shifts
  const dateTitle = d.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

  el.innerHTML = `
    <div class="heatmap-detail-card">
      <div class="heatmap-detail-header">
        <strong>${dateTitle}</strong>
        <span>${dayHistory.length} plays</span>
      </div>
      ${topTrack ? `<div class="heatmap-detail-top">Most played: <span>${topTrack.name}</span></div>` : ''}
    </div>
  `;
}
