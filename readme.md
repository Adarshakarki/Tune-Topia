# Tune Topia

Tune Topia is a high-fidelity, privacy-focused music streaming web application. Built with a no-framework philosophy, it leverages Vanilla JavaScript and modern Web APIs to deliver a premium experience using Tidal and YouTube as backends without subscriptions, advertisements, or tracking.

---

# Key Features

### Audiophile Grade Streaming
- **Lossless and Hi-Res:** Direct access to FLAC (16-bit/24-bit) and AAC streams via Tidal open proxy networks.
- **Hybrid Resolution Engine:** Automatic fallback to YouTube (Invidious) when Tidal tracks are unavailable, ensuring high availability of the music library.
- **Low-Latency Playback:** Implementation of dual-buffer logic to achieve true gapless playback transitions between tracks.
- **Parametric DSP:** Integrated 10-band parametric equalizer featuring real-time frequency response visualization and frequency-specific gain adjustment.

### Sound Capsule (Local Analytics)
- **Local-First Telemetry:** All listening history, playback statistics, and user preferences are stored exclusively on the client device using LocalStorage and IndexedDB.
- **Data Visualization:** Comprehensive analytics dashboard providing peak hour distribution charts, artist discovery metrics, and interactive listening heatmaps.

### Modern Web Experience
- **PWA Integration:** Full Progressive Web App support for installation on mobile and desktop environments, including offline shell caching via Service Workers.
- **Advanced Synced Lyrics:** Real-time synchronization utilizing the @uimaxbai/am-lyrics web component. Features include word-level interpolation, time-synced scrolling, and automated metadata matching via the LRCLIB API.
- **Dynamic UI:** Responsive interface utilizing a custom design token system that scales seamlessly from handheld devices to ultra-wide monitors.

---

## Screenshots

| Mobile | Desktop |
|--------|---------|
| ![Home](assets/screenshots/home-phone.png) | ![Home](assets/screenshots/home-desktop.png) |
| ![Player](assets/screenshots/player-phone.png) | ![Player](assets/screenshots/player-desktop.png) |
| ![Search](assets/screenshots/search-phone.png) | ![Search](assets/screenshots/search-desktop.png) |
| ![searching](assets/screenshots/searching-phone.png) | ![searching](assets/screenshots/searching-desktop.png) |
| ![Album](assets/screenshots/album-phone.png) | ![Album](assets/screenshots/album-desktop.png) |
| ![artist](assets/screenshots/artist-phone.png) | ![artist](assets/screenshots/artist-desktop.png) |
| ![playlist](assets/screenshots/playlist-phone.png) | ![playlist](assets/screenshots/playlist-desktop.png) |
---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause |
| `ArrowRight` | Seek +10s |
| `ArrowLeft` | Seek -10s |
| `Shift + ArrowRight` | Next track |
| `Shift + ArrowLeft` | Previous track |
| `↑` | Volume up |
| `↓` | Volume down |
| `M` | Mute |
| `S` | Toggle shuffle |
| `R` | Toggle repeat |

---
