// Queue
import State from '../app/state.js'

const Queue = (() => {
  let _history = []

  function _shuffleArray(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  const _split = (tracks, position) => {
    State.set('queue.played', tracks.slice(0, position))
    State.set('queue.upcoming', tracks.slice(position + 1))
  }

  const _buildShuffleQueue = () => {
    const tracks = State.get('queue.tracks')
    const current = State.get('player.currentTrack')
    const pos = State.get('player.queuePosition')
    const offset = State.get('queue.priorityOffset') || 0

    const priority = tracks.slice(pos + 1, pos + 1 + offset)

    const pool = tracks.filter(
      t =>
        (current ? t.id !== current.id : true) &&
        !priority.some(p => p.id === t.id)
    )

    State.set('queue.upcoming', [...priority, ..._shuffleArray(pool)])
  }

  function load(tracks, startIndex = 0) {
    State.set('queue.tracks', tracks)
    State.set('player.queuePosition', startIndex)

    _history = []
    State.set('queue.priorityOffset', 0)

    _split(tracks, startIndex)
  }

  function onShuffleEnabled() {
    _history = []
    _buildShuffleQueue()
  }

  function onShuffleDisabled() {
    _history = []
    State.set('queue.upcoming', [])
  }

  /**
   * @param {Object} track - The track to add
   * @param {boolean} isManual - If true, increments priority block (Up Next)
   */
  function add(track, isManual = true) {
    const tracks = [...State.get('queue.tracks')]
    const pos = State.get('player.queuePosition')
    const offset = State.get('queue.priorityOffset') || 0

    // FIFO: For manual tracks, append to priority block. For automatic, append to end of queue.
    const insertAt = (pos === -1) ? (isManual ? offset : tracks.length) : (isManual ? pos + 1 + offset : tracks.length)
    tracks.splice(insertAt, 0, track)

    State.set('queue.tracks', tracks)
    if (isManual) State.set('queue.priorityOffset', offset + 1)

    if (State.get('player.isShuffle')) {
      const upcoming = [...State.get('queue.upcoming')]
      // FIFO: Insert at the end of the manual block or end of the shuffled pool
      upcoming.splice(isManual ? offset : upcoming.length, 0, track)
      State.set('queue.upcoming', upcoming)
    } else {
      _split(tracks, pos)
    }
  }

  function addNext(track) {
    const tracks = [...State.get('queue.tracks')]
    const pos = State.get('player.queuePosition')
    const offset = State.get('queue.priorityOffset') || 0

    // LIFO: Insert at the absolute top of the manual priority block (Play Next)
    const insertAt = pos + 1
    tracks.splice(insertAt, 0, track)

    State.set('queue.tracks', tracks)
    State.set('queue.priorityOffset', offset + 1)

    if (State.get('player.isShuffle')) {
      const upcoming = [...State.get('queue.upcoming')]
      // Put at the very start of shuffled upcoming (top priority)
      upcoming.unshift(track)
      State.set('queue.upcoming', upcoming)
    } else {
      _split(tracks, pos)
    }
  }

  function remove(index) {
    const tracks = [...State.get('queue.tracks')]
    const pos = State.get('player.queuePosition')
    const offset = State.get('queue.priorityOffset') || 0

    tracks.splice(index, 1)

    if (index > pos && index <= pos + offset) {
      State.set('queue.priorityOffset', Math.max(0, offset - 1))
    }

    State.set('queue.tracks', tracks)
    State.set('player.queuePosition', index < pos ? pos - 1 : pos)

    _split(tracks, State.get('player.queuePosition'))
  }

  function jump(index) {
    const pos = State.get('player.queuePosition')
    const offset = State.get('queue.priorityOffset') || 0
    const delta = index - pos
    State.set('queue.priorityOffset', Math.max(0, offset - delta))
    State.set('player.queuePosition', index)
    _split(State.get('queue.tracks'), index)
  }

  function reorder(fromIndex, toIndex) {
    const tracks = [...State.get('queue.tracks')]
    const [moved] = tracks.splice(fromIndex, 1)
    tracks.splice(toIndex, 0, moved)
    State.set('queue.tracks', tracks)
  }

  function clear() {
    State.set('queue.tracks', [])
    State.set('queue.played', [])
    State.set('queue.upcoming', [])
    State.set('player.queuePosition', -1)
    State.set('queue.priorityOffset', 0)
    _history = []
  }

  const getCurrent = () =>
    State.get('queue.tracks')[State.get('player.queuePosition')] || null

  const getNext = () =>
    State.get('player.isShuffle')
      ? State.get('queue.upcoming')[0] || null
      : State.get('queue.tracks')[State.get('player.queuePosition') + 1] || null

  const getPrev = () =>
    _history.length
      ? _history[_history.length - 1]
      : State.get('queue.tracks')[State.get('player.queuePosition') - 1] || null

  const getUpcoming = () => {
    const offset = State.get('queue.priorityOffset') || 0

    const all = State.get('player.isShuffle')
      ? [...State.get('queue.upcoming')]
      : State.get('queue.tracks').slice(
          State.get('player.queuePosition') + 1
        )

    return {
      priority: all.slice(0, offset),
      incoming: all.slice(offset),
    }
  }

  function advance(direction = 1) {
    const tracks = State.get('queue.tracks')
    const current = State.get('player.currentTrack')

    let nextTrack
    const offset = State.get('queue.priorityOffset') || 0

    // Only decrement offset when moving forward into the manual queue.
    // Going backward preserves the manual queue for when you return.
    if (direction === 1) {
      State.set('queue.priorityOffset', Math.max(0, offset - 1))
    }

    if (direction === -1) {
      if (current) {
        const upcoming = [current, ...State.get('queue.upcoming')]
        State.set('queue.upcoming', upcoming)
      }

      nextTrack =
        _history.pop() ||
        tracks[State.get('player.queuePosition') - 1] ||
        null
    } else {
      if (current) _history.push(current)

      if (State.get('player.isShuffle')) {
        const upcoming = [...State.get('queue.upcoming')]

        if (!upcoming.length) _buildShuffleQueue()

        nextTrack = upcoming.shift() || null
        State.set('queue.upcoming', upcoming)
      } else {
        nextTrack =
          tracks[State.get('player.queuePosition') + 1] || null
      }
    }

    if (!nextTrack) return null

    const pos = tracks.findIndex(t => t.id === nextTrack.id)

    if (pos !== -1) {
      State.set('player.queuePosition', pos)
      _split(tracks, pos)
    }

    return nextTrack
  }

  return {
    load,
    add,
    addNext,
    remove,
    reorder,
    jump,
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