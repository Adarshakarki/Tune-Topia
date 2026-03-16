// pages/likedVideosInit.js — wires liked videos into the app router

import * as LikedVideos from '../modules/likedVideos.js';
import * as LikedVideosPage from './likedVideos.js';

const $ = (id) => document.getElementById(id);

export function init(playVideoFn, showPageFn) {
  LikedVideosPage.init(playVideoFn);

  // Library menu → navigate like any other page
  $('lib-liked-videos')?.addEventListener('click', () => {
    showPageFn('liked-videos');
    LikedVideosPage.onEnter();
  });

  _updateCount();
}

export function toggle(video) {
  const isLiked = LikedVideos.toggle(video);
  _updateCount();
  LikedVideosPage.refresh();
  return isLiked;
}

export function has(id) {
  return LikedVideos.has(id);
}
export function updateCount() {
  _updateCount();
}

function _updateCount() {
  const n = LikedVideos.count();
  const lbl = $('liked-videos-count-label');
  if (lbl) lbl.textContent = `${n} video${n !== 1 ? 's' : ''}`;
}
