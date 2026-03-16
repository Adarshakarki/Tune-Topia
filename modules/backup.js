const BACKUP_VERSION = 1

const STATE_KEYS = [
  'library.likedSongs',
  'library.savedAlbums',
  'library.followedArtists',
  'library.playlists',
  'user.name',
  'user.pfp',
  'ui.theme',
]

const LS_KEYS = ['tt_quality']

export function exportBackup(State) {
  const state = {}
  for (const key of STATE_KEYS) {
    const val = State.get(key)
    if (val !== undefined && val !== null) state[key] = val
  }
  const ls = {}
  for (const key of LS_KEYS) {
    const val = localStorage.getItem(key)
    if (val !== null) ls[key] = val
  }
  const backup = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'TuneTopia',
    state,
    ls,
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tunetopia-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function importBackup(State, onSuccess, onError) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.addEventListener('change', async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const backup = JSON.parse(await file.text())
      _validate(backup)
      _restore(State, backup)
      onSuccess?.(backup)
    } catch (err) {
      onError?.(err.message || 'Invalid backup file')
    }
  })
  input.click()
}

function _validate(backup) {
  if (!backup || typeof backup !== 'object')
    throw new Error('Not a valid backup file')
  if (backup.appName !== 'TuneTopia')
    throw new Error('This backup is not from TuneTopia')
  if (typeof backup.version !== 'number')
    throw new Error('Missing version field')
  if (!backup.state || typeof backup.state !== 'object')
    throw new Error('Missing state data')
}

function _restore(State, backup) {
  for (const key of STATE_KEYS) {
    if (backup.state[key] !== undefined) State.set(key, backup.state[key])
  }
  const name = backup.state['user.name'],
    pfp = backup.state['user.pfp']
  if (name !== undefined || pfp !== undefined)
    State.setUser?.(name || '', pfp || '')
  if (backup.ls) {
    for (const key of LS_KEYS) {
      if (backup.ls[key] !== undefined)
        localStorage.setItem(key, backup.ls[key])
    }
  }
}
