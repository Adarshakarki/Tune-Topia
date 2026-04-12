// Likes
import * as UI from './ui.js'
import State from './state.js'
import { toggle } from '../modules/likedSongs.js'

const $ = (id) => document.getElementById(id)

// Handle like toggle
export function onLike(track) {
  if (!track) return;
  const liked = toggle(track);
  UI.syncLikeButtons(track.id);
  UI.toast(liked ? `♥ Liked "${track.title}"` : 'Removed from Liked Songs');
  updateLikedCount();
}

// Update count labels
export function updateLikedCount() {
  const n = State.get('library.likedSongs').length, txt = `${n} song${n !== 1 ? 's' : ''}`;
  ['liked-count-label', 'liked-hero-sub'].forEach(id => {
    const el = $(id); if (el) el.textContent = txt;
  });
}
