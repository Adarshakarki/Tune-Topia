# TuneTopia — Progress Tracker

## Done

### Backend / Player Logic
- [x] Multi-provider HiFi streaming (Monochrome, Squid, QQDL, Spotisaver, Kinoplus, Binimum)
- [x] YouTube fallback via Invidious when all HiFi providers fail
- [x] `tryBases()` — sequential provider fallback with error collection
- [x] `hifiSearch`, `hifiSearchArtist`, `hifiSearchAlbums`
- [x] `ivSearch`, `ivGetStream` (Invidious YouTube)
- [x] `hifiGetStream` with quality ladder: LOSSLESS → HI_RES_LOSSLESS → HIGH
- [x] DASH manifest decoding + `dashjs` dynamic load
- [x] Direct stream URL playback
- [x] Queue system with shuffle and repeat
- [x] Play / Pause / Prev / Next controls
- [x] Seek by percentage
- [x] Volume control with localStorage persistence
- [x] Play history saved to localStorage (last 80 tracks)
- [x] `qualityBadge()` — HiRes / FLAC / YT badges
- [x] `fmtTime` / `fmtDur` utilities
- [x] `escHtml` XSS sanitization
- [x] Album color extraction from artwork → dynamic gradient theming

### Mobile UI
- [x] iOS-style navbar with large title
- [x] Greeting ("Good morning / afternoon / evening")
- [x] Genre chips horizontal scroll
- [x] "What's New" horizontal card scroll row on Home
- [x] "Recently Played" horizontal card scroll row on Home (shown after first play)
- [x] Top Tracks list below horizontal sections
- [x] Provider status indicator
- [x] Search page with 3-column mood grid empty state
- [x] Segment tabs (Songs / Video / Albums / Artists / Playlists) shown only when typing
- [x] Track rows: thumbnail, title, explicit `E` tag, artist · album, like button, duration
- [x] Swipe right → Add to queue, swipe left → Remove
- [x] Album grid view (2-col)
- [x] Artist list with chevron
- [x] Library page with horizontal recently-played scroll
- [x] Library menu: Liked Songs (with count), Albums, Artists, History
- [x] Liked Songs drilldown page: play-all, search-within, A–Z / Recent sort, per-song like/unlike
- [x] Mini player: artwork, title, artist + timestamp, explicit tag, prev/play/next controls
- [x] Mini player: album-color gradient background
- [x] Mini player: progress bar on bottom edge
- [x] Full player: full-screen immersive with blurred background
- [x] Full player: album artwork shows crisp in top half, dims slightly when paused
- [x] Full player: extracted album color → dynamic gradient overlay
- [x] Full player: title, explicit tag, artist, like button
- [x] Full player: progress bar with scrub thumb
- [x] Full player: prev / repeat / play / shuffle / next controls
- [x] Full player: volume bar
- [x] Full player: Lyrics and Queue buttons
- [x] Lyrics panel (slide-in) with mini controls at bottom, "not available" placeholder
- [x] Queue panel (slide-in) with drag handles, mini controls at bottom
- [x] More Options bottom sheet: Add to Queue, Share, Open on Tidal/YouTube
- [x] Tab bar: Home / Search / Library
- [x] Lucide icons throughout (no raw SVG strings)
- [x] `LikedSongs` module with localStorage persistence, shared mobile + desktop
- [x] Toast notifications

### Desktop UI
- [x] Collapsible sidebar (icon-only when collapsed, full labels when expanded)
- [x] Sidebar: Home, New Releases, Recently Played, Artists, Albums, Songs, History, Liked Songs
- [x] Sidebar: Account & Settings button at bottom
- [x] Sidebar collapse toggle button with icon swap
- [x] Home page: greeting + genre chips + What's New grid + Recently Played grid
- [x] New Releases page: album grid
- [x] Albums page: album grid
- [x] Songs page: track list with # / title / explicit / album / like / duration columns
- [x] Artists page: artist grid (circular avatars)
- [x] Recently Played page: album grid from history
- [x] History page: track list
- [x] Search page: tab bar (Songs/Video/Albums/Artists), results, empty state
- [x] Liked Songs page: hero section, play-all, search-within, sort, per-row like buttons
- [x] Bottom mini bar: album art, title, explicit tag, like button
- [x] Bottom mini bar: shuffle / prev / play / next / repeat controls
- [x] Bottom mini bar: progress bar with timestamps
- [x] Bottom mini bar: volume bar + queue button
- [x] Bottom mini bar: album-color tint background
- [x] Sticky list headers
- [x] Hover states on track rows (like button appears on hover)
- [x] Playing row highlighted with purple tint + EQ bars animation
- [x] Responsive breakpoint: mobile < 900px, desktop ≥ 900px

---

##  Not Done / To Do

### Bugs to Fix
- [ ] Race condition on fast track clicks — need `loadId` counter to cancel stale streams
- [ ] `playDash()` missing `await audio.play()` after `dashPlayer.initialize()`
- [ ] Swipe-to-queue mutates a stale queue copy — need `Player.addNext(track)` method
- [ ] `audio.loop` + `ended` event double-handling when repeat is on
- [ ] `saveHistory()` fires before audio confirmed playing — should move to `audio.play` event
- [ ] `fetchJSON` 9s timeout × 14 providers = very long worst-case wait, needs global abort
- [ ] Empty `catch {}` in `getStream` quality loop hides errors — should log them

### Missing Features
- [ ] **Lyrics** — integrate lrclib.net API (free, no key needed) to fetch and display synced lyrics
- [ ] **Album drilldown** — clicking an album should fetch and show its tracks
- [ ] **Track context menu** (long-press mobile) — currently just shows a toast
- [ ] **Queue persistence** — save queue + current index to `sessionStorage` on change
- [ ] **Explicit flag in API** — `normalizeHifiTrack` doesn't currently read an explicit field from Tidal data; needs mapping
- [ ] **Search results: like button column** visible on mobile track rows (currently there but needs verify)
- [ ] **Playlists tab** in search — currently reuses albums endpoint; needs real playlist search
- [ ] **Create playlist** — `+Create` button exists but does nothing
- [ ] **Account / Settings page** — currently just a toast

### Desktop-Specific To Do
- [ ] Queue panel on desktop (currently toast placeholder)
- [ ] Full player view on desktop (double-click mini bar or dedicated button)
- [ ] Keyboard shortcuts: Space = play/pause, ← → = seek, N = next, P = prev
- [ ] Drag-and-drop queue reordering on desktop
- [ ] Sidebar search should filter sidebar nav, not only show search page

### Code Quality
- [ ] `GENRES` was duplicated in `App` and `DesktopApp` — now shared, but verify no leftover copies
- [ ] `fmtTime` and `fmtDur` still nearly identical — consolidate into one function
- [ ] Desktop render functions (`renderDtTrackList`, `renderDtAlbumGrid`) still duplicate mobile logic — extract shared renderer with a `variant` option
- [ ] No error retry button on homepage load failure — add "Try again" CTA
- [ ] `lucide.createIcons()` called redundantly in multiple places — batch into single call after DOM mutations
- [ ] No `<meta name="theme-color">` update when album color changes — easy PWA win