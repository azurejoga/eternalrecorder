# Eternal Recorder

Desktop screen recorder with floating camera overlay, live scenes, and RTMP streaming.

- **Version**: 1.1.8
- **Author**: Eternal Legend
- **Platforms**: Windows 10+ · Linux (AppImage/DEB)
- **Stack**: Electron 30 · React 18 · Vite 5 · FFmpeg · i18next

## Features

### Screen Recording
- Full screen or specific window capture
- Floating circular camera window (always on top, resizable, draggable)
- Customizable border: solid color, gradient, neon glow
- System audio + microphone mixing via AudioContext
- **Camera Only** mode (fullscreen webcam)
- **Audio Only** mode
- **Multi-Audio**: separate files for system audio and microphone
- **Scene Mode**: canvas-based recording with live scene switching
- Output formats: WebM (native), MP4, MKV, MP3, WAV, FLAC (via FFmpeg)
- Beep on recording start/stop

### Scenes
- Save full configuration snapshots (source, camera, mic, audio, border, format)
- Apply scenes before recording
- Switch scenes live during recording (canvas mode)
- Rename and delete with confirmation
- Persisted in `scenes.json`

### Live Streaming (RTMP)
- Multiple simultaneous destinations (YouTube, Facebook, Twitch, custom RTMP)
- Destinations encrypted with AES-256-CBC
- Per-destination individual control
- FFmpeg encoding with optimized presets

### Internationalization
- **25 languages**: EN, PT-BR, ES, ZH, FR, DE, IT, JA, VI, TH, HI, NL, AF, EL, RU, UK, KO, TR, AR, HE, CA, EO, ZH-TW, ZH-YUE, BO
- Automatic system language detection
- Persisted choice

### Global Shortcuts (customizable)

| Action | Default |
|--------|---------|
| Start Recording | `Ctrl+Shift+R` |
| Stop Recording | `Ctrl+Shift+S` |
| Pause/Resume | `Ctrl+Shift+P` |
| Mute Microphone | `Ctrl+Shift+M` |
| Toggle System Audio | `Ctrl+Shift+A` |
| Show/Hide Window | `Ctrl+Shift+H` |

### Recording Quality (configurable)
- FPS: 24/30/60
- Video bitrate: 1–8 Mbps
- Audio bitrate: 96–320 kbps
- Resolution: source, 1920×1080, 1280×720, 854×480

### System
- System tray icon
- Close button behavior: exit or minimize to tray
- Single-instance lock
- Logs written to `log.txt` (alongside the executable)
- Portable `config.ini`

## Project Structure

```
Eternal Recorder/
├── electron/
│   ├── main.js                    # Main process (IPC, FFmpeg, RTMP, tray)
│   ├── preload.cjs                # contextBridge API (~30 methods)
│   └── destinations.dat           # Encrypted RTMP destinations
├── src/
│   ├── main.jsx                   # React entry point
│   ├── App.jsx                    # Window router (control | camera)
│   ├── index.css                  # Global styles
│   ├── components/
│   │   ├── ControlPanel.jsx       # Main panel with tabs
│   │   ├── TabNavigation.jsx      # Tab navigation
│   │   ├── RecorderTab.jsx        # Recording tab (~2000 lines)
│   │   ├── ScenesTab.jsx          # Scene management tab
│   │   ├── TransmissionTab.jsx    # RTMP streaming tab
│   │   ├── SettingsTab.jsx        # Settings tab
│   │   ├── CameraView.jsx         # Floating camera window
│   │   └── ErrorBoundary.jsx      # React error handling
│   ├── contexts/
│   │   └── I18nContext.jsx        # Internationalization context
│   ├── locales/
│   │   ├── i18n.js                # i18next config (25 languages)
│   │   ├── en.json                # English
│   │   └── pt-br.json             # Portuguese (Brazil)
│   │   └── ... (+23 languages)
│   └── assets/
│       └── logo.png               # App logo
├── build/
│   └── eternalrecorder.ico        # App icon
├── dist/                          # React production build
├── dist_electron/                 # Electron installers output
├── index.html                     # HTML entry point
├── package.json                   # Dependencies and scripts
├── vite.config.js                 # Vite configuration
└── .eslintrc.json                 # ESLint configuration
```

## Installation & Development

```bash
git clone <repo>
cd Eternal Recorder
npm install
npm run dev            # Starts Vite + Electron in dev mode
npm run dev:react      # Vite dev server only
npm run dev:electron   # Electron only (requires Vite running)
```

## Production Build

```bash
npm run build
```

Output in `dist_electron/`:
- Windows: `Eternal Recorder Setup x.x.x.exe` (NSIS) + portable
- Linux: `Eternal-Recorder-x.x.x-linux-x86_64.AppImage` + `.deb`

## IPC Communication

The app exposes ~30 IPC channels via `window.electronAPI` (preload.cjs):

| Channel | Purpose |
|---------|---------|
| `get-desktop-sources` | List available screens |
| `get-window-sources` | List available windows |
| `set-display-media-source` | Set capture source |
| `save-recording` | Save video with FFmpeg conversion |
| `save-audio-alongside` | Save separate audio (multi-audio) |
| `set-camera-source` | Switch camera source |
| `toggle-camera-window` | Show/hide camera window |
| `set-border-color` | Update camera border |
| `resize-camera` | Resize camera window |
| `drag-window` | Drag camera window |
| `read-config` / `write-config` | Read/write config.ini |
| `get-scenes` / `save-scenes` | Scene persistence |
| `get-shortcuts` / `save-shortcuts` | Keyboard shortcuts |
| `get-recording-settings` / `save-recording-settings` | Recording quality |
| `start-rtmp-stream` / `stop-rtmp-stream` / `stream-chunk` | RTMP streaming |
| `load-rtmp-destinations` / `save-rtmp-destinations` | Encrypted destinations |
| `set-recording-status` | Update tray status |

## Requirements

- **Windows**: Windows 10+ (x64)
- **Linux**: Distribution with PipeWire or X11 support
- **FFmpeg**: Bundled via `@ffmpeg-installer` (Windows/Linux)

## Known Limitations

- WebM is the only native MediaRecorder format; MP4/MKV require FFmpeg
- System audio not available in window capture mode (Chromium limitation)
- ASIO devices need FlexASIO or ASIO4ALL as a WASAPI bridge

## Links

- Website: https://eternal-legend.com.br/eternalrecorder/
- Linux Releases: https://github.com/azurejoga/eternalrecorder/releases

## License

© 2026 Eternal Recorder. All rights reserved.
