# TuneTopia

A music streaming client built on top of TIDAL and YouTube, with a warm coffee-toned design and a focus on a clean, immersive listening experience.

## Features

- Stream from TIDAL (FLAC, HiRes) with YouTube fallback
- Full-screen now playing with artist fanart
- Gapless playback via dual audio elements
- Sound Capsule — listening stats, heatmap, top tracks
- Offline-capable library (liked songs, saved albums, followed artists, playlists)
- Equalizer with presets and custom bands
- Sleep timer, playback speed, queue management
- PWA — installable on iOS, Android, and desktop
- Dark and light themes (espresso / caramel palette)


## API

TuneTopia proxies TIDAL API requests through self-hosted instances. Configure your API and streaming instance URLs in Settings → API Instances.

YouTube fallback uses the public `yt-dlp` or `invidious` compatible endpoints.

## Data & Privacy

All library data (liked songs, playlists, history, settings) is stored locally in `localStorage`. Nothing is sent to any server unless you use the sync feature. Export a backup regularly via Settings → Backup & Restore.
