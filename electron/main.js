import { app, BrowserWindow, ipcMain, screen, dialog, globalShortcut, Tray, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import { existsSync, appendFileSync, unlinkSync } from 'fs';
import { spawn } from 'child_process';
import os from 'os';
import crypto from 'crypto';

// ─── Default shortcut accelerators ──────────────────────────────────────────────────────
const DEFAULT_SHORTCUTS = {
    start: 'Control+Shift+R',
    stop: 'Control+Shift+S',
    pause: 'Control+Shift+P',
    mute: 'Control+Shift+M',
    'toggle-audio': 'Control+Shift+A',
    'toggle-window': 'Control+Shift+H'
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── File logger ─────────────────────────────────────────────────────────────
function getLogPath() {
    if (app.isPackaged) {
        // In portable builds PORTABLE_EXECUTABLE_DIR points to the real folder
        // where the user placed the .exe. process.execPath points to the temp
        // extraction directory, which is wrong for persistent log files.
        const dir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
        return path.join(dir, 'log.txt');
    }
    return path.join(__dirname, '..', 'log.txt');
}

function setupLogging() {
    const logPath = getLogPath();
    const ts = () => new Date().toISOString();

    const fmt = (...args) =>
        args.map(a => (a instanceof Error ? a.stack : typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');

    const write = (level, ...args) => {
        try {
            appendFileSync(logPath, `[${ts()}] [${level}] ${fmt(...args)}\n`, 'utf8');
        } catch (_) {}
    };

    const _log   = console.log.bind(console);
    const _warn  = console.warn.bind(console);
    const _error = console.error.bind(console);

    console.log   = (...a) => { _log(...a);   write('INFO',  ...a); };
    console.warn  = (...a) => { _warn(...a);  write('WARN',  ...a); };
    console.error = (...a) => { _error(...a); write('ERROR', ...a); };

    write('INFO', '=== Eternal Recorder started ===');
    write('INFO', `Platform: ${process.platform} | Arch: ${process.arch} | Node: ${process.versions.node}`);
}

setupLogging();

// ─── Chromium flags ────────────────────────────────────────────────────────
// Suppress Chromium internal ERROR-level logs (e.g. wgc_capture_session.cc
// "ProcessFrame failed" spam from getUserMedia WebRTC teardown).
// Level 3 = FATAL only. Node.js console.log() calls are NOT affected.
app.commandLine.appendSwitch('log-level', '3');

// Combine all disable-features into one call
if (process.platform === 'win32') {
    // Disable WGC only for SCREEN/DESKTOP capture (prevents ProcessFrame failed spam).
    // WebRtcAllowWgcWindowCapturer is intentionally kept enabled so WGC can capture
    // individual windows, which DXGI/GDI cannot reliably do on Windows 10/11.
    app.commandLine.appendSwitch('disable-features',
        'WinRTScreenCapturer,WGCDesktopCapturer,WebRtcAllowWgcDesktopCapturer,WebRtcAllowWgcScreenCapturer');
} else {
    app.commandLine.appendSwitch('disable-features',
        'WebRtcAllowWgcDesktopCapturer,WebRtcAllowWgcScreenCapturer');
}

// Set ffmpeg path - handle both development and production (ASAR unpacked)
function getFfmpegPath() {
    // The default path from @ffmpeg-installer (works in development)
    const devPath = ffmpegPath.path;
    console.log('Default FFmpeg path:', devPath);

    // In development, just use the default path
    if (!app.isPackaged) {
        if (existsSync(devPath)) {
            console.log('Using development FFmpeg path:', devPath);
            return devPath;
        }
    }

    // In production, try multiple possible paths where FFmpeg might be unpacked
    const platform = process.platform;
    const arch = process.arch;

    // Platform-specific FFmpeg binary name
    const ffmpegBin = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    // Platform-specific directory name used by @ffmpeg-installer
    const platformDir = platform === 'win32' ? `win32-${arch}` : `linux-${arch}`;

    const possiblePaths = [
        // Standard app.asar.unpacked path
        path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@ffmpeg-installer', platformDir, ffmpegBin),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@ffmpeg-installer', 'ffmpeg', platform, arch, ffmpegBin),
        // Alternative paths
        path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@ffmpeg-installer', platformDir, ffmpegBin),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@ffmpeg-installer', platformDir),
        // Linux system FFmpeg (commonly pre-installed)
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        // Fallback to dev path (might work if not using ASAR)
        devPath
    ];

    for (const possiblePath of possiblePaths) {
        if (existsSync(possiblePath)) {
            console.log('Using production FFmpeg path:', possiblePath);
            return possiblePath;
        }
    }

    console.warn('FFmpeg not found in expected locations, using default - may fail');
    return devPath;
}

// Set ffmpeg path
ffmpeg.setFfmpegPath(getFfmpegPath());

// ─── Helper to get icon path (handles ASAR unpacking) ─────────────────────
function getIconPath() {
    // Helper to convert app.asar -> app.asar.unpacked for assets
    const fixAsarPath = (p) => p.replace(/app\.asar/g, 'app.asar.unpacked');
    
    const possibleIconPaths = [
        path.join(__dirname, '../build/eternalrecorder.ico'),                              // Dev / unpacked
        fixAsarPath(path.join(__dirname, '../build/eternalrecorder.ico')),                 // Dev with asar fix
        path.join(process.resourcesPath, 'app.asar.unpacked', 'build', 'eternalrecorder.ico'), // Unpacked production
        fixAsarPath(path.join(process.resourcesPath, 'app.asar', 'build', 'eternalrecorder.ico')), // Convert asar->unpacked
        path.join(process.resourcesPath, 'build', 'eternalrecorder.ico'),                     // Alternative unpacked
    ];
    
    for (const p of possibleIconPaths) {
        if (existsSync(p)) {
            console.log('Using window icon from:', p);
            return p;
        }
    }
    
    console.warn('Window icon not found, using default');
    return null;
}

// Force sRGB color profile to fix HDR capture issues (blown out whites)
app.commandLine.appendSwitch('force-color-profile', 'srgb');

// ─── Portable Mode / Config ──────────────────────────────────────────────────

function getConfigDir() {
    if (app.isPackaged) {
        // electron-builder portable builds extract to a temp dir; PORTABLE_EXECUTABLE_DIR
        // points to the real folder where the .exe lives so config persists correctly.
        return process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
    }
    return __dirname;
}

function parseIni(content) {
    const config = {};
    let section = 'geral';
    for (const raw of content.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith(';') || line.startsWith('#')) continue;
        if (line.startsWith('[')) {
            section = line.slice(1, line.indexOf(']')).trim();
            if (!config[section]) config[section] = {};
        } else {
            const eq = line.indexOf('=');
            if (eq > 0) {
                const key = line.slice(0, eq).trim();
                const value = line.slice(eq + 1).trim();
                if (!config[section]) config[section] = {};
                config[section][key] = value;
            }
        }
    }
    return config;
}

function stringifyIni(config) {
    const lines = [];
    for (const [section, values] of Object.entries(config)) {
        lines.push(`[${section}]`);
        for (const [key, value] of Object.entries(values)) {
            lines.push(`${key}=${value}`);
        }
        lines.push('');
    }
    return lines.join('\n');
}

async function readConfigFile() {
    const fsp = await import('fs/promises');
    const configPath = path.join(getConfigDir(), 'config.ini');
    try {
        const content = await fsp.readFile(configPath, 'utf8');
        return parseIni(content);
    } catch {
        return {};
    }
}

async function writeConfigFile(config) {
    const fsp = await import('fs/promises');
    const configPath = path.join(getConfigDir(), 'config.ini');
    await fsp.writeFile(configPath, stringifyIni(config), 'utf8');
}

// ─── Encrypted destinations file ────────────────────────────────────────────────────

const DEST_KEY = Buffer.from('eternalrec-dest-key-2024-v1!@#$%&'.slice(0, 32), 'utf8');

function encryptDestinations(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', DEST_KEY, iv);
    const enc = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, enc]).toString('base64');
}

function decryptDestinations(encData) {
    try {
        const buf = Buffer.from(encData, 'base64');
        const iv = buf.subarray(0, 16);
        const enc = buf.subarray(16);
        const decipher = crypto.createDecipheriv('aes-256-cbc', DEST_KEY, iv);
        const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
        return JSON.parse(dec.toString('utf8'));
    } catch {
        return [];
    }
}

// ─── Version file management ───────────────────────────────────────────────────

async function ensureVersionFile() {
    const fsp = await import('fs/promises');
    const versionDir = getConfigDir();
    const versionPath = path.join(versionDir, 'version.txt');
    const currentVersion = app.getVersion();
    try {
        await fsp.access(versionPath);
        // File exists — do nothing
    } catch {
        try {
            await fsp.writeFile(versionPath, currentVersion, 'utf8');
            console.log(`Created version.txt (${currentVersion}) at ${versionPath}`);
        } catch (err) {
            console.error('Failed to create version.txt:', err.message);
        }
    }
}

// ─── Config.ini auto-create ───────────────────────────────────────────────────────────

async function ensureConfigFile() {
    const fsp = await import('fs/promises');
    const configPath = path.join(getConfigDir(), 'config.ini');
    try {
        await fsp.access(configPath);
        // File exists — ensure shortcuts section exists
        const config = await readConfigFile();
        if (!config.shortcuts) {
            config.shortcuts = { ...DEFAULT_SHORTCUTS };
            await writeConfigFile(config);
        }
    } catch {
        // Create with defaults
        const defaults = {
            geral: { idioma: 'en' },
            shortcuts: { ...DEFAULT_SHORTCUTS }
        };
        try {
            await writeConfigFile(defaults);
            console.log('Created config.ini with defaults');
        } catch (err) {
            console.error('Failed to create config.ini:', err.message);
        }
    }
}

// ─── Dynamic shortcuts ─────────────────────────────────────────────────────────────

function toggleControlWindow() {
    if (!controlWindow || controlWindow.isDestroyed()) {
        createControlWindow();
        return;
    }
    if (controlWindow.isVisible()) {
        controlWindow.hide();
    } else {
        controlWindow.show();
        controlWindow.focus();
    }
}

function updateTrayMenu(isRecording = false) {
    if (!tray || tray.isDestroyed()) return;
    const label = isRecording ? '● Gravando' : 'Não gravando';
    const menu = Menu.buildFromTemplate([
        { label: 'Mostrar / Ocultar', click: () => toggleControlWindow() },
        { type: 'separator' },
        { label, enabled: false },
        { type: 'separator' },
        { label: 'Sair', click: () => { app.isQuitting = true; app.quit(); } }
    ]);
    tray.setContextMenu(menu);
    tray.setToolTip(isRecording ? 'Eternal Recorder — Gravando' : 'Eternal Recorder');
}

function createTray() {
    try {
        // Use the same helper function to find the icon
        const iconPath = getIconPath();
        
        if (!iconPath) {
            console.error('Tray icon not found - continuing without tray');
            tray = null;
            return;
        }
        
        console.log('Using tray icon from:', iconPath);
        tray = new Tray(iconPath);
        tray.setToolTip('Eternal Recorder');
        updateTrayMenu(false);
        tray.on('double-click', () => toggleControlWindow());
    } catch (err) {
        console.error('Failed to create tray:', err);
        // Don't crash if tray creation fails
        tray = null;
    }
}

function registerShortcuts(shortcutMap) {
    // Clear existing shortcuts first
    globalShortcut.unregisterAll();
    
    for (const [action, keys] of Object.entries(shortcutMap)) {
        try {
            if (action === 'toggle-window') {
                globalShortcut.register(keys, () => toggleControlWindow());
            } else {
                globalShortcut.register(keys, () => {
                    if (controlWindow && !controlWindow.isDestroyed()) {
                        controlWindow.webContents.send('shortcut-action', action);
                    }
                });
            }
        } catch (e) {
            console.warn(`Could not register shortcut ${keys} for ${action}:`, e.message);
        }
    }
}

async function loadAndRegisterShortcuts() {
    const config = await readConfigFile();
    const saved = config.shortcuts || {};
    const shortcutMap = {};
    for (const [action, defKey] of Object.entries(DEFAULT_SHORTCUTS)) {
        shortcutMap[action] = saved[action] || defKey;
    }
    registerShortcuts(shortcutMap);
    return shortcutMap;
}


// ─── Single Instance Lock ────────────────────────────────────────────────────
// Prevents multiple zombie processes when the user launches the app again
// because they don't see the window (it lives in the system tray).
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    // A running instance already exists — bring it to the foreground and exit.
    app.quit();
    process.exit(0);
}

app.on('second-instance', () => {
    if (controlWindow && !controlWindow.isDestroyed()) {
        if (!controlWindow.isVisible()) controlWindow.show();
        if (controlWindow.isMinimized()) controlWindow.restore();
        controlWindow.focus();
    }
});

let controlWindow;
let cameraWindow;
let tray = null;
app.isQuitting = false;

// ─── Display Media (Electron 30 modern capture) ──────────────────────────────
// Stores the source ID that the renderer wants to capture via getDisplayMedia.
// The handler resolves it so no system picker is shown.
let pendingCaptureSourceId = null;

// Current video format for file extension
let currentVideoFormat = 'webm';

function createControlWindow() {
    controlWindow = new BrowserWindow({
        width: 350, // Slightly wider to ensure fit
        height: 700, // Reduced from 800 to fit standard screens better
        resizable: false, // User requested fixed size
        title: 'Eternal Recorder',
        icon: getIconPath(),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            backgroundThrottling: false,
            preload: path.join(__dirname, 'preload.cjs'),
        },
        autoHideMenuBar: true,
    });

    const startUrl = process.env.NODE_ENV === 'development'
        ? 'http://localhost:5173?window=control'
        : `file://${path.join(__dirname, '../dist/index.html?window=control')}`;

    controlWindow.loadURL(startUrl);

    // Modern Electron 30 display media handler — lets the renderer call
    // getDisplayMedia() with a pre-chosen source ID without showing the OS picker.
    controlWindow.webContents.session.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
            const { desktopCapturer } = await import('electron');
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 0, height: 0 }
            });
            console.log('displayMediaRequestHandler fired, pendingId:', pendingCaptureSourceId, 'sources:', sources.length);
            if (pendingCaptureSourceId) {
                const target = sources.find(s => s.id === pendingCaptureSourceId);
                pendingCaptureSourceId = null;
                if (target) {
                    console.log('displayMediaRequestHandler: resolved to', target.name);
                    callback({ video: target });
                    return;
                }
                console.warn('displayMediaRequestHandler: pendingId not found in sources');
            }
            // Fallback: first screen source
            const screenSrc = sources.find(s => s.id.startsWith('screen:')) || sources[0];
            if (screenSrc) { callback({ video: screenSrc }); }
            else { callback({}); }
        } catch (err) {
            console.error('displayMediaRequestHandler error:', err);
            callback({});
        }
    }, { useSystemPicker: false });

    controlWindow.on('close', async (e) => {
        if (!app.isQuitting) {
            // Read config to determine close behavior
            const config = await readConfigFile();
            const settings = { ...DEFAULT_RECORDING_SETTINGS, ...(config.recording || {}) };
            
            if (settings.closeBehavior === 'tray') {
                // Minimize to tray (hide window)
                e.preventDefault();
                controlWindow.hide();
            } else {
                // Exit completely - let the close happen, but set quitting flag
                app.isQuitting = true;
                // The window will close normally and trigger 'closed' event
            }
        }
    });
    controlWindow.on('closed', () => {
        controlWindow = null;
        // Aggressively close camera window with safety checks
        try {
            if (cameraWindow && !cameraWindow.isDestroyed()) {
                cameraWindow.close();
            }
        } catch (e) {
            console.error('Error closing camera window:', e);
        }
        cameraWindow = null;
    });
}

function createCameraWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize; // workAreaSize excludes taskbar
    const camSize = 250;

    cameraWindow = new BrowserWindow({
        width: camSize,
        height: camSize, // Initial size
        x: width - camSize - 20, // 20px padding from right
        y: height - camSize - 20, // 20px padding from bottom (above taskbar)
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        hasShadow: false,
        resizable: false, // We handle resize via IPC
        skipTaskbar: true,
        show: false, // Don't show automatically - wait for explicit show command
        focusable: false, // Prevent camera window from stealing focus
        icon: getIconPath(),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            preload: path.join(__dirname, 'preload.cjs'),
        },
    });

    cameraWindow.setAlwaysOnTop(true, 'screen-saver');

    const startUrl = process.env.NODE_ENV === 'development'
        ? 'http://localhost:5173?window=camera'
        : `file://${path.join(__dirname, '../dist/index.html?window=camera')}`;

    cameraWindow.loadURL(startUrl);

    // Prevent navigating to new windows (links)
    cameraWindow.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });

    cameraWindow.on('closed', () => {
        cameraWindow = null;
    });
}

app.whenReady().then(() => {
    createControlWindow();

    setTimeout(() => {
        createCameraWindow();
    }, 1000);

    // ─── Startup tasks ───────────────────────────────────────────────────────────────────────────
    createTray();
    ensureVersionFile();
    ensureConfigFile().then(() => loadAndRegisterShortcuts());

    // ─── Monitor change detection ─────────────────────────────────────────────────────────────────
    // Notify the renderer when the display configuration changes so sources can be reloaded
    // and an active recording can warn the user of potential capture failure.
    const notifyDisplayChanged = () => {
        const wins = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
        wins.forEach(w => { try { w.webContents.send('display-changed'); } catch {} });
    };
    screen.on('display-metrics-changed', notifyDisplayChanged);
    screen.on('display-added',           notifyDisplayChanged);
    screen.on('display-removed',         notifyDisplayChanged);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createControlWindow();
            setTimeout(() => { createCameraWindow(); }, 1000);
        }
    });
});

app.on('window-all-closed', () => {
    // App lives in the system tray — only quit when explicitly requested.
    if (process.platform !== 'darwin' && app.isQuitting) {
        // Already quitting — windows just finished closing, force exit
        console.log('All windows closed, forcing exit...');
        // Destroy tray before exit
        if (tray && !tray.isDestroyed()) {
            try { tray.destroy(); } catch {}
            tray = null;
        }
        // Unregister all shortcuts
        try { globalShortcut.unregisterAll(); } catch {}
        // Force exit with increasing aggression
        setTimeout(() => {
            console.log('Calling app.exit(0)...');
            app.exit(0);
        }, 100);
        // Nuclear option: force process exit if app.exit doesn't work
        setTimeout(() => {
            console.log('Nuclear option: process.exit(0)');
            process.exit(0);
        }, 500);
    }
});

// ─── Cleanup before quit ─────────────────────────────────────────────────────
// Fires before windows are closed. Kills orphaned child processes so they
// don't remain in Task Manager after the app exits.
app.on('before-quit', (event) => {
    console.log('before-quit: starting cleanup...');
    app.isQuitting = true;
    
    // Prevent default quit behavior - we'll handle it manually
    // event.preventDefault(); // Don't prevent - just do cleanup
    
    // Remove all close event listeners from windows before destroying them
    // This prevents the 'close' event from calling e.preventDefault()
    BrowserWindow.getAllWindows().forEach(win => {
        try {
            if (!win.isDestroyed()) {
                win.removeAllListeners('close');
            }
        } catch (e) {
            console.error('Error removing listeners:', e);
        }
    });
    
    // Close all windows immediately
    BrowserWindow.getAllWindows().forEach(win => {
        try {
            if (!win.isDestroyed()) {
                win.destroy(); // force close, bypass 'close' event handlers
            }
        } catch (e) {
            console.error('Error destroying window:', e);
        }
    });
    
    // Kill all active RTMP FFmpeg processes
    const entries = [...rtmpStreams.entries()];
    rtmpStreams.clear();
    for (const [, proc] of entries) {
        try { proc.stdin.end(); } catch {}
        try { proc.kill('SIGTERM'); } catch {}
        // Force kill after 200ms if still running (Windows doesn't have SIGKILL, but kill with force)
        setTimeout(() => {
            try { 
                if (!proc.killed) {
                    process.kill(proc.pid, 'SIGKILL'); 
                }
            } catch {}
        }, 200);
    }
    
    // Unregister all global shortcuts immediately
    try { 
        globalShortcut.unregisterAll(); 
        console.log('Global shortcuts unregistered');
    } catch {}
    
    // Destroy tray
    if (tray && !tray.isDestroyed()) {
        try { tray.destroy(); } catch {}
        tray = null;
    }
    
    console.log('before-quit: cleanup complete');
});

app.on('will-quit', () => {
    console.log('will-quit: final cleanup...');
    try { globalShortcut.unregisterAll(); } catch {}
    if (tray && !tray.isDestroyed()) {
        try { tray.destroy(); } catch {}
        tray = null;
    }
});

// Handle unhandled promise rejections to prevent crash on tray icon errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't crash the app
});

// Catch fluent-ffmpeg internal exceptions (e.g. endCB accessing undefined options
// after a failed conversion) and any other synchronous throws from native modules.
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Don't crash the app
});

// IPC handlers

ipcMain.on('set-recording-status', (event, isRecording) => {
    updateTrayMenu(isRecording);
});

const DEFAULT_RECORDING_SETTINGS = {
    fps: '30',
    videoBitrate: '2500',
    audioBitrate: '192',
    resolution: 'source',
    closeBehavior: 'exit' // 'exit' = close completely, 'tray' = minimize to tray
};

ipcMain.handle('get-recording-settings', async () => {
    const config = await readConfigFile();
    return { ...DEFAULT_RECORDING_SETTINGS, ...(config.recording || {}) };
});

ipcMain.handle('save-recording-settings', async (event, settings) => {
    try {
        const config = await readConfigFile();
        config.recording = { ...DEFAULT_RECORDING_SETTINGS, ...settings };
        await writeConfigFile(config);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('get-desktop-sources', async () => {
    try {
        const { desktopCapturer } = await import('electron');
        // Only get screen sources (not windows) to reduce complexity
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 0, height: 0 },
            fetchWindowIcons: false
        });

        // Return minimal data - no thumbnails
        return sources.map(source => ({
            id: source.id,
            name: source.name || 'Screen',
            thumbnail: ''
        }));
    } catch (error) {
        console.error('Failed to get desktop sources:', error);
        return [];
    }
});

ipcMain.handle('get-window-sources', async () => {
    try {
        const { desktopCapturer } = await import('electron');
        const sources = await desktopCapturer.getSources({
            types: ['window'],
            thumbnailSize: { width: 0, height: 0 },
            fetchWindowIcons: false
        });

        console.log('Window sources found:', sources.length, sources.map(s => s.name));

        return sources
            .filter(source => source.name && source.name.trim() !== '')
            .map(source => ({
                id: source.id,
                name: source.name
            }));
    } catch (error) {
        console.error('Failed to get window sources:', error);
        return [];
    }
});

ipcMain.handle('set-display-media-source', (event, sourceId) => {
    pendingCaptureSourceId = sourceId;
    return true;
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

ipcMain.handle('set-video-format', async (event, format) => {
    currentVideoFormat = format;
    return { success: true };
});

ipcMain.handle('save-recording', async (event, buffer, format) => {
    const fsp = await import('fs/promises');

    const actualFormat = format || currentVideoFormat || 'webm';
    console.log('Saving recording with format:', actualFormat);
    const extensionMap = { webm: 'webm', mp4: 'mp4', mkv: 'mkv', mp3: 'mp3', wav: 'wav', flac: 'flac' };
    const extension = extensionMap[actualFormat] || 'webm';

    const { filePath } = await dialog.showSaveDialog({
        buttonLabel: 'Save video',
        defaultPath: `recording-${Date.now()}.${extension}`
    });

    if (!filePath) {
        return { canceled: true };
    }

    try {
        const recConfig = await readConfigFile();
        const recSettings = { ...DEFAULT_RECORDING_SETTINGS, ...(recConfig.recording || {}) };

        const tempDir = os.tmpdir();
        const tempWebmPath = path.join(tempDir, `temp-recording-${Date.now()}.webm`);
        await fsp.writeFile(tempWebmPath, Buffer.from(buffer));

        await convertVideo(tempWebmPath, filePath, actualFormat, recSettings, (pct) => {
            const wins = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
            wins.forEach(w => { try { w.webContents.send('save-progress', pct); } catch {} });
        });

        // Delete temp file with retry (EBUSY fix) - wait for file handles to release
        let unlinkAttempts = 0;
        const maxUnlinkAttempts = 5;
        while (unlinkAttempts < maxUnlinkAttempts) {
            try {
                await fsp.unlink(tempWebmPath);
                console.log('Temp file deleted successfully:', tempWebmPath);
                break;
            } catch (unlinkErr) {
                unlinkAttempts++;
                if (unlinkErr.code === 'EBUSY' && unlinkAttempts < maxUnlinkAttempts) {
                    console.log(`Temp file busy, retrying in 500ms (attempt ${unlinkAttempts}/${maxUnlinkAttempts})...`);
                    await new Promise(r => setTimeout(r, 500));
                } else {
                    console.error('Failed to delete temp file after retries:', unlinkErr);
                    break;
                }
            }
        }
        return { success: true, filePath };
    } catch (error) {
        console.error('Error saving/recording:', error);
        return { success: false, error: error.message };
    }
});

// Helper function to convert video using ffmpeg
function convertVideo(inputPath, outputPath, format, settings, progressCallback) {
    const fps          = parseInt(settings?.fps          || '30',   10);
    const videoBitrate = parseInt(settings?.videoBitrate || '2500', 10);
    const audioBitrate = parseInt(settings?.audioBitrate || '192',  10);
    const resolution   = settings?.resolution || 'source';

    // Build video filter: optional scale + fps (WebM is VFR, MP4/MKV need CFR)
    const vfParts = [];
    if (resolution !== 'source') vfParts.push(`scale=${resolution}`);
    vfParts.push(`fps=${fps}`);
    const vf = vfParts.join(',');

    return new Promise((resolve, reject) => {
        console.log('Processing video:', inputPath, '->', outputPath, 'format:', format);
        const command = ffmpeg(inputPath);

        if (format === 'webm') {
            command.outputOptions([
                '-map 0:v:0',
                '-map 0:a:0?',
                '-c:v copy',
                '-c:a copy'
            ]);
        } else if (format === 'mp4') {
            command.outputOptions([
                '-map 0:v:0',
                '-map 0:a:0?',
                `-vf ${vf}`,
                '-c:v libx264',
                '-preset fast',
                `-b:v ${videoBitrate}k`,
                '-c:a aac',
                '-strict experimental',
                `-b:a ${audioBitrate}k`,
                '-max_muxing_queue_size 9999'
            ]);
        } else if (format === 'mkv') {
            command.outputOptions([
                '-map 0:v:0',
                '-map 0:a:0?',
                `-vf ${vf}`,
                '-c:v libx264',
                '-preset fast',
                `-b:v ${videoBitrate}k`,
                '-c:a aac',
                '-strict experimental',
                `-b:a ${audioBitrate}k`,
                '-max_muxing_queue_size 9999'
            ]);
        } else if (format === 'mp3') {
            command.outputOptions([
                '-vn',
                '-c:a libmp3lame',
                `-b:a ${audioBitrate}k`
            ]);
        } else if (format === 'wav') {
            command.outputOptions([
                '-vn',
                '-c:a pcm_s16le'
            ]);
        } else if (format === 'flac') {
            command.outputOptions([
                '-vn',
                '-c:a flac'
            ]);
        }

        command
            .output(outputPath)
            .on('start', (commandLine) => {
                console.log('FFmpeg command:', commandLine);
            })
            .on('progress', (progress) => {
                const pct = progress.percent ?? 0;
                console.log('Processing progress:', pct > 0 ? `${pct.toFixed(1)}%` : 'processing');
                if (progressCallback) progressCallback(Math.min(pct, 99));
            })
            .on('end', () => {
                console.log('Processing finished successfully:', outputPath);
                resolve();
            })
            .on('error', (err, stdout, stderr) => {
                console.error('Processing error:', err);
                console.error('FFmpeg stderr:', stderr);
                reject(err);
            })
            .run();
    });
}

ipcMain.on('set-camera-source', (event, sourceId) => {
    if (cameraWindow) {
        cameraWindow.webContents.send('update-camera-source', sourceId);
        // Maintain focus on control window to prevent screen reader issues
        if (controlWindow && !controlWindow.isDestroyed()) {
            controlWindow.focus();
        }
    }
});

ipcMain.on('set-border-color', (event, color) => {
    if (cameraWindow) {
        cameraWindow.webContents.send('update-border-color', color);
    }
});

ipcMain.on('resize-camera', (event, width) => {
    if (cameraWindow && !cameraWindow.isDestroyed()) {
        const size = parseInt(width);
        if (Number.isInteger(size) && size >= 100 && size <= 1000) {
            try {
                const bounds = cameraWindow.getBounds();
                const currentRight = bounds.x + bounds.width;
                const currentBottom = bounds.y + bounds.height;

                const newBounds = {
                    x: Math.floor(currentRight - size),
                    y: Math.floor(currentBottom - size),
                    width: size,
                    height: size
                };

                // Prevent off-screen resizes to 0 or weird values
                if (!isNaN(newBounds.x) && !isNaN(newBounds.y)) {
                    cameraWindow.setBounds(newBounds, false);
                }
            } catch (e) {
                console.error("Failed to resize camera window:", e);
            }
        }
    }
});

ipcMain.on('drag-window', (event, { mouseX, mouseY }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
        const { x, y } = screen.getCursorScreenPoint();
        win.setPosition(x - mouseX, y - mouseY);
    }
});

ipcMain.handle('read-config', async (event, section, key) => {
    try {
        const config = await readConfigFile();
        if (section && key) {
            return config[section]?.[key] ?? null;
        }
        if (section) {
            return config[section] ?? null;
        }
        return config;
    } catch (err) {
        console.error('read-config error:', err);
        return null;
    }
});

ipcMain.handle('write-config', async (event, section, key, value) => {
    try {
        const config = await readConfigFile();
        if (!config[section]) config[section] = {};
        config[section][key] = String(value);
        await writeConfigFile(config);
        return { success: true };
    } catch (err) {
        console.error('write-config error:', err);
        return { success: false, error: err.message };
    }
});

// ─── RTMP Streaming ──────────────────────────────────────────────────────────

const rtmpStreams = new Map(); // destId -> ChildProcess

ipcMain.handle('start-rtmp-stream', async (event, destId, rtmpUrl, streamKey) => {
    try {
        if (rtmpStreams.has(destId)) {
            const old = rtmpStreams.get(destId);
            try { old.stdin.end(); } catch {}
            try { old.kill('SIGTERM'); } catch {}
            rtmpStreams.delete(destId);
        }

        const fullUrl = streamKey ? `${rtmpUrl.replace(/\/$/, '')}/${streamKey}` : rtmpUrl;
        const ffmpegBin = getFfmpegPath();

        const args = [
            '-loglevel', 'warning',
            '-fflags', '+discardcorrupt+nobuffer',
            '-thread_queue_size', '512',
            '-f', 'webm',
            '-i', 'pipe:0',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-tune', 'zerolatency',
            '-b:v', '2000k',
            '-maxrate', '2500k',
            '-bufsize', '4000k',
            '-pix_fmt', 'yuv420p',
            '-g', '60',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-ar', '44100',
            '-ac', '2',
            '-af', 'aresample=async=1:min_hard_comp=0.100000:first_pts=0',
            '-max_muxing_queue_size', '9999',
            '-f', 'flv',
            fullUrl
        ];

        const proc = spawn(ffmpegBin, args, { stdio: ['pipe', 'pipe', 'pipe'] });

        proc.stderr.on('data', (d) => console.log(`[RTMP:${destId}]`, d.toString().trim()));

        proc.on('close', (code) => {
            if (!rtmpStreams.has(destId)) return; // already handled by stop-rtmp-stream
            const exitCode = code ?? 0;
            console.log(`[RTMP:${destId}] closed, code=${exitCode}`);
            rtmpStreams.delete(destId);
            const wins = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed());
            wins.forEach(w => w.webContents.send('rtmp-stream-closed', destId, exitCode));
        });

        proc.on('error', (err) => {
            console.error(`[RTMP:${destId}] spawn error:`, err.message);
            rtmpStreams.delete(destId);
        });

        rtmpStreams.set(destId, proc);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.on('stream-chunk', (event, destIds, chunk) => {
    if (!Array.isArray(destIds) || !chunk) return;
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    for (const destId of destIds) {
        const proc = rtmpStreams.get(destId);
        if (proc && proc.stdin.writable) {
            try { proc.stdin.write(buf); } catch (err) {
                console.error(`[RTMP:${destId}] write error:`, err.message);
            }
        }
    }
});

ipcMain.handle('stop-rtmp-stream', async (event, destId) => {
    const proc = rtmpStreams.get(destId);
    if (proc) {
        rtmpStreams.delete(destId); // delete first so 'close' guard skips duplicate notify
        try { proc.stdin.end(); } catch {}
        try { proc.kill('SIGTERM'); } catch {}
    }
    return { success: true };
});

ipcMain.handle('save-audio-alongside', async (event, buffer, basePath, suffix, format) => {
    const fsp = await import('fs/promises');
    try {
        const dir = path.dirname(basePath);
        const base = path.basename(basePath, path.extname(basePath));
        const outputPath = path.join(dir, `${base}-${suffix}.${format}`);
        const tempDir = os.tmpdir();
        const tempPath = path.join(tempDir, `temp-audio-${Date.now()}.webm`);
        await fsp.writeFile(tempPath, Buffer.from(buffer));
        await convertVideo(tempPath, outputPath, format, {}, null);
        await fsp.unlink(tempPath).catch(() => {});
        console.log(`Saved audio alongside: ${outputPath}`);
        return { success: true, filePath: outputPath };
    } catch (err) {
        console.error('save-audio-alongside error:', err.message);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('stop-all-rtmp-streams', async () => {
    const entries = [...rtmpStreams.entries()];
    rtmpStreams.clear(); // clear first so 'close' guard skips duplicate notify
    for (const [, proc] of entries) {
        try { proc.stdin.end(); } catch {}
        try { proc.kill('SIGTERM'); } catch {}
    }
    return { success: true };
});

ipcMain.handle('load-rtmp-destinations', async () => {
    const fsp = await import('fs/promises');
    const destPath = path.join(getConfigDir(), 'destinations.dat');
    try {
        const data = await fsp.readFile(destPath, 'utf8');
        return decryptDestinations(data);
    } catch {
        return [];
    }
});

ipcMain.handle('save-rtmp-destinations', async (event, destinations) => {
    const fsp = await import('fs/promises');
    const destPath = path.join(getConfigDir(), 'destinations.dat');
    try {
        const encrypted = encryptDestinations(destinations);
        await fsp.writeFile(destPath, encrypted, 'utf8');
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('get-shortcuts', async () => {
    const config = await readConfigFile();
    const saved = config.shortcuts || {};
    return { ...DEFAULT_SHORTCUTS, ...saved };
});

ipcMain.handle('save-shortcuts', async (event, shortcutMap) => {
    try {
        const config = await readConfigFile();
        config.shortcuts = shortcutMap;
        await writeConfigFile(config);
        registerShortcuts(shortcutMap);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.on('toggle-camera-window', (event, visible) => {
    if (cameraWindow && !cameraWindow.isDestroyed()) {
        if (visible) {
            cameraWindow.show();
            // Don't steal focus from control panel - important for screen readers
            cameraWindow.blur();
            cameraWindow.setFocusable(false);
        } else {
            cameraWindow.hide();
        }
    }
});

// ─── Scenes persistence ──────────────────────────────────────────────────────

ipcMain.handle('get-scenes', async () => {
    const fsp = await import('fs/promises');
    const scenesPath = path.join(getConfigDir(), 'scenes.json');
    try {
        const data = await fsp.readFile(scenesPath, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
});

ipcMain.handle('save-scenes', async (event, scenes) => {
    const fsp = await import('fs/promises');
    const scenesPath = path.join(getConfigDir(), 'scenes.json');
    try {
        await fsp.writeFile(scenesPath, JSON.stringify(scenes, null, 2), 'utf8');
        return { success: true };
    } catch (err) {
        console.error('save-scenes error:', err.message);
        return { success: false, error: err.message };
    }
});
