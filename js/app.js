import { search } from './api.js';
import { playVideo } from './player.js';

const q = document.getElementById('q');
const go = document.getElementById('go');
const list = document.getElementById('list');
const pill = document.getElementById('pill');
const vol = document.getElementById('vol');

let tracks = [];

go.onclick = async () => {
  list.innerHTML = 'Loading…';
  const data = await search(q.value, pill);
  tracks = data;
  render();
};

function render() {
  list.innerHTML = tracks.map((t, i) => `
    <div class="track-item" data-i="${i}">
      <img src="${t.videoThumbnails?.[0]?.url || ''}">
      <div>${t.title}</div>
    </div>
  `).join('');

  list.querySelectorAll('.track-item').forEach(el => {
    el.onclick = () => playVideo(tracks[el.dataset.i].videoId, vol.value);
  });
}