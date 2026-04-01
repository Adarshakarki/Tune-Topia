import State from '../app/state.js'

const Queue = (() => {
  // Shuffle state
  let _history = [] // tracks played in order

  function _shuffleArray(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const _split = (tracks, position) => { State.set('queue.played', tracks.slice(0, position)); State.set('queue.upcoming', tracks.slice(position + 1)); };
  const _buildShuffleQueue = () => {
    const tracks = State.get('queue.tracks'), current = State.get('player.currentTrack');
    State.set('queue.upcoming', _shuffleArray(current ? tracks.filter(t => t.id !== current.id) : [...tracks]));
  };

  function load(tracks, startIndex = 0) {
    State.set('queue.tracks', tracks);
    State.set('player.queuePosition', startIndex);
    _split(tracks, startIndex);
    _history = [];
    State.set('queue.played', []); // Clear played history for new load
    State.set('queue.upcoming', []); // Clear upcoming for new load
  }

  function onShuffleEnabled() {
    _history = [];
    _buildShuffleQueue();
  }
  function onShuffleDisabled() {
    _history = [];
    State.set('queue.upcoming', []); // Clear shuffled upcoming
  }

  function add(track) {
    State.set('queue.tracks', [...State.get('queue.tracks'), track]);
  }

  function addNext(track) {
    const tracks = [...State.get('queue.tracks')], pos = State.get('player.queuePosition');
    tracks.splice(pos + 1, 0, track);
    State.set('queue.tracks', tracks);
    _split(tracks, pos);
  }

  function remove(index) {
    const tracks = [...State.get('queue.tracks')], pos = State.get('player.queuePosition');
    tracks.splice(index, 1);
    State.set('queue.tracks', tracks);
    State.set('player.queuePosition', index < pos ? pos - 1 : pos);
    _split(tracks, State.get('player.queuePosition'));
  }

  function reorder(fromIndex, toIndex) {
    const tracks = [...State.get('queue.tracks')], [moved] = tracks.splice(fromIndex, 1);
    tracks.splice(toIndex, 0, moved);
    State.set('queue.tracks', tracks);
  }

  function clear() {
    State.set('queue.tracks', []);
    State.set('queue.played', []);
    State.set('queue.upcoming', []);
    State.set('player.queuePosition', -1);
    _history = [];
  }

  const getCurrent = () => State.get('queue.tracks')[State.get('player.queuePosition')] || null;
  const getNext = () => State.get('player.isShuffle') ? State.get('queue.upcoming')[0] || null : State.get('queue.tracks')[State.get('player.queuePosition') + 1] || null;
  const getPrev = () => _history.length ? _history[_history.length - 1] : State.get('queue.tracks')[State.get('player.queuePosition') - 1] || null;
  const getUpcoming = () => State.get('player.isShuffle') ? [...State.get('queue.upcoming')] : State.get('queue.tracks').slice(State.get('player.queuePosition') + 1);

  function advance(direction = 1) {
    const tracks = State.get('queue.tracks'), current = State.get('player.currentTrack');
    let nextTrack;

    if (direction === -1) {
      if (current) {
        const upcoming = [current, ...State.get('queue.upcoming')];
        State.set('queue.upcoming', upcoming);
      }
      nextTrack = _history.pop() || tracks[State.get('player.queuePosition') - 1] || null;
    } else {
      if (current) _history.push(current)
      if (State.get('player.isShuffle')) {
        const upcoming = [...State.get('queue.upcoming')];
        if (!upcoming.length) _buildShuffleQueue();
        nextTrack = upcoming.shift() || null;
        State.set('queue.upcoming', upcoming);
      } else {
        nextTrack = tracks[State.get('player.queuePosition') + 1] || null
      }
    }
    if (!nextTrack) return null;
    const pos = tracks.findIndex(t => t.id === nextTrack.id);
    if (pos !== -1) { State.set('player.queuePosition', pos); _split(tracks, pos); }
    return nextTrack;
  }

  return {
    load,
    add,
    addNext,
    remove,
    reorder,
    clear,
    getCurrent,
    getNext,
    getPrev,
    getUpcoming,
    advance,
    onShuffleEnabled,
    onShuffleDisabled,
  };
})()

export default Queue
