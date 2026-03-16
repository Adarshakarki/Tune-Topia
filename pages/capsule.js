const $ = (id) => document.getElementById(id)
let _period = '7d'

const THEME = {
  text: 'oklch(0.15 0.018 48)',
  muted: 'oklch(0.15 0.018 48 / 0.1)',
  bars: [
    'oklch(0.20 0.018 48)',
    'oklch(0.35 0.018 48)',
    'oklch(0.50 0.018 48)',
    'oklch(0.65 0.018 48)',
    'oklch(0.80 0.018 48)',
  ],
}

export function render() {
  _renderAll(_getHistory())
}

export function initEvents() {
  document.querySelectorAll('.capsule-period-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document
        .querySelectorAll('.capsule-period-btn')
        .forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')
      _period = btn.dataset.period
      render()
    })
  })
}

function _getHistory() {
  try {
    const all = JSON.parse(localStorage.getItem('tt_play_history') || '[]')
    const now = Date.now(),
      ms = 86400000
    let filtered = all
    if (_period === '7d')
      filtered = all.filter((e) => e.playedAt && now - e.playedAt < 7 * ms)
    if (_period === '30d')
      filtered = all.filter((e) => e.playedAt && now - e.playedAt < 30 * ms)
    return filtered.sort((a, b) => b.playedAt - a.playedAt)
  } catch (e) {
    console.error('Capsule: storage error', e)
    return []
  }
}

function _renderAll(h) {
  _renderListeningTime(h)
  _renderTopTracks(h)
  _renderPeakHours(h)
  _renderTopArtist(h)
  _renderTopAlbum(h)
  _renderHeatmap(h)
  _renderDiscovery(h)
}

function _renderListeningTime(history) {
  const totalSecs = history.reduce((s, e) => {
    if (e.listenedMs) return s + Number(e.listenedMs) / 1000
    const rawDur = e.duration ?? '0:00'
    if (typeof rawDur === 'number') return s + rawDur
    const p = String(rawDur).split(':').map(Number)
    if (p.some(isNaN)) return s
    if (p.length >= 3) return s + (p[0] * 3600 + p[1] * 60 + p[2])
    if (p.length === 2) return s + (p[0] * 60 + p[1])
    return s + (p[0] || 0)
  }, 0)

  const hrs = Math.floor(totalSecs / 3600)
  const mins = Math.floor((totalSecs % 3600) / 60)

  const valEl = $('capsule-hours')
  const unitEl = $('capsule-ring-unit')
  const subEl = $('capsule-time-sub')
  const fill = $('capsule-ring-fill')

  if (valEl) valEl.textContent = hrs || mins || '0'
  if (unitEl) unitEl.textContent = hrs ? 'hrs' : 'min'
  if (subEl)
    subEl.textContent = history.length
      ? hrs
        ? `${hrs} hr${hrs !== 1 ? 's' : ''} ${mins} min`
        : `${mins} minutes`
      : 'No listening data yet'

  if (fill) {
    const circ = 239
    const progress = Math.min(totalSecs / 36000, 1)
    fill.style.stroke = THEME.text
    fill.style.strokeDashoffset = String((circ - circ * progress).toFixed(2))
  }
}

function _renderTopTracks(history) {
  const el = $('capsule-top-tracks')
  if (!el) return
  const counts = {}

  history.forEach((e) => {
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

function _renderTopArtist(history) {
  const el = $('capsule-top-artist-card')
  if (!el) return

  const data = {}
  history.forEach((e) => {
    if (!e.artist) return
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
    if (!e.album) return
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
  const el = $('capsule-heatmap')
  if (!el) return
  const days = {}

  history.forEach((e) => {
    if (!e.playedAt) return
    const d = new Date(e.playedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    days[key] = (days[key] || 0) + 1
  })

  const max = Math.max(...Object.values(days), 1)
  const today = new Date()
  const cells = []

  // - 56 days = 8 rows × 14 cols, compact grid -
  for (let i = 55; i >= 0; i--) {
    const d = new Date()
    d.setDate(today.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const c = days[key] || 0
    const opacity = c === 0 ? 0.05 : Math.max(0.15, (c / max).toFixed(2))
    cells.push(`<div class="capsule-heat-cell"
      style="background:${THEME.text}; opacity:${opacity}"
      title="${key}: ${c} plays"></div>`)
  }

  el.innerHTML = `<div class="capsule-heatmap-grid">${cells.join('')}</div>`
}

function _renderDiscovery(history) {
  const el = $('capsule-discovery')
  if (!el) return
  el.textContent = new Set(history.map((e) => e.artist).filter(Boolean)).size
  el.style.color = THEME.text
}
