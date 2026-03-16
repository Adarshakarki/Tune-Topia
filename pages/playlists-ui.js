import * as UI from '../app/ui.js'
import * as Playlists from '../modules/playlists.js'
import { escHtml } from '../api/utils.js'
import * as UserPlaylistPage from './userplaylist.js'
import * as LibraryPage from './library.js'

const $ = (id) => document.getElementById(id)
let _pickerTrack = null
let _editingId = null

export function renderPage() {
  const el = $('playlists-grid')
  if (!el) return
  const all = Playlists.getAll()
  if (!all.length) {
    el.innerHTML = `<div class="empty"><i class="bi bi-collection"></i><p>No playlists yet</p><small>Tap + to create your first playlist</small></div>`
    return
  }
  el.innerHTML = `<div class="pl-page-grid">${all
    .map(
      (pl) => `
    <div class="pl-page-card" data-pl-id="${pl.id}">
      <div class="pl-page-art" style="${pl.cover ? `background-image:url(${pl.cover});background-size:cover;background-position:center` : 'background:linear-gradient(135deg,#5b21b6,#7c3aed)'}">
        ${pl.cover ? '' : '<i class="bi bi-music-note-list"></i>'}
        <button class="lib-pl-delete pl-page-delete" data-pl-id="${pl.id}" title="Delete"><i class="bi bi-trash"></i></button>
      </div>
      <div class="pl-page-info">
        <span class="pl-page-name">${escHtml(pl.name)}</span>
        <span class="pl-page-sub">${pl.tracks.length} song${pl.tracks.length !== 1 ? 's' : ''}</span>
      </div>
    </div>`
    )
    .join('')}</div>`

  el.querySelectorAll('.pl-page-card').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.pl-page-delete')) return
      const pl = Playlists.get(item.dataset.plId)
      if (pl) UserPlaylistPage.open(pl.id)
    })
  })
  el.querySelectorAll('.lib-pl-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const pl = Playlists.get(btn.dataset.plId)
      if (!pl) return
      if (!confirm(`Delete "${pl.name}"?`)) return
      Playlists.deletePlaylist(pl.id)
      renderPage()
      LibraryPage.render()
      UI.toast('Playlist deleted')
    })
  })
}

export function openCreateModal() {
  _editingId = null
  $('pl-modal-name-input').value = ''
  $('pl-modal-desc-input').value = ''
  $('pl-modal-cover-input').value = ''
  _updateModalCover('')
  const title = $('pl-modal-title')
  const btn = $('pl-modal-create')
  if (title) title.textContent = 'New Playlist'
  if (btn) btn.textContent = 'Create'
  $('playlist-modal-overlay').style.display = 'flex'
  setTimeout(() => $('pl-modal-name-input')?.focus(), 80)
}

export function openEditModal(playlistId) {
  const pl = Playlists.get(playlistId)
  if (!pl) return
  _editingId = playlistId
  $('pl-modal-name-input').value = pl.name || ''
  $('pl-modal-desc-input').value = pl.description || ''
  $('pl-modal-cover-input').value = pl.cover || ''
  _updateModalCover(pl.cover || '')
  const title = $('pl-modal-title')
  const btn = $('pl-modal-create')
  if (title) title.textContent = 'Edit Playlist'
  if (btn) btn.textContent = 'Save'
  $('playlist-modal-overlay').style.display = 'flex'
  setTimeout(() => $('pl-modal-name-input')?.focus(), 80)
}

export function closeCreateModal() {
  $('playlist-modal-overlay').style.display = 'none'
}

function _updateModalCover(url) {
  const el = $('pl-modal-cover-preview')
  if (!el) return
  if (url) {
    el.style.backgroundImage = `url(${url})`
    el.style.backgroundSize = 'cover'
    el.innerHTML = ''
  } else {
    el.style.backgroundImage = ''
    el.innerHTML = '<i class="bi bi-music-note-list"></i>'
  }
}

function _createPlaylist() {
  const name = $('pl-modal-name-input')?.value.trim()
  if (!name) {
    $('pl-modal-name-input')?.focus()
    return
  }
  const desc = $('pl-modal-desc-input')?.value.trim() || ''
  const cover = $('pl-modal-cover-input')?.value.trim() || ''
  if (_editingId) {
    Playlists.update(_editingId, { name, description: desc, cover })
    // Refresh the open userplaylist page in-place if it's the one being edited
    window._uplRefresh?.(_editingId)
    closeCreateModal()
    renderPage()
    LibraryPage.render()
    UI.toast(`✓ "${name}" updated`)
  } else {
    Playlists.create({ name, description: desc, cover })
    closeCreateModal()
    renderPage()
    LibraryPage.render()
    UI.toast(`✓ "${name}" created`)
  }
  _editingId = null
}

export function openPicker(track) {
  _pickerTrack = track
  const listEl = $('playlist-picker-list')
  if (!listEl) return
  const all = Playlists.getAll()
  if (!all.length) {
    listEl.innerHTML = `<div class="pl-picker-empty">No playlists yet</div>`
  } else {
    listEl.innerHTML = all
      .map(
        (pl) => `
      <button class="sheet-action pl-picker-item" data-pl-id="${pl.id}">
        <div class="pl-picker-cover" style="${pl.cover ? `background-image:url(${pl.cover});background-size:cover` : 'background:linear-gradient(135deg,#6d28d9,#4f46e5)'}">
          ${pl.cover ? '' : '<i class="bi bi-music-note-list"></i>'}
        </div>
        <div class="pl-picker-info">
          <span class="pl-picker-name">${escHtml(pl.name)}</span>
          <span class="pl-picker-sub">${pl.tracks.length} song${pl.tracks.length !== 1 ? 's' : ''}</span>
        </div>
      </button>`
      )
      .join('')
    listEl.querySelectorAll('.pl-picker-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!_pickerTrack) return
        Playlists.addTrack(btn.dataset.plId, _pickerTrack)
        const pl = Playlists.get(btn.dataset.plId)
        closePicker()
        UI.toast(`Added to "${pl?.name}"`)
        renderPage()
      })
    })
  }
  $('playlist-picker-sheet')?.classList.add('open')
}

export function closePicker() {
  $('playlist-picker-sheet')?.classList.remove('open')
  _pickerTrack = null
}

export function initEvents() {
  $('lib-create-btn')?.addEventListener('click', openCreateModal)
  $('playlists-create-btn')?.addEventListener('click', openCreateModal)
  $('pl-modal-close')?.addEventListener('click', closeCreateModal)
  $('pl-modal-cancel')?.addEventListener('click', closeCreateModal)
  $('pl-modal-create')?.addEventListener('click', _createPlaylist)
  $('playlist-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === $('playlist-modal-overlay')) closeCreateModal()
  })
  $('pl-modal-cover-input')?.addEventListener('input', (e) =>
    _updateModalCover(e.target.value.trim())
  )
  $('pl-modal-name-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') _createPlaylist()
  })
  $('playlist-picker-overlay')?.addEventListener('click', closePicker)
  $('playlist-picker-new')?.addEventListener('click', () => {
    closePicker()
    openCreateModal()
  })
}
