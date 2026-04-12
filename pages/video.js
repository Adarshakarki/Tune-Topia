// Video
import { getTidalVideoStream } from '../api/index.js'
import * as UI from '../app/ui.js'
import { getVideoStream as getYTVideoStream } from '../api/index.js'
import * as Router from '../app/router.js'
import { toggle as toggleLike, isLiked } from './likedVideos.js'

const PAGE_ID = 'page-video'
const HLS_CDN = 'https://cdn.jsdelivr.net/npm/hls.js@latest'

let _hls = null
let _hideTimer = null
let _seeking = false
let _bound = false
let _current = null

const $ = (id) => document.getElementById(id)

function _pauseMusic() {
  import('../modules/player.js')
    .then(() => {
      const audio = document.getElementById('audio')
      if (audio && !audio.paused) audio.pause()
    })
    .catch(() => {})
}

function _ensurePage() {
  if (document.getElementById(PAGE_ID)) return
  const div = document.createElement('div')
  div.id = PAGE_ID
  div.innerHTML = `
    <div class="vp-wrap" id="vp-wrap">
      <div class="vp-header" id="vp-header">
        <button class="vp-back-btn" id="vp-back-btn">
          ${UI.getIcon('chevron-left')}
        </button>
        <div class="vp-header-info">
          <div class="vp-title" id="vp-title"></div>
          <div class="vp-artist" id="vp-artist"></div>
        </div>
        <div class="vp-source-badge" id="vp-source-badge"></div>
        <button class="vp-like-btn" id="vp-like-btn" title="Like video">
          <i id="vp-like-icon"></i>
        </button>
      </div>
      <div class="vp-video-wrap" id="vp-video-wrap">
        <video id="vp-video" playsinline preload="metadata"></video>
        <div class="vp-spinner" id="vp-spinner"><div class="vp-spin-ring"></div></div>
        <div class="vp-error" id="vp-error">
          ${UI.getIcon('error')}
          <span id="vp-error-msg">Could not load video</span>
        </div>
      </div>
      <div class="vp-center-controls" id="vp-center-controls">
        <button class="vp-ctrl-btn" id="vp-seek-back" title="-10s">
          ${UI.getIcon('refresh')}<span>10</span>
        </button>
        <button class="vp-play-btn" id="vp-play-btn">
          <i id="vp-play-icon"></i>
        </button>
        <button class="vp-ctrl-btn" id="vp-seek-fwd" title="+10s">
          ${UI.getIcon('refresh')}<span>10</span>
        </button>
      </div>
      <div class="vp-controls" id="vp-controls">
        <div class="vp-progress-wrap">
          <span class="vp-time" id="vp-current">0:00</span>
          <div class="vp-progress-bar" id="vp-progress-bar">
            <div class="vp-progress-fill" id="vp-progress-fill"></div>
          </div>
          <span class="vp-time vp-time-right" id="vp-duration">0:00</span>
        </div>
        <div class="vp-btn-row">
          <button class="vp-ctrl-btn vp-fs-btn" id="vp-fullscreen-btn">
            <i id="vp-fs-icon"></i>
          </button>
        </div>
      </div>
    </div>`
  document.body.appendChild(div)
}

function _loadHls() {
  return new Promise((res, rej) => {
    if (window.Hls) { res(); return }
    const s = document.createElement('script')
    s.src = HLS_CDN
    s.onload = res
    s.onerror = rej
    document.head.appendChild(s)
  })
}

export async function open(track) {
  _ensurePage()
  if (!_bound) {
    _bindControls()
    _bound = true
  }

  _current = track
  const video = $('vp-video')
  if (!video) return

  _destroyHls()
  video.src = ''

  $('vp-title').textContent = track.title || ''
  $('vp-artist').textContent = track.artist || ''
  $('vp-error')?.classList.remove('visible')
  $('vp-spinner')?.classList.remove('hidden')
  $('vp-controls')?.classList.remove('hidden')
  $('vp-header')?.classList.remove('hidden')
  if ($('vp-progress-fill')) $('vp-progress-fill').style.width = '0%'
  if ($('vp-current')) $('vp-current').textContent = '0:00'
  if ($('vp-duration')) $('vp-duration').textContent = '0:00'
  _setPlayIcon(false)
  _syncLikeBtn(track)

  const isTidal = track.source === 'tidal-video' || track.source === 'tidal'
  const badge = $('vp-source-badge')
  if (badge) {
    badge.textContent = isTidal ? 'Tidal' : 'YouTube'
    badge.className = 'vp-source-badge ' + (isTidal ? 'tidal' : 'yt')
  }

  const page = document.getElementById(PAGE_ID)
  if (page) {
    page.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: var(--z-fullscreen);
      background: #000;
      display: flex;
      flex-direction: column;
    `
  }

  try {
    const stream = isTidal
      ? await getTidalVideoStream(track.id)
      : await getYTVideoStream(track.id)

    if (stream.type === 'hls') await _playHls(video, stream)
    else {
      video.src = stream.url
      video.addEventListener('canplaythrough', () => video.play(), { once: true })
    }
  } catch (e) {
    $('vp-spinner')?.classList.add('hidden')
    $('vp-error')?.classList.add('visible')
    if ($('vp-error-msg')) $('vp-error-msg').textContent = e.message || 'Video unavailable'
  }

  $(PAGE_ID).style.display = 'flex'
}

export function close() {
  if ($(PAGE_ID)) $(PAGE_ID).style.display = 'none'
  const video = $('vp-video')
  if (video) {
    video.pause()
    _destroyHls()
    video.src = ''
  }
}

async function _playHls(video, stream) {
  await _loadHls()
  if (Hls.isSupported()) {
    _destroyHls()
    _hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      maxBufferLength: 60,
      maxMaxBufferLength: 120,
    })
    _hls.loadSource(stream.url)
    _hls.attachMedia(video)
    video.addEventListener('canplay', () => video.play(), { once: true })
    _hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) _hls.startLoad()
        else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) _hls.recoverMediaError()
      }
    })
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = stream.url
    video.addEventListener('canplaythrough', () => video.play(), { once: true })
  } else {
    throw new Error('HLS not supported in this browser')
  }
}

function _destroyHls() {
  if (_hls) {
    try { _hls.destroy() } catch {}
    _hls = null
  }
}

function _syncLikeBtn(track) {
  const btn = $('vp-like-btn')
  const icon = $('vp-like-icon')
  if (!btn || !icon) return
  const liked = isLiked(track.id)
  btn.classList.toggle('liked', liked)
  icon.innerHTML = UI.getIcon(liked ? 'heartFill' : 'heart');
}

function _bindControls() {
  const video = $('vp-video')

  $('vp-back-btn').addEventListener('click', () => {
    video.pause()
    _destroyHls()
    video.src = ''
    const page = document.getElementById(PAGE_ID)
    if (page) page.style.display = 'none'
    Router.goBack()
  })

  $('vp-like-btn').addEventListener('click', () => {
    if (!_current) return
    toggleLike(_current)
    _syncLikeBtn(_current)
  })

  $('vp-play-btn').addEventListener('click', () => {
    video.paused ? video.play() : video.pause()
  })

  $('vp-seek-back').addEventListener('click', () => {
    video.currentTime = Math.max(0, video.currentTime - 10)
  })

  $('vp-seek-fwd').addEventListener('click', () => {
    video.currentTime = Math.min(video.duration || 0, video.currentTime + 10)
  })

  $('vp-fullscreen-btn').addEventListener('click', () => {
    const wrap = $('vp-video-wrap')
    if (!document.fullscreenElement) wrap.requestFullscreen?.()
    else document.exitFullscreen?.()
  })

  document.addEventListener('fullscreenchange', () => {
    const icon = $('vp-fs-icon')
    if (icon) icon.innerHTML = UI.getIcon(document.fullscreenElement ? 'close' : 'external');
  })

  const bar = $('vp-progress-bar')
  const _seekTo = (clientX) => {
    if (!video.duration) return
    const r = bar.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    video.currentTime = pct * video.duration
  }

  bar.addEventListener('mousedown', (e) => { _seeking = true; _seekTo(e.clientX) })
  bar.addEventListener('touchstart', (e) => { _seeking = true; _seekTo(e.touches[0].clientX) }, { passive: true })
  document.addEventListener('mousemove', (e) => { if (_seeking) _seekTo(e.clientX) })
  document.addEventListener('touchmove', (e) => { if (_seeking) _seekTo(e.touches[0].clientX) }, { passive: true })
  document.addEventListener('mouseup', () => { _seeking = false })
  document.addEventListener('touchend', () => { _seeking = false })

  const _showCtrls = () => {
    $('vp-controls')?.classList.remove('hidden')
    $('vp-center-controls')?.classList.remove('hidden')
    $('vp-header')?.classList.remove('hidden')
    clearTimeout(_hideTimer)
    if (!video.paused) {
      _hideTimer = setTimeout(() => {
        $('vp-controls')?.classList.add('hidden')
        $('vp-center-controls')?.classList.add('hidden')
        $('vp-header')?.classList.add('hidden')
      }, 3500)
    }
  }

  $('vp-wrap')?.addEventListener('mousemove', _showCtrls)
  $('vp-wrap')?.addEventListener('touchstart', _showCtrls, { passive: true })
  $('vp-video-wrap')?.addEventListener('click', () => {
    _showCtrls()
    video.paused ? video.play() : video.pause()
  })

  video.addEventListener('play', () => { _setPlayIcon(true); _showCtrls(); _pauseMusic() })
  video.addEventListener('pause', () => { _setPlayIcon(false); _showCtrls() })
  video.addEventListener('waiting', () => $('vp-spinner')?.classList.remove('hidden'))
  video.addEventListener('playing', () => $('vp-spinner')?.classList.add('hidden'))
  video.addEventListener('canplay', () => $('vp-spinner')?.classList.add('hidden'))
  video.addEventListener('loadedmetadata', () => {
    if ($('vp-duration')) $('vp-duration').textContent = _fmt(video.duration)
    $('vp-spinner')?.classList.add('hidden')
  })
  video.addEventListener('timeupdate', () => {
    if (!video.duration || _seeking) return
    const pct = (video.currentTime / video.duration) * 100
    if ($('vp-progress-fill')) $('vp-progress-fill').style.width = pct + '%'
    if ($('vp-current')) $('vp-current').textContent = _fmt(video.currentTime)
  })
  video.addEventListener('error', () => {
    if (_hls) return
    if (!video.src || video.src === window.location.href) return
    $('vp-spinner')?.classList.add('hidden')
    $('vp-error')?.classList.add('visible')
    if ($('vp-error-msg')) $('vp-error-msg').textContent = 'Playback error'
  })
}

function _setPlayIcon(playing) {
  const icon = $('vp-play-icon')
  if (icon) icon.innerHTML = UI.getIcon(playing ? 'pause' : 'play');
}

function _fmt(s) {
  if (!s || isNaN(s)) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}