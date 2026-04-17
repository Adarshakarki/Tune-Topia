// UI
import State from './state.js'
import { has as isLiked } from '../modules/likedSongs.js'
import { escHtml, fmtTime, qualityBadge } from '../api/utils.js'
import Queue from '../modules/queue.js'
import { getActiveLine, getActiveWord } from '../modules/lyrics.js';
import { getIcon, replaceHtmlIcons, _isAtmos } from './icons.js';

const $ = (id) => document.getElementById(id)
let _npColor = null
const _colorCache = new Map();
const _fanartCache = new Map();

export { getIcon, replaceHtmlIcons };

// Toast
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
  revertThemeColor()
}

export function renderGreeting() {
  const h = new Date().getHours()
  const greet =
    h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const el = $('home-greeting')
  if (el) el.textContent = `${greet}, ${State.get('user.name') || 'Friend'}`
}

// Colors
export function extractColor(src, cb) {
  if (_colorCache.has(src)) return cb(..._colorCache.get(src));

  const proxied = `https://wsrv.nl/?url=${encodeURIComponent(src)}&w=80&h=80&fit=cover&output=jpg`
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    try {
      const c = document.createElement('canvas')
      c.width = c.height = 80
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0, 80, 80)
      _pickColor(ctx.getImageData(0, 0, 80, 80).data, (r, g, b) => {
        _colorCache.set(src, [r, g, b]);
        cb(r, g, b);
      })
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
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    if (a < 128) continue
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    const sat = max - min, lum = (max + min) / 2
    if (lum > 245 || lum < 15 || sat < 15) continue
    const key = `${r >> 4},${g >> 4},${b >> 4}`
    if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, n: 0, s: 0 }
    buckets[key].r += r
    buckets[key].g += g
    buckets[key].b += b
    buckets[key].n++
    buckets[key].s += sat
  }
  let best = null, maxScore = 0
  for (const v of Object.values(buckets)) {
    const score = v.n * (1 + (v.s / v.n) / 255)
    if (score > maxScore) { maxScore = score; best = v; }
  }
  if (!best) return cb(30, 30, 40)
  let r = Math.round(best.r / best.n), g = Math.round(best.g / best.n), b = Math.round(best.b / best.n)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  if (lum > 215) {
    r = Math.round(r * 0.85); g = Math.round(g * 0.85); b = Math.round(b * 0.85)
  } else if (lum < 40) {
    r = Math.min(255, (r * 1.2 + 20) | 0); g = Math.min(255, (g * 1.2 + 20) | 0); b = Math.min(255, (b * 1.2 + 20) | 0)
  }
  cb(r, g, b)
}

export function renderHero(track) {
  const el = $('hero-card')
  if (!el || !track) return
  el.innerHTML = `
    <div class="hero-inner" style="position: relative; overflow: hidden; display: flex; align-items: flex-end; padding: var(--s6);">
      <img src="${escHtml(track.cover)}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;" fetchpriority="high" loading="eager" alt="" />
      <div style="position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, transparent 100%); z-index: 1;"></div>
      <div class="hero-info" style="position: relative; z-index: 2; flex: 1;">
        <span class="hero-label">Featured</span>
        <div class="hero-title">${escHtml(track.title)}${track.explicit ? ` <span class="explicit-tag" style="font-size:14px; opacity:0.8">${getIcon('explicit')}</span>` : ''}</div>
        <div class="hero-artist">${escHtml(track.artist || '')}</div>
      </div>
      <button class="hero-play" data-hero-play style="position: absolute; right: var(--s6); bottom: var(--s6); z-index: 3;">${getIcon('play')}</button>
    </div>`
  el._track = track
}

export function renderHorizCards(tracks, container, type = 'standard') {
  if (!container) return
  const isVideo = type === 'video';
  container.innerHTML = tracks.slice(0, 15).map((t, i) => `
    <div class="horiz-card${isVideo ? ' video-card' : ''}" data-index="${i}">
      <div class="${isVideo ? 'horiz-video-wrap' : 'horiz-art-wrap'}">
        <img class="horiz-art" src="${escHtml(t.thumbnail || t.cover || t.coverSmall || '')}" onerror="this.src=''" alt="" loading="lazy"/>
        ${isVideo && t.dur ? `<span class="horiz-dur">${escHtml(t.dur)}</span>` : ''}
        ${isVideo ? `<div class="horiz-video-play">${getIcon('play')}</div>` : ''}
      </div>
      <div class="horiz-title">${escHtml(t.title || t.name || '')}${t.explicit ? ` <span class="explicit-tag-mini" style="font-size:10px; opacity:0.7">${getIcon('explicit')}</span>` : ''}</div>
      <div class="horiz-artist">${escHtml(t.channel || t.artist || '')}</div>
    </div>`).join('');
  container._tracks = tracks
}

export function renderTopResult(track, container) {
  if (!container || !track) return
  const b = qualityBadge(track)
  const isAtmos = _isAtmos(track)
  container.innerHTML = `
    <div class="top-result-card" data-id="${escHtml(track.id)}">
      <img src="${escHtml(track.cover || '')}" onerror="this.src=''" alt=""/>
      <div class="top-result-info">
        <span class="top-result-label">Top Result</span>
        <div class="top-result-title">${escHtml(track.title)}${track.explicit ? ` <span class="explicit-tag" style="margin-left:6px; opacity:0.8">${getIcon('explicit')}</span>` : ''}</div>
        <div class="top-result-meta">${escHtml(track.artist || '')}</div>
        <div class="top-result-badges" style="display:flex; gap:4px; align-items:center; margin-top:4px">
          ${b ? `<span class="quality-badge ${b.cls}">${b.label}</span>` : ''}
          ${isAtmos ? `<span class="atmos-badge" title="Dolby Atmos" style="color:var(--text-2); font-size:14px">${getIcon('atmos')}</span>` : ''}
        </div>
      </div>
      <button class="top-result-play">${getIcon('play')}</button>
    </div>`
}

export function renderTrackItemHTML(t, i, currentId) {
  if (!t) return '';
  const badge = qualityBadge(t)
  const active = t.id === currentId
  const isAtmos = _isAtmos(t)
  const isVideo = t.source === 'youtube'
  return `
    <div data-index="${i}" data-tid="${escHtml(t.id)}">
      <div class="track-card${active ? ' playing' : ''}">
        <img class="${isVideo ? 'track-thumb-video' : 'track-thumb'}"
             src="${escHtml(t.coverSmall || t.cover || '')}" onerror="this.src=''" alt=""/>
        <div class="track-info">
          <div class="track-name-row">
            <div class="track-name${active ? ' playing' : ''}">${escHtml(t.title)}</div>
            ${t.explicit ? `<span class="explicit-tag">${getIcon('explicit')}</span>` : ''}
            ${isAtmos ? `<span class="atmos-badge" title="Dolby Atmos" style="opacity:0.8; font-size:12px; margin-left:2px">${getIcon('atmos')}</span>` : ''}
            ${badge ? `<span class="quality-badge ${badge.cls}">${badge.label}</span>` : ''}
          </div>
          <div class="track-meta">${escHtml(t.artist || '')}${t.album ? ` · ${escHtml(t.album)}` : ''}</div>
        </div>
        <div class="track-right">
          ${active ? `<div class="eq-bars"><div class="eq-bar"></div><div class="eq-bar"></div><div class="eq-bar"></div></div>` : ''}
          <button class="track-more-btn">${getIcon('more')}</button>
        </div>
      </div>
    </div>`
}

export function renderTracks(tracks, container, currentId) {
  if (!tracks || !tracks.length) return container.innerHTML = emptyState('music', 'No results found', 'Try a different search');
  container.innerHTML = tracks.map((t, i) => renderTrackItemHTML(t, i, currentId)).join('')
  container._tracks = tracks
}

export function renderTrackList(tracks, container, currentId) {
  if (!tracks || !tracks.length)
    return (container.innerHTML = emptyState('music', 'No tracks'))
  container.innerHTML = tracks
    .map((t, i) => {
      const active = t.id === currentId
      const isAtmos = _isAtmos(t)
      return `
      <div data-index="${i}" data-tid="${escHtml(t.id)}">
        <div class="list-track${active ? ' playing' : ''}">
          <span class="list-track-num">${i + 1}</span>
          <div class="list-track-title-wrap">
            <img class="list-track-art" src="${escHtml(t.coverSmall || t.cover || '')}" onerror="this.src=''" alt="" loading="lazy"/>
            <div class="list-track-info">
              <div class="list-track-title${active ? ' playing' : ''}">${escHtml(t.title)}${t.explicit ? ` <span class="explicit-tag">${getIcon('explicit')}</span>` : ''}${isAtmos ? ` <span class="atmos-icon-mini" style="opacity:0.7;margin-left:4px">${getIcon('atmos')}</span>` : ''}</div>
              <div class="list-track-artist">${escHtml(t.artist || '')}</div>
            </div>
          </div>
          <div class="list-track-album">${escHtml(t.album || '—')}</div>
          <div class="list-track-actions"><button class="track-like-btn" data-tid="${t.id}">${getIcon('heart')}</button></div>
          <div class="list-track-end">
            <span class="list-track-dur">${t.dur || ''}</span>
            <button class="track-more-btn">${getIcon('more')}</button>
          </div>
        </div>
      </div>`
    })
    .join('')
  container._tracks = tracks
}

export async function virtualizeTracks(tracks, container, currentId) {
  if (!tracks || !tracks.length) return container.innerHTML = emptyState('music', 'No tracks');
  container._tracks = tracks;
  const { Virtualizer } = await import('../modules/virtualizer.js');
  return new Virtualizer({
    container,
    items: tracks,
    itemHeight: 64, // Standard height for track-card rows
    renderItem: (t, i) => renderTrackItemHTML(t, i, currentId)
  });
}

export function renderAlbums(albums, container) {
  if (!albums || !albums.length) {
    container.innerHTML = _emptyState('No albums found');
    return;
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
  if (!artists || !artists.length) {
    container.innerHTML = _emptyState('No artists found');
    return;
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
  let priority = [], incoming = [];
  if (upcoming && typeof upcoming === 'object' && !Array.isArray(upcoming)) {
    priority = upcoming.priority || [];
    incoming = upcoming.incoming || [];
  } else {
    const flat = upcoming || tracks.slice(position + 1);
    const offset = State.get('queue.priorityOffset') || 0;
    priority = flat.slice(0, offset);
    incoming = flat.slice(offset);
  }

  let html = ''
  if (current) {
    html +=
      `<div class="queue-section-label">Now Playing</div>` +
      _queueItem(current, position, true);
  }

  const isShuff = State.get('player.isShuffle'), isRep = State.get('player.isRepeat');
  html += `
    <div class="q-stack-actions">
      <button class="q-stack-btn${isShuff ? ' active' : ''}" id="q-shuffle-btn" title="Shuffle">${getIcon('shuffle')}</button>
      <button class="q-stack-btn${isRep ? ' active' : ''}" id="q-repeat-btn" title="Repeat">${getIcon('repeat')}</button>
      <button class="q-stack-btn" id="q-add-pl-btn" title="Add to Playlist">${getIcon('plus')}</button>
      <button class="q-stack-btn" id="q-sleep-btn" title="Sleep Timer">${getIcon('moon')}</button>
    </div>
  `;

  if (priority.length) {
    html +=
      `<div class="queue-section-label">Up Next</div>` +
      priority.map((t, i) => _queueItem(t, position + 1 + i, false)).join('')
  }

  if (incoming.length) {
    html +=
      `<div class="queue-section-label">Incoming</div>` +
      incoming.map((t, i) => _queueItem(t, position + 1 + priority.length + i, false)).join('')
  }

  if (!current && !priority.length && !incoming.length)
    html = `<div class="npq-empty">${getIcon('queue')}<p>Queue is empty</p></div>`
  list.innerHTML = html
}

function _queueItem(t, index, isActive) {
  const isAtmos = _isAtmos(t);
  return `
    <div class="npq-item${isActive ? ' active' : ''}" data-index="${index}">
      <img class="npq-art" src="${escHtml(t.coverSmall || t.cover || '')}" onerror="this.src=''" alt=""/>
      <div class="npq-info">
        <div class="npq-title${isActive ? ' active' : ''}">${escHtml(t.title)}${t.explicit ? ` <span class="explicit-tag-mini" style="opacity:0.7;font-size:10px;margin-left:4px;display:inline-flex">${getIcon('explicit')}</span>` : ''}${isAtmos ? ` <span class="atmos-badge-q" style="opacity:0.7;font-size:10px;margin-left:4px">${getIcon('atmos')}</span>` : ''}</div>
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
  
  body.innerHTML = `<div class="np-lyrics-placeholder">${getIcon('chat')}<p>Lyrics not available</p></div>`
}

export function updateActiveLyric(syncedLyrics, currentTime) {
  const body = $('np-lyrics-body')
  if (!body || !syncedLyrics?.length) return

  const activeIndex = getActiveLine(syncedLyrics, currentTime)
  const lines = body.querySelectorAll('.np-lyrics-line')

  lines.forEach((el, i) => {
    const isActive = i === activeIndex
    el.classList.toggle('active', isActive)

    if (isActive) {
      const lineData = syncedLyrics[i]
      if (lineData.words) {
        const activeWordIndex = getActiveWord(lineData, currentTime)
        const words = el.querySelectorAll('.np-lyric-word')
        words.forEach((wordEl, wIdx) => {
          wordEl.classList.toggle('passed', wIdx <= activeWordIndex);
          wordEl.classList.toggle('current', wIdx === activeWordIndex);
        });
      }
    }
  })

  const activeEl = body.querySelector('.np-lyrics-line.active')
  if (activeEl) {
    activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

export function updatePlayerPosition() {
  const container = document.querySelector('.bottom-nav-container');
  const active = document.querySelector('.sub-page.open') || document.querySelector('.page.active');
  if (!container || !active) return;

  requestAnimationFrame(() => {
    const h = container.offsetHeight;
    const pad = h > 0 ? `${h}px` : '';

    // Clear all existing paddings first
    document.querySelectorAll('.sub-page, .page, #main-content, [id$="-scroll"]').forEach(el => el.style.paddingBottom = '');

    // The specific scroll container inside the subpage OR the page itself
    const scroll = active.querySelector('[id$="-scroll"]') || active;
    if (scroll) scroll.style.paddingBottom = pad;

    // If it's a main page (like Home), the padding needs to push content within the main scroller
    if (active.classList.contains('page') && !active.querySelector('[id$="-scroll"]')) {
      const main = $('main-content');
      if (main) main.style.paddingBottom = pad;
    }
  });
}

export function setTrackInfo(track) {
  if (!track) return
  const art = track.cover || track.coverSmall || ''

  const pb = $('player-bar');
  if (pb) pb.classList.add('has-track');
  updatePlayerPosition();

  _setSrc('bar-art', art)
  _setText('bar-artist', track.artist || '—')

  const expColor = 'rgba(255,255,255,0.85)';

  const barTitle = $('bar-title')
  if (barTitle) {
    barTitle.style.display = 'flex';
    barTitle.style.alignItems = 'center';
    barTitle.style.gap = '6px';
    barTitle.style.minWidth = '0';
    barTitle.innerHTML =
      (track.title || '—') +
      (track.explicit ? ` <span class="explicit-tag-mini" style="color:${expColor}; opacity:0.8; font-size:13px; display:inline-flex; flex-shrink:0">${getIcon('explicit')}</span>`
        : '') +
      (_isAtmos(track) ? ` <span class="atmos-badge-mini" style="margin-left:4px;opacity:0.8;font-size:13px; flex-shrink:0">${getIcon('atmos')}</span>` : '')
  }

  ;['np-bg-art', 'np-artwork-img', 'np-desktop-art'].forEach((id) =>
    _setSrc(id, art)
  )

  const npTitle = $('np-title');
  if (npTitle) {
    npTitle.innerHTML = escHtml(track.title || '—') + 
      (_isAtmos(track) ? ` <span class="atmos-badge-np" style="font-size:16px;vertical-align:middle;margin-left:8px;opacity:0.9">${getIcon('atmos')}</span>` : '');
  }

  _setText('np-artist', track.artist || '—')
  _setText('np-topbar-title', track.title || '')
  _show('np-explicit-tag', track.explicit || false)
  _setText('np-lyrics-track-name', track.title || '')
  _setText('np-lyrics-track-artist', track.artist || '')
  _setText('np-queue-track-name', track.title || '')

  const npExplicitTag = $('np-explicit-tag');
  if (npExplicitTag && track.explicit) {
    npExplicitTag.innerHTML = getIcon('explicit');
    npExplicitTag.style.cssText = `
      display:inline-flex !important; color:#fff; opacity:0.8; font-size:16px; flex-shrink:0;
    `;
  } else if (npExplicitTag) {
    npExplicitTag.style.cssText = '';
  }
  syncLikeButtons(track.id)

  // Fanart
  if (track.artist) {
    const artistName = track.artist.split(',')[0].trim();
    const bgArt = $('np-bg-art');

    if (_fanartCache.has(artistName)) {
      if (bgArt) bgArt.src = _fanartCache.get(artistName);
      return;
    }

    const q = encodeURIComponent(artistName)
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
        const selectedArt = fanarts.length ? fanarts[Math.floor(Math.random() * fanarts.length)] : art || '';
        _fanartCache.set(artistName, selectedArt);
        if (bgArt) bgArt.src = selectedArt
      })
      .catch(() => {
        if (bgArt) bgArt.src = art || ''
      })
  }

  // Background
  if (art) {
    extractColor(art, (r, g, b) => {
      const dr = Math.round(r * 0.8), dg = Math.round(g * 0.8), db = Math.round(b * 0.8)
      const base = `rgba(${r},${g},${b},0.95)`,
        dark = `${dr},${dg},${db}`

      const bg = $('player-bar-bg')
      if (bg) {
        bg.style.background = `linear-gradient(135deg, ${base}, rgb(${dark}))`
        bg.style.opacity = '1'
      }

      const bar = $('player-bar');
      if (bar) {
        bar.style.setProperty('--text', '#ffffff', 'important');
        bar.style.setProperty('--text-2', 'rgba(255,255,255,0.7)', 'important');
        bar.style.setProperty('--text-3', 'rgba(255,255,255,0.5)', 'important');
        bar.style.setProperty('--accent', '#ffffff', 'important');
        bar.style.outline = 'none';
        bar.style.webkitTapHighlightColor = 'transparent';
      }

      const darkCol = `rgb(${dark})`
      _npColor = darkCol
      $('now-playing')?.style.setProperty('--np-color', darkCol)
      $('now-playing')?.style.setProperty('background', darkCol)
      $('np-controls-col')?.style.setProperty('background', darkCol)
      $('np-lyrics-panel')?.style.setProperty('background', darkCol)
      $('np-queue-panel')?.style.setProperty('background', darkCol)

      if ($('now-playing')?.classList.contains('open')) {
        document.getElementById('theme-color-meta')?.setAttribute('content', darkCol)
      }
    })
  } else {
    const bar = $('player-bar');
    if (bar) {
      bar.style.removeProperty('--text');
      bar.style.removeProperty('--text-2');
      bar.style.removeProperty('--text-3');
      bar.style.removeProperty('--accent');
    }

    _npColor = null;
    const bg = $('player-bar-bg');
    if (bg) {
      bg.style.background = 'transparent';
      bg.style.opacity = '0';
    }
    const np = $('now-playing');
    if (np) {
      np.style.removeProperty('--np-color');
      np.style.background = '';
    }
    revertThemeColor()
  }
}

export function setPlayState(playing) {
  const iconHtml = playing ? getIcon('pause') : getIcon('play');
  ['mini-play-icon', 'bar-play-icon', 'np-play-icon', 'np-lyrics-play-icon', 'np-queue-play-icon'].forEach(id => {
    const el = $(id); if (el) el.innerHTML = iconHtml;
  });
  $('now-playing')?.classList.toggle('paused', !playing)
}

export function updateProgress(pct, cur, dur) {
  const fills = [
    'bar-progress-mobile-fill',
    'bar-progress-fill',
    'np-progress-fill',
    'np-lyrics-mini-fill',
    'np-queue-mini-fill',
  ];
  
  fills.forEach(id => _setWidth(id, pct));

  const s = Math.floor(cur);
  if (window._lastPs === s) return;
  window._lastPs = s;

  const curStr = fmtTime(cur), totStr = fmtTime(dur);
  _setText('bar-time-cur', curStr);
  _setText('bar-time-tot', totStr);
  _setText('np-time-cur', curStr);
  _setText('np-time-tot', totStr);
}

export function updateVolume(v) {
  _setWidth('vol-fill', v * 100)
  _setWidth('bar-vol-fill', v * 100)
}

export function setShuffle(on) {
  const tracks = State.get('queue.tracks') || [];
  const position = State.get('player.queuePosition') || 0;
  renderQueue(tracks, position, Queue.getUpcoming());
}

export function setRepeat(on) {
  const tracks = State.get('queue.tracks') || [];
  const position = State.get('player.queuePosition') || 0;
  renderQueue(tracks, position, Queue.getUpcoming());
}

export function syncLikeButtons(trackId) {
  const liked = isLiked(trackId), svg = liked ? getIcon('heartFill') : getIcon('heart');
  document.querySelectorAll(`.track-like-btn[data-tid="${trackId}"]`).forEach(btn => {
    btn.classList.toggle('liked', liked);
    btn.innerHTML = svg;
  });
  [$('bar-like-btn'), $('np-love-btn'), $('tsheet-preview-like'), $('np-sheet-preview-like')].forEach(btn => {
    if (btn) { btn.classList.toggle('liked', liked); btn.innerHTML = svg; }
  });
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

export function revertThemeColor() {
  const meta = document.getElementById('theme-color-meta')
  if (!meta) return
  if (_npColor && $('now-playing')?.classList.contains('open')) {
    meta.setAttribute('content', _npColor)
    return
  }
  
  const skin = document.documentElement.getAttribute('data-skin') || 'default';
  const mode = document.documentElement.getAttribute('data-theme') || 'light';

  const themeShades = {
    'default':    { light: '#F5F0E8', dark: '#0E0C0A' },
    'monochrome': { light: '#F5F0E8', dark: '#1A1A1A' },
    'midnight':   { light: '#E8F0F8', dark: '#0E0C0A' },
    'purple':     { light: '#F3E8FF', dark: '#2D1B4E' },
    'emerald':    { light: '#D1FAE5', dark: '#064E3B' },
    'pink':       { light: '#FCE7F3', dark: '#831843' },
    'lavender':   { light: '#EDE9F7', dark: '#373052' },
    'nordic':     { light: '#E5E9F0', dark: '#242933' },
    'ember':      { light: '#FFEDD5', dark: '#050505' },
    'cyberpunk':  { light: '#FCE7F3', dark: '#050112' },
    'rose-pine':  { light: '#FFFAF3', dark: '#1F1D2E' },
  };

  const shades = themeShades[skin] || themeShades['default'];
  meta.setAttribute('content', shades[mode] || shades.light);
}
 
export function closePlayer() {
  document
    .querySelectorAll('.np-overlay')
    .forEach((p) => p.classList.remove('open'))
  $('now-playing')?.classList.remove('open')
  revertThemeColor()
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

export function closeAllOverlays() {
  $('now-playing')?.classList.remove('open');
  document.querySelectorAll('.np-overlay').forEach(p => p.classList.remove('open'));
  const subpages = ['page-album', 'page-artist', 'page-playlist', 'page-mix', 'page-genre', 'page-user-playlist', 'page-liked-videos'];
  subpages.forEach(id => $(id)?.classList.remove('open', 'stacked'));
  document.querySelectorAll('.bottom-sheet, .bottom-sheet-global, #track-options-sheet, #playlist-picker-sheet, #np-more-sheet, #profile-popup-sheet, #sleep-timer-popup, #np-queue-item-sheet')
    .forEach(el => el.classList.remove('open'));
  if ($('playlist-modal-overlay')) $('playlist-modal-overlay').style.display = 'none';
  revertThemeColor();
  updatePlayerPosition();
}

export function openMoreSheet(track) {
  const sheet = $('np-more-sheet')
  const preview = $('sheet-track-preview')
  if (sheet) sheet.style.zIndex = '2500';
  if (!sheet) return
  if (preview && track) {
    const liked = isLiked(track.id);
    preview.innerHTML = `
      <img src="${escHtml(track.coverSmall || track.cover || '')}" onerror="this.src=''" alt=""/>
      <div class="bs-info" style="flex: 1">
        <div class="bs-title">${escHtml(track.title)}${track.explicit ? ` <span class="explicit-tag-mini" style="font-size:12px; opacity:0.7; margin-left:4px">${getIcon('explicit')}</span>` : ''}</div>
        <div class="bs-artist">${escHtml(track.artist || '')}</div>
      </div>
      <button class="bs-preview-like" id="np-sheet-preview-like">${getIcon(liked ? 'heartFill' : 'heart')}</button>`;
    
    const actions = sheet.querySelector('.sheet-actions');
    if (actions) {
      if (!actions.querySelector('[data-action="radio"]')) {
        const btn = document.createElement('button');
        btn.className = 'sheet-item';
        btn.setAttribute('data-action', 'radio');
        btn.innerHTML = `${getIcon('infinite')} <span>Start Radio</span>`;
        actions.prepend(btn);
      }
      if (!actions.querySelector('[data-action="mix"]')) {
        const btn = document.createElement('button');
        btn.className = 'sheet-item';
        btn.setAttribute('data-action', 'mix');
        btn.innerHTML = `${getIcon('stars')} <span>Go to Mix</span>`;
        actions.appendChild(btn);
      }
    }
    sheet._currentTrack = track;
  }
  sheet.classList.add('open')
}
export function closeMoreSheet() {
  $('np-more-sheet')?.classList.remove('open')
}

export function skeletons(n = 8, type = 'list') {
  const isHoriz = type === 'horiz' || type === 'video';
  const isVideo = type === 'video';
  return Array(n).fill(0).map(() => isHoriz ? `
    <div class="horiz-card ${isVideo ? 'video-card' : ''}">
      <div class="${isVideo ? 'horiz-video-wrap' : 'horiz-art'} skeleton" style="background:var(--surface-3); border-radius:var(--r-md)"></div>
      <div class="skeleton" style="height:12px; width:80%; margin-top:10px; border-radius:4px"></div>
      <div class="skeleton" style="height:10px; width:50%; margin-top:6px; border-radius:4px; opacity:0.6"></div>
    </div>` : `
    <div class="skel-card">
      <div class="skeleton skel-thumb"></div>
      <div class="skel-lines">
        <div class="skeleton skel-line" style="width:${50 + Math.random() * 40}%"></div>
        <div class="skeleton skel-line-sm" style="width:${25 + Math.random() * 30}%"></div>
      </div>
    </div>`).join('');
}

export function renderHeroSkeleton() {
  const el = $('hero-card');
  if (el) el.innerHTML = `
    <div class="hero-inner skeleton" style="background:var(--surface-2); border-radius:var(--r-lg); display:flex; align-items:flex-end; padding:var(--s6); height:200px">
      <div style="width:100%"><div class="skeleton" style="height:24px; width:60%; margin-bottom:12px; border-radius:6px"></div><div class="skeleton" style="height:16px; width:40%; border-radius:4px"></div></div>
    </div>`;
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

export function emptyState(icon = 'music', msg = 'Nothing here', sub = '') {
  return `<div class="empty">
    ${getIcon(icon)}
    <p>${escHtml(msg)}</p>
    ${sub ? `<small>${escHtml(sub)}</small>` : ''}
  </div>`
}

export function errorState(msg = 'Something went wrong', onRetry = null) {
  const id = onRetry ? `retry-${Date.now()}` : null;
  if (id) setTimeout(() => $(id)?.addEventListener('click', onRetry), 0);
  return `<div class="error-state">
    ${getIcon('error')}
    <p>${escHtml(msg)}</p>
    ${id ? `<button class="retry-btn" id="${id}">Try again</button>` : ''}
  </div>`
}

function _emptyState(msg, sub = '') {
  return emptyState('music', msg, sub)
}
