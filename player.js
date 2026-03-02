// state //

const Player = (() => {
  let queue = [];
  let qIdx = -1;
  let isPlaying = false;
  let isShuffle = false;
  let isRepeat = false;
  let currentTrack = null;
  let dashPlayer = null;
  let isLoading = false;

  const audio = document.getElementById('audio');

  // volume init
  let vol = parseFloat(localStorage.getItem('tt_vol') || '0.8');
  audio.volume = vol;

  // events //

  audio.addEventListener('ended', () => {
    if (!isRepeat) next();
  });

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    UI.updateProgress(pct, audio.currentTime, audio.duration);
  });

  audio.addEventListener('play', () => {
    isPlaying = true;
    UI.setPlayState(true);
  });

  audio.addEventListener('pause', () => {
    isPlaying = false;
    UI.setPlayState(false);
  });

  audio.addEventListener('error', () => {
    UI.toast('Playback error — trying fallback...');
    next();
  });

  // playback //

  async function play(track, queueTracks, idx) {
    if (queueTracks) {
      queue = queueTracks;
      qIdx = idx ?? 0;
    }
    currentTrack = track;
    isLoading = true;

    UI.setTrackInfo(track);
    UI.setLoadingState(true);
    UI.toast('Loading…');

    // destroy existing DASH session
    if (dashPlayer) {
      try { dashPlayer.destroy(); } catch {}
      dashPlayer = null;
    }

    try {
      const stream = await getStream(track);

      if (stream.type === 'dash') {
        await playDash(stream.manifest);
      } else {
        audio.src = stream.url;
        await audio.play();
      }

      isPlaying = true;
      isLoading = false;
      UI.setLoadingState(false);
      UI.toast(`Now playing: ${track.title}`);
      UI.renderQueue(queue, qIdx);
      saveToHistory(track);

    } catch (e) {
      isLoading = false;
      UI.setLoadingState(false);
      UI.toast('Failed: ' + e.message);
      console.error(e);
    }
  }

  async function playDash(manifestXml) {
    if (!window.dashjs) {
      UI.toast('Loading DASH player…');
      await loadDashJs();
    }
    dashPlayer = dashjs.MediaPlayer().create();
    const blob = new Blob([manifestXml], { type: 'application/dash+xml' });
    const url = URL.createObjectURL(blob);
    dashPlayer.initialize(audio, url, true);
    dashPlayer.updateSettings({ streaming: { abr: { autoSwitchBitrate: { audio: false } } } });
  }

  function loadDashJs() {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/dashjs/4.7.4/dash.all.min.js';
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  async function toggle() {
    if (!audio.src && !dashPlayer) return;
    if (isPlaying) {
      audio.pause();
    } else {
      await audio.play();
    }
  }

  async function next() {
    if (!queue.length) return;
    qIdx = isShuffle
      ? Math.floor(Math.random() * queue.length)
      : (qIdx + 1) % queue.length;
    await play(queue[qIdx]);
    UI.renderQueue(queue, qIdx);
  }

  async function prev() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    if (!queue.length) return;
    qIdx = (qIdx - 1 + queue.length) % queue.length;
    await play(queue[qIdx]);
    UI.renderQueue(queue, qIdx);
  }

  async function playFromQueue(i) {
    qIdx = i;
    await play(queue[i]);
    UI.renderQueue(queue, qIdx);
  }

  function seek(pct) {
    if (audio.duration) audio.currentTime = (pct / 100) * audio.duration;
  }

  function setVolume(v) {
    vol = Math.max(0, Math.min(1, v));
    audio.volume = vol;
    localStorage.setItem('tt_vol', vol);
    UI.updateVolume(vol);
  }

  function toggleShuffle() {
    isShuffle = !isShuffle;
    UI.setShuffle(isShuffle);
  }

  function toggleRepeat() {
    isRepeat = !isRepeat;
    audio.loop = isRepeat;
    UI.setRepeat(isRepeat);
  }

  // history //

  function saveToHistory(track) {
    let hist = loadHistory();
    hist = [track, ...hist.filter(h => h.id !== track.id)].slice(0, 80);
    localStorage.setItem('tt_history', JSON.stringify(hist));
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem('tt_history') || '[]'); } catch { return []; }
  }

  // getters //

  function getState() {
    return { queue, qIdx, isPlaying, isShuffle, isRepeat, currentTrack, vol, isLoading };
  }

  return {
    play, toggle, next, prev, playFromQueue,
    seek, setVolume, toggleShuffle, toggleRepeat,
    loadHistory, getState,
  };
})();
