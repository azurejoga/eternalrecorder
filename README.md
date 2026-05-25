# Eternal Recorder

## Overview

**Eternal Recorder** is a minimal desktop screen recorder application built with **Electron** and **React**. The application allows users to record their computer screen while displaying a customizable floating camera window.

- **Version**: 1.1.1
- **Author**: Eternal Legend
- **Platform**: Windows
- **Technology Stack**: Electron, React 18, Vite

---

## Features

### Screen Recording
- Record computer screen with system audio
- Record microphone audio with optional system audio mixing
- Camera preview in floating window
- Customizable camera border (solid, gradient, neon glow)
- Multiple camera sources
- Multiple microphones

### Live Streaming (Coming Soon)
- RTMP streaming support
- Multiple simultaneous destinations
- Pre-configured platforms (YouTube, Facebook, Twitch)
- Custom RTMP destinations

### Settings
- Multi-language support (English, Portuguese)


---

## General Information

## Project Structure

```
Eternal Recorder/
├── electron/
│   ├── main.js              # Main Electron process
│   └── preload.cjs           # IPC preload script
├── src/
│   ├── components/
│   │   ├── App.jsx             # Main router component
│   │   ├── CameraView.jsx      # Floating camera window
│   │   ├── ControlPanel.jsx   # Main control panel
│   │   ├── ErrorBoundary.jsx   # Error boundary
│   ├── locales/
│   │   ├── en.json           # English translations
│   │   └── pt-br.json         # Portuguese translations
│   ├── App.jsx              # React entry point
│   ├── main.jsx             # Root rendering
│   └── index.css            # Global styles
├── build/
│   └── eternalrecorder.ico  # Application icon
├── dist/                     # Production build output
├── dist_electron/             # Electron build output
├── index.html                 # HTML entry point
├── package.json              # Dependencies and scripts
└── vite.config.js             # Vite configuration
```

---

## Getting Started

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development:
   ```bash
   npm run dev
   ```

### Building for Production

To build the application for Windows:
```bash
npm run build
```

This will generate two installers in `dist_electron/`:
- `Eternal Recorder Setup x.x.x.exe` - NSIS installer
- `Eternal Recorder x.x.x.exe` - Portable executable

---

## Configuration

### Recorder Tab (Screen Recording)

The Recorder tab allows you to configure and start screen recording with camera overlay.

**Available Options:**

1. **Screen Selection**: Choose which screen to record
2. **Camera Source**: Select your camera device
3. **Microphone**: Select your microphone
4. **System Audio**: Toggle to record system audio
5. **Camera Border**: Customize floating camera window border

**Recording Controls:**
- Start Recording: Begins capturing screen and audio
- Pause Recording: Temporarily pause the recording
- Stop Recording: Saves the recording to disk

**Camera Border Options:**
- Primary Color: Choose the main border color
- Gradient Mode: Enable gradient between two colors
- Secondary Color: Choose the second color for gradient
- Neon Glow: Add glowing effect to the border

**Video Format:**
- Currently supports: WebM (VP9/VP8)
- Note: MP4 and MKV formats require transcoding (not yet implemented)

### Settings Tab

Configure application preferences.

**Available Options:**

1. **Language Selection**
   - English
   - Portuguese (Brazil)

### Transmission Tab (Live Streaming)

**Note**: This feature is currently in development. Full RTMP streaming implementation is planned for a future release.

**Available Options:**

1. **Add RTMP Destination**
   - Pre-configured platforms: YouTube, Facebook, Twitch
   - Custom RTMP destinations
   - Each destination requires:
     - Stream URL (RTMP endpoint)
     - Stream Key (channel key)
     - Custom name for identification

2. **Streaming Controls**
   - Start Streaming: Begin streaming to all configured destinations
   - Stop Streaming: Stop streaming to all destinations
   - Individual Destination Control: Start/stop per destination

3. **Active Streams**
   Streams are saved automatically
- Active streams persist across sessions
- Can manage multiple simultaneous streams

---

## Technical Details

### Architecture

**Main Process (Electron)**
- Window management
- IPC communication
- Desktop source enumeration
- File save dialog
- RTMP streaming (planned)

**Renderer Process (React)**
- Tab-based navigation
- i18n support with multiple languages
- MediaRecorder API for screen capture
- AudioContext for audio mixing
- Local storage persistence

### IPC Communication

The application uses Electron's IPC (Inter-Process Communication) for communication between main and renderer processes:

| Channel | Purpose | Direction |
|---------|---------|----------|
| `get-desktop-sources` | Get screen recording sources | Renderer -> Main |
| `save-recording` | Save recorded video buffer | Renderer -> Main |
| `set-camera-source` | Update camera source | Renderer -> Main -> Camera |
| `set-border-color` | Update camera border style | Renderer -> Main -> Camera |
| `resize-camera` | Resize camera window | Renderer -> Main -> Camera |
| `drag-window` | Drag camera window | Renderer -> Main |

---

## Known Limitations

### Recording Format
- Only WebM format is supported natively by MediaRecorder API
- MP4 and MKV formats would require FFmpeg transcoding (not yet implemented)
- To support MP4/MKV, backend transcoding service would be required

### Live Streaming
- Currently displays placeholder UI only
- No actual RTMP streaming implementation
- RTMP server integration planned for future release

### Platform
- Windows only (no macOS/Linux support yet)
- Requires Windows 10 or later

---

## Development

### Scripts

```bash
npm run dev          # Start development server
npm run dev:react    # Start Vite dev server only
npm run dev:electron  # Start Electron only
npm run build          # Build for production
npm run preview       # Preview production build
```

### Technology Stack

- **Electron** v30.0.1 - Desktop framework
- **React** v18.2.0 - UI library
- **Vite** v5.2.0 - Build tool and dev server
- **i18next** v25.10.5 - Internationalization
- **rtmp-server** v0.2.0 - RTMP streaming

---

## Resources

- [Official Documentation](https://www.electronjs.org/docs/)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)

---

## Links

- Website: https://eternal-legend.com.br/eternalrecorder/

---

## Troubleshooting

### Recording Issues
- If screen sources don't load: Try refreshing the application
- If camera doesn't show: Check camera permissions in system settings
- If audio recording fails: Verify audio device permissions
- For best quality: Use wired connection if possible

### Performance
- Close other applications during recording
- Use recommended recording settings
- Ensure sufficient disk space

---

## License

Copyright 2026 Eternal Recorder. All rights reserved.

For more information about usage and redistribution, please visit https://eternal-legend.com.br/

---

## Credits

- Development: eternal legend
- Technologies: Electron, React, Vite, i18next, rtmp-server
- Design: Minimalist, accessible, professional

---

## Future Roadmap

### Planned Features
- Recording history
- Multiple audio device support- Advanced camera effects and filters
- Cloud storage integration
