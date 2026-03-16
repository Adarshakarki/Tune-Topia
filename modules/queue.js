import State from '../app/state.js'

const Queue = (() => {
  // Shuffle state
  let _history = [] // tracks played in order
  let _future = [] // tracks to retrace on prev
  let _shuffleQueue = [] // depleting shuffled upcoming list

  function _shuffleArray(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function _persist() {
    localStorage.setItem('tt_queue', JSON.stringify(State.get('queue.tracks')))
  }

  function _split(tracks, position) {
    State.set('queue.played', tracks.slice(0, position))
    State.set('queue.upcoming', tracks.slice(position + 1))
  }

  function _buildShuffleQueue() {
    const tracks = State.get('queue.tracks')
    const current = State.get('player.currentTrack')
    _shuffleQueue = _shuffleArray(
      current ? tracks.filter((t) => t.id !== current.id) : [...tracks]
    )
    State.set('queue.upcoming', [..._shuffleQueue])
  }

  function load(tracks, startIndex = 0) {
    State.set('queue.tracks', tracks)
    State.set('player.queuePosition', startIndex)
    _split(tracks, startIndex)
    _history = []
    _future = []
    _shuffleQueue = []
    _persist()
  }

  function onShuffleEnabled() {
    _history = []
    _future = []
    _buildShuffleQueue()
  }
  function onShuffleDisabled() {
    _history = []
    _future = []
    _shuffleQueue = []
  }

  function add(track) {
    const tracks = [...State.get('queue.tracks'), track]
    State.set('queue.tracks', tracks)
    _persist()
  }

  function addNext(track) {
    const tracks = [...State.get('queue.tracks')]
    const pos = State.get('player.queuePosition')
    tracks.splice(pos + 1, 0, track)
    State.set('queue.tracks', tracks)
    _split(tracks, pos)
    _persist()
  }

  function remove(index) {
    const tracks = [...State.get('queue.tracks')]
    tracks.splice(index, 1)
    const pos = State.get('player.queuePosition')
    const newPos = index < pos ? pos - 1 : pos
    State.set('queue.tracks', tracks)
    State.set('player.queuePosition', newPos)
    _split(tracks, newPos)
    _persist()
  }

  function reorder(fromIndex, toIndex) {
    const tracks = [...State.get('queue.tracks')]
    const [moved] = tracks.splice(fromIndex, 1)
    tracks.splice(toIndex, 0, moved)
    State.set('queue.tracks', tracks)
    _persist()
  }

  function clear() {
    State.set('queue.tracks', [])
    State.set('queue.played', [])
    State.set('queue.upcoming', [])
    State.set('player.queuePosition', -1)
    _history = []
    _future = []
    _shuffleQueue = []
    _persist()
  }

  function getCurrent() {
    const tracks = State.get('queue.tracks')
    return tracks[State.get('player.queuePosition')] || null
  }

  function getNext() {
    if (State.get('player.isShuffle')) {
      return _future.length
        ? _future[_future.length - 1]
        : _shuffleQueue[0] || null
    }
    const tracks = State.get('queue.tracks')
    return tracks[State.get('player.queuePosition') + 1] || null
  }

  function getPrev() {
    if (_history.length) return _history[_history.length - 1]
    const tracks = State.get('queue.tracks')
    return tracks[State.get('player.queuePosition') - 1] || null
  }

  function getUpcoming() {
    if (State.get('player.isShuffle')) return [..._shuffleQueue]
    const tracks = State.get('queue.tracks')
    return tracks.slice(State.get('player.queuePosition') + 1)
  }

  function advance(direction = 1) {
    const tracks = State.get('queue.tracks')
    const current = State.get('player.currentTrack')

    if (direction === -1) {
      // Prev — save current to future for retrace
      if (current) _future.push(current)
      let prevTrack = _history.length
        ? _history.pop()
        : tracks[State.get('player.queuePosition') - 1] || null
      if (!prevTrack) return null
      const pos = tracks.findIndex((t) => t.id === prevTrack.id)
      if (pos !== -1) {
        State.set('player.queuePosition', pos)
        _split(tracks, pos)
      }
      return prevTrack
    } else {
      // Next — push current to history
      if (current) _history.push(current)
      let nextTrack
      if (State.get('player.isShuffle')) {
        if (_future.length) {
          nextTrack = _future.pop() // retrace
        } else {
          if (!_shuffleQueue.length) _buildShuffleQueue()
          nextTrack = _shuffleQueue.shift() || null
        }
      } else {
        nextTrack = tracks[State.get('player.queuePosition') + 1] || null
      }
      if (!nextTrack) return null
      const pos = tracks.findIndex((t) => t.id === nextTrack.id)
      if (pos !== -1) {
        State.set('player.queuePosition', pos)
        _split(tracks, pos)
      }
      return nextTrack
    }
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
  }
})()

export default Queue
