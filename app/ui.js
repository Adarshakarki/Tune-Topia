import State from './state.js'
import { has as isLiked } from '../modules/likedSongs.js'
import { escHtml, fmtTime, qualityBadge } from '../api/utils.js'
import { getActiveLine, getActiveWord } from '../modules/lyrics.js';

const $ = (id) => document.getElementById(id)

// Toast notification
export function toast(msg) {
  const el = $('toast')
  if (!el) return
  el.textContent = msg
  el.classList.add('show')
  clearTimeout(toast._t)
  toast._t = setTimeout(() => el.classList.remove('show'), 2600)
}

export function applyTheme(theme) {
  const isDark = theme === 'dark'
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  $('theme-toggle-btn')?.setAttribute('aria-checked', String(isDark))
  const meta = document.getElementById('theme-color-meta')
  if (meta) meta.setAttribute('content', isDark ? '#0E0C0A' : '#F5F0E8')
}

export function renderGreeting() {
  const h = new Date().getHours()
  const greet =
    h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const el = $('home-greeting')
  if (el) el.textContent = `${greet}, ${State.get('user.name') || 'Friend'}`
}

// Extract dominant color from image via wsrv.nl proxy
export function extractColor(src, cb) {
  const proxied = `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=80&h=80&fit=cover&output=jpg`
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    try {
      const c = document.createElement('canvas')
      c.width = c.height = 80
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0, 80, 80)
      _pickColor(ctx.getImageData(0, 0, 80, 80).data, cb)
    } catch {
      cb(30, 30, 40)
    }
  }
  img.onerror = () => cb(30, 30, 40)
  img.src = proxied
}

function _pickColor(data, cb) {
  const buckets = {}
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2],
      a = data[i + 3]
    if (a < 128) continue
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    if (lum > 230 || lum < 15) continue
    const key = `${r >> 5},${g >> 5},${b >> 5}`
    if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, n: 0 }
    buckets[key].r += r
    buckets[key].g += g
    buckets[key].b += b
    buckets[key].n++
  }
  let best = null
  for (const v of Object.values(buckets)) {
    if (!best || v.n > best.n) best = v
  }
  if (!best) {
    cb(30, 30, 40)
    return
  }
  let r = Math.round(best.r / best.n)
  let g = Math.round(best.g / best.n)
  let b = Math.round(best.b / best.n)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  if (lum > 200) {
    r = Math.round(r * 0.82)
    g = Math.round(g * 0.82)
    b = Math.round(b * 0.82)
  } else if (lum < 30) {
    r = Math.min(255, (r * 1.5 + 15) | 0)
    g = Math.min(255, (g * 1.5 + 15) | 0)
    b = Math.min(255, (b * 1.5 + 15) | 0)
  }
  cb(r, g, b)
}

export function renderHero(track) {
  const el = $('hero-card')
  if (!el || !track) return
  el.innerHTML = `
    <div class="hero-inner" style="background-image:url('${escHtml(track.cover)}')">
      <div class="hero-overlay"></div>
      <div class="hero-info">
        <span class="hero-label">Featured</span>
        <div class="hero-title">${escHtml(track.title)}</div>
        <div class="hero-artist">${escHtml(track.artist || '')}</div>
      </div>
      <button class="hero-play" data-hero-play>
        <i class="bi bi-play-fill"></i>
      </button>
    </div>`
  el._track = track
}

export function renderHorizCards(tracks, container) {
  if (!container) return
  container.innerHTML = ''
  tracks.slice(0, 15).forEach((t, i) => {
    const div = document.createElement('div')
    div.className = 'horiz-card'
    div.dataset.index = i
    div.innerHTML = `
      <img class="horiz-art" src="${escHtml(t.coverSmall || t.cover || '')}" onerror="this.src=''" alt=""/>
      <div class="horiz-title">${escHtml(t.title || t.name || '')}</div>
      <div class="horiz-artist">${escHtml(t.artist || '')}</div>`
    container.appendChild(div)
  })
  container._tracks = tracks
}

export function renderTopResult(track, container) {
  if (!container || !track) return
  const badge = qualityBadge(track)
  container.innerHTML = `
    <div class="top-result-card" data-id="${escHtml(track.id)}">
      <img src="${escHtml(track.cover || '')}" onerror="this.src=''" alt=""/>
      <div class="top-result-info">
        <span class="top-result-label">Top Result</span>
        <div class="top-result-title">${escHtml(track.title)}</div>
        <div class="top-result-meta">${escHtml(track.artist || '')}</div>
        ${badge ? `<span class="quality-badge ${badge.cls}">${badge.label}</span>` : ''}
      </div>
      <button class="top-result-play"><i class="bi bi-play-fill"></i></button>
    </div>`
}

export function renderTracks(tracks, container, currentId) {
  if (!tracks.length) {
    container.innerHTML = emptyState(
      'bi-music-note-beamed',
      'No results found',
      'Try a different search'
    )
    return
  }
  container.innerHTML = tracks
    .map((t, i) => {
      const badge = qualityBadge(t)
      const active = t.id === currentId
      const isVideo = t.source === 'youtube'
      return `
      <div data-index="${i}" data-tid="${escHtml(t.id)}">
        <div class="track-card${active ? ' playing' : ''}">
          <img class="${isVideo ? 'track-thumb-video' : 'track-thumb'}"
               src="${escHtml(t.coverSmall || t.cover || '')}" onerror="this.src=''" alt=""/>
          <div class="track-info">
            <div class="track-name-row">
              <div class="track-name${active ? ' playing' : ''}">${escHtml(t.title)}</div>
              ${t.explicit ? `<span class="explicit-tag">E</span>` : ''}
              ${badge ? `<span class="quality-badge ${badge.cls}">${badge.label}</span>` : ''}
            </div>
            <div class="track-meta">${escHtml(t.artist || '')}${t.album ? ` · ${escHtml(t.album)}` : ''}</div>
          </div>
          <div class="track-right">
            ${active ? `<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>` : ''}
            <button class="track-more-btn"><i class="bi bi-three-dots-vertical"></i></button>
          </div>
        </div>
      </div>`
    })
    .join('')
  container._tracks = tracks
}

export function renderAlbums(albums, container) {
  if (!albums.length) {
    container.innerHTML = _emptyState('No albums found')
    return
  }
  container.className = 'card-grid'
  container.innerHTML = albums
    .map(
      (a, i) => `
    <div class="card-item" data-index="${i}">
      <img class="card-art" src="${escHtml(a.cover || '')}" onerror="this.src=''" alt=""/>
      <div class="card-title">${escHtml(a.title || a.name || '')}</div>
      <div class="card-sub">${escHtml(a.artist || '')}</div>
    </div>`
    )
    .join('')
  container._albums = albums
}

export function renderArtists(artists, container) {
  if (!artists.length) {
    container.innerHTML = _emptyState('No artists found')
    return
  }
  container.className = 'artist-grid'
  container.innerHTML = artists
    .map(
      (a, i) => `
    <div class="card-item" data-index="${i}">
      <img class="card-art round" src="${escHtml(a.cover || '')}" onerror="this.src=''" alt=""/>
      <div class="card-title">${escHtml(a.name || '')}</div>
    </div>`
    )
    .join('')
  container._artists = artists
}

export function renderMoodTiles(moods, container) {
  if (!container) return
  container.innerHTML = moods
    .map(
      (m) => `
    <div class="mood-tile"
         style="--c1:${m.c1};--c2:${m.c2}${m.img ? `;background-image:url('${escHtml(m.img)}');background-size:cover;background-position:center` : ''}"
         ${m.genreId ? `data-genre-id="${escHtml(m.genreId)}"` : ''}>
      <span>${escHtml(m.label)}</span>
    </div>`
    )
    .join('')
}

export function renderQueue(tracks, position, upcoming) {
  const list = $('np-queue-list')
  if (!list) return
  const current = tracks[position]
  if (upcoming === undefined) upcoming = tracks.slice(position + 1)
  let html = ''
  if (current) {
    html +=
      `<div class="queue-section-label">Now Playing</div>` +
      _queueItem(current, position, true)
  }
  if (upcoming.length) {
    html +=
      `<div class="queue-section-label">Up Next</div>` +
      upcoming.map((t, i) => _queueItem(t, position + 1 + i, false)).join('')
  }
  if (!current && !upcoming.length)
    html = `<div class="npq-empty"><i class="bi bi-music-note-list"></i><p>Queue is empty</p></div>`
  list.innerHTML = html
}

function _queueItem(t, index, isActive) {
  return `
    <div class="npq-item${isActive ? ' active' : ''}" data-index="${index}">
      <img class="npq-art" src="${escHtml(t.coverSmall || t.cover || '')}" onerror="this.src=''" alt=""/>
      <div class="npq-info">
        <div class="npq-title${isActive ? ' active' : ''}">${escHtml(t.title)}</div>
        <div class="npq-artist">${escHtml(t.artist || '')}</div>
      </div>
      ${
        isActive
          ? `<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>`
          : `<span class="npq-dur">${t.dur || ''}</span>`
      }
    </div>`
}

export function renderLyrics(synced, plain) {
  const body = $('np-lyrics-body')
  if (!body) return
  
  if (synced?.length) {
    body.innerHTML = synced
      .map((line, i) => {
        // If the line has word-level timestamps, wrap each word in a span
        if (line.words && line.words.length > 0) {
          const wordsHtml = line.words.map((word, wIdx) => 
            `<span class="np-lyric-word" data-windex="${wIdx}">${escHtml(word.text)} </span>`
          ).join('')
          return `<div class="np-lyrics-line enhanced" data-index="${i}">${wordsHtml}</div>`
        }
        // Fallback to standard line
        return `<div class="np-lyrics-line" data-index="${i}">${escHtml(line.text)}</div>`
      })
      .join('')
    return
  }

  if (plain) {
    body.innerHTML = plain
      .split('\n')
      .map(line => `<div class="np-lyrics-line">${escHtml(line) || '&nbsp;'}</div>`)
      .join('')
    return
  }
  
  body.innerHTML = `<div class="np-lyrics-placeholder"><i class="bi bi-mic-fill"></i><p>Lyrics not available</p></div>`
}

export function updateActiveLyric(syncedLyrics, currentTime) {
  const body = $('np-lyrics-body')
  if (!body || !syncedLyrics?.length) return

  const activeIndex = getActiveLine(syncedLyrics, currentTime)
  const lines = body.querySelectorAll('.np-lyrics-line')

  lines.forEach((el, i) => {
    const isActive = i === activeIndex
    el.classList.toggle('active', isActive)

    // Handle Word-by-Word highlighting inside the active line
    if (isActive) {
      const lineData = syncedLyrics[i]
      if (lineData.words) {
        const activeWordIndex = getActiveWord(lineData, currentTime)
        const words = el.querySelectorAll('.np-lyric-word')
        
        words.forEach((wordEl, wIdx) => {
          // 'passed' = word already sung, 'current' = specifically active word
          wordEl.classList.toggle('passed', wIdx <= activeWordIndex)
          wordEl.classList.toggle('current', wIdx === activeWordIndex)
        })
      }
    }
  })

  // Smooth scroll to the active line
  const activeEl = body.querySelector('.np-lyrics-line.active')
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

export function setTrackInfo(track) {
  if (!track) return
  const art = track.cover || track.coverSmall || ''

  $('player-bar')?.classList.add('has-track')
  _setSrc('bar-art', art)
  _setText('bar-artist', track.artist || '—')

  const barTitle = $('bar-title')
  if (barTitle) {
    barTitle.style.cssText = 'display:flex;align-items:center;gap:4px;'
    barTitle.innerHTML =
      (track.title || '—') +
      (track.explicit
        ? ' <span style="font-size:9px;font-weight:900;color:rgba(255,255,255,0.7);border:1.5px solid rgba(255,255,255,0.7);border-radius:2px;padding:0 3px;line-height:14px;flex-shrink:0;">E</span>'
        : '')
  }

  ;['np-bg-art', 'np-artwork-img', 'np-desktop-art'].forEach((id) =>
    _setSrc(id, art)
  )
  _setText('np-title', track.title || '—')
  _setText('np-artist', track.artist || '—')
  _setText('np-topbar-title', track.title || '')
  _show('np-explicit-tag', track.explicit || false)
  _setText('np-lyrics-track-name', track.title || '')
  _setText('np-lyrics-track-artist', track.artist || '')
  _setText('np-queue-track-name', track.title || '')

  syncLikeButtons(track.id)

  // Fetch artist fanart for NP background
  if (track.artist) {
    const q = encodeURIComponent(track.artist.split(',')[0].trim())
    fetch(`https://www.theaudiodb.com/api/v1/json/2/search.php?s=${q}`)
      .then((r) => r.json())
      .then((data) => {
        const a = data?.artists?.[0]
        const fanarts = [
          a?.strArtistFanart,
          a?.strArtistFanart2,
          a?.strArtistFanart3,
          a?.strArtistFanart4,
        ].filter(Boolean)
        if (window._fanartTimer) {
          clearInterval(window._fanartTimer)
          window._fanartTimer = null
        }
        const bgArt = $('np-bg-art')
        if (bgArt) bgArt.src = fanarts.length ? fanarts[0] : art || ''
      })
      .catch(() => {
        const bgArt = $('np-bg-art')
        if (bgArt) bgArt.src = art || ''
      })
  }

  if (art) {
    extractColor(art, (r, g, b) => {
      const dr = Math.round(r * 0.52),
        dg = Math.round(g * 0.52),
        db = Math.round(b * 0.52)
      const base = `${r},${g},${b}`,
        dark = `${dr},${dg},${db}`
      const bg = $('player-bar-bg')
      if (bg)
        bg.style.background = `linear-gradient(135deg, rgb(${base}), rgb(${dark}))`
      const bar = $('player-bar')
      if (bar) bar.style.setProperty('--_fade', `rgb(${dark})`)
      const np = $('now-playing')
      if (np) {
        np.style.background = `rgb(${dark})`
        np.style.setProperty('--np-color', `rgb(${dark})`)
      }
      const ctrl = $('np-controls-col')
      if (ctrl) ctrl.style.background = `rgb(${dark})`
      ;[$('np-lyrics-panel'), $('np-queue-panel')].forEach((el) => {
        if (el) el.style.background = `rgb(${dark})`
      })
    })
  }
}

export function setPlayState(playing) {
  const icon = playing ? 'bi-pause-fill' : 'bi-play-fill'
  ;[
    'mini-play-icon',
    'bar-play-icon',
    'np-play-icon',
    'np-lyrics-play-icon',
    'np-queue-play-icon',
  ].forEach((id) => {
    const el = $(id)
    if (el) el.className = `bi ${icon}`
  })
  $('now-playing')?.classList.toggle('paused', !playing)
}

export function updateProgress(pct, cur, dur) {
  ;[
    'bar-progress-mobile-fill',
    'bar-progress-fill',
    'np-progress-fill',
    'np-lyrics-mini-fill',
    'np-queue-mini-fill',
  ].forEach((id) => _setWidth(id, pct))
  _setText('bar-time-cur', fmtTime(cur))
  _setText('bar-time-tot', fmtTime(dur))
  _setText('np-time-cur', fmtTime(cur))
  _setText('np-time-tot', fmtTime(dur))
}

export function updateVolume(v) {
  _setWidth('vol-fill', v * 100)
  _setWidth('bar-vol-fill', v * 100)
}

export function setShuffle(on) {
  $('bar-shuffle-btn')?.classList.toggle('active', on)
  const badge = $('sheet-shuffle-state')
  if (badge) {
    badge.textContent = on ? 'On' : 'Off'
    badge.classList.toggle('on', on)
  }
}

export function setRepeat(on) {
  $('bar-repeat-btn')?.classList.toggle('active', on)
  const badge = $('sheet-repeat-state')
  if (badge) {
    badge.textContent = on ? 'On' : 'Off'
    badge.classList.toggle('on', on)
  }
}

export function syncLikeButtons(trackId) {
  const liked = isLiked(trackId)
  document
    .querySelectorAll(`.track-like-btn[data-tid="${trackId}"]`)
    .forEach((btn) => {
      btn.classList.toggle('liked', liked)
      const icon = btn.querySelector('i')
      if (icon) icon.className = `bi ${liked ? 'bi-heart-fill' : 'bi-heart'}`
    })
  ;[$('bar-like-btn'), $('np-love-btn')].forEach((btn) => {
    if (!btn) return
    btn.classList.toggle('liked', liked)
    const icon = btn.querySelector('i')
    if (icon) icon.className = `bi ${liked ? 'bi-heart-fill' : 'bi-heart'}`
  })
}

export function showPage(name) {
  document
    .querySelectorAll('.page')
    .forEach((p) => p.classList.remove('active'))
  $(`page-${name}`)?.classList.add('active')
  document
    .querySelectorAll('.nav-btn')
    .forEach((b) => b.classList.remove('active'))
  document
    .querySelector(`.nav-btn[data-page="${name}"]`)
    ?.classList.add('active')
  document
    .querySelectorAll('.sb-item')
    .forEach((b) => b.classList.remove('active'))
  document
    .querySelector(`.sb-item[data-page="${name}"]`)
    ?.classList.add('active')
}

export function openPlayer() {
  $('now-playing')?.classList.add('open')
}
export function closePlayer() {
  document
    .querySelectorAll('.np-overlay')
    .forEach((p) => p.classList.remove('open'))
  $('now-playing')?.classList.remove('open')
}
export function openPanel(id) {
  document
    .querySelectorAll('.np-overlay')
    .forEach((p) => p.classList.remove('open'))
  $(id)?.classList.add('open')
}
export function closePanel(id) {
  $(id)?.classList.remove('open')
}

export function openMoreSheet(track) {
  const sheet = $('np-more-sheet')
  const preview = $('sheet-track-preview')
  if (!sheet) return
  if (preview && track) {
    preview.innerHTML = `
      <img src="${escHtml(track.coverSmall || track.cover || '')}" onerror="this.src=''" alt=""/>
      <div>
        <div class="bs-title">${escHtml(track.title)}</div>
        <div class="bs-artist">${escHtml(track.artist || '')}</div>
      </div>`
  }
  const sb = $('sheet-shuffle-state'),
    rb = $('sheet-repeat-state')
  const isShuffle = State.get('player.isShuffle') || false
  const isRepeat = State.get('player.isRepeat') || false
  if (sb) {
    sb.textContent = isShuffle ? 'On' : 'Off'
    sb.classList.toggle('on', isShuffle)
  }
  if (rb) {
    rb.textContent = isRepeat ? 'On' : 'Off'
    rb.classList.toggle('on', isRepeat)
  }
  sheet.classList.add('open')
}
export function closeMoreSheet() {
  $('np-more-sheet')?.classList.remove('open')
}

export function skeletons(n = 8) {
  return Array(n)
    .fill(0)
    .map(
      () => `
    <div class="skel-card">
      <div class="skeleton skel-thumb"></div>
      <div class="skel-lines">
        <div class="skeleton skel-line" style="width:${50 + Math.random() * 40}%"></div>
        <div class="skeleton skel-line-sm" style="width:${25 + Math.random() * 30}%"></div>
      </div>
    </div>`
    )
    .join('')
}

export function skeletonsGrid(n = 6) {
  return `<div class="skel-grid">${Array(n)
    .fill(0)
    .map(
      () => `
    <div>
      <div class="skel-square skeleton"></div>
      <div class="skeleton skel-bar" style="width:85%"></div>
      <div class="skeleton skel-bar-sm"></div>
    </div>`
    )
    .join('')}</div>`
}

function _setText(id, val) {
  const e = $(id)
  if (e) e.textContent = val
}
function _setSrc(id, src) {
  const e = $(id)
  if (e) e.src = src
}
function _setWidth(id, pct) {
  const e = $(id)
  if (e) e.style.width = pct + '%'
}
function _show(id, visible) {
  const e = $(id)
  if (e) e.style.display = visible ? 'inline-flex' : 'none'
}

export function emptyState(
  icon = 'bi-music-note-beamed',
  msg = 'Nothing here',
  sub = ''
) {
  return `<div class="empty">
    <i class="bi ${escHtml(icon)}"></i>
    <p>${escHtml(msg)}</p>
    ${sub ? `<small>${escHtml(sub)}</small>` : ''}
  </div>`
}

export function errorState(msg = 'Something went wrong', onRetry = null) {
  const retryId = onRetry ? `retry-${Date.now()}` : null
  if (retryId)
    setTimeout(
      () =>
        document.getElementById(retryId)?.addEventListener('click', onRetry),
      0
    )
  return `<div class="error-state">
    <i class="bi bi-wifi-off"></i>
    <p>${escHtml(msg)}</p>
    ${retryId ? `<button class="retry-btn" id="${retryId}">Try again</button>` : ''}
  </div>`
}

function _emptyState(msg, sub = '') {
  return emptyState('bi-music-note-beamed', msg, sub)
}
