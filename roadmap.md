## 🎵 TuneTopia Development Roadmap

### Architecture Rules

- **API Layer:**
- `client` — HTTP only, returns raw JSON.
- `service` — Transforms raw data into TuneTopia shapes.
- `index.js` — The "brain" of the API; all imports happen here.

- **Modules:**
- No DOM access. Communicate via exports and events.
- State changes must go through `state.js`.

- **Pages:**
- Own their rendering and data fetching.
- They never call each other; the **Router** handles transitions.

- **UI:**
- The only layer allowed to touch the DOM.
- Zero business logic or API calls.

- **App/Init:**
- Bootstraps the application.
- Strictly under 50 lines of code.

---

### 🚀 Implementation Phases

#### Phase 0: Architecture & Refactoring

- [ x ] Create folder structure
- [ x ] Split `tidal.js` into client + service
- [ x ] Split `youtube.js` into client + service
- [ x ] Create `api/index.js`
- [ x ] Extract pages from `app.js` into `pages/`
- [ x ] Extract Now Playing logic into `ui/nowplaying.js`
- [ x ] Extract sheets and toasts into `ui/`
- [ x ] Create `app/router.js`
- [ x ] Reduce `app.js` to `app/init.js`

#### Phase 1: Bug Fixes

- [ x ] **11.** Fix gapless playback
- [ ] **12.** Fix YT playing as audio instead of video

#### Phase 2: Player Core

- [ x ] **14.** Global keyboard shortcuts
- [ ] **15.** Audio Equalizer

#### Phase 3: Video Player

- [ x ] **16.** `#video-player` overlay (Portrait/Landscape + Auto-hide)
- [ x ] **17.** Tidal videos via `dashjs`
- [ ] **18.** YouTube videos via direct stream
- [ ] **19.** Audio-only YT toggle in settings

#### Phase 4: Library & Playlists

- [ ] **20.** Playlist editor (Title, Description, Cover)
- [ ] **21.** Track options sheet (Play next, Add to queue, etc.)
- [ ] **22.** Global sort options (Liked, Albums, Playlists)

#### Phase 5: Search Expansion

- [ x ] **23.** Playlist search tab
- [ x ] **24.** Tidal videos search tab
- [ x ] **25.** YouTube videos search tab

#### Phase 6: Downloads

- [ ] **26.** Single track download with metadata
- [ ] **27.** Download quality settings

#### Phase 7: UX Polish

- [ ] **28.** Empty states (Queue, Liked, Search)
- [ ] **29.** Error handling (Failed streams/fetches)
- [ ] **30.** Skeleton loading states for pages

#### Phase 8: Authentication & Sync

- [ ] **31.** Supabase Signup + Login
- [ ] **32.** Session handling
- [ ] **33.** Sync Liked tracks + Playlists to Supabase
- [ ] **34.** Profile page with real-time user data

#### Phase 9: Launch Prep

- [ ] **35.** Documentation cleanup
- [ ] **36.** Dead code removal
- [ ] **37.** Project README
- [ ] **38.** PWA manifest + Service Worker for offline use
