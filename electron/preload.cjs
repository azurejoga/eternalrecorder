const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
    getWindowSources: () => ipcRenderer.invoke('get-window-sources'),
    saveRecording: (buffer, format) => ipcRenderer.invoke('save-recording', buffer, format),
    setCameraSource: (sourceId) => ipcRenderer.send('set-camera-source', sourceId),
    toggleCameraWindow: (visible) => ipcRenderer.send('toggle-camera-window', visible),
    setBorderColor: (color) => ipcRenderer.send('set-border-color', color),
    resizeCamera: (width) => ipcRenderer.send('resize-camera', width),
    dragWindow: (pos) => ipcRenderer.send('drag-window', pos),
    setVideoFormat: (format) => ipcRenderer.invoke('set-video-format', format),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    onUpdateCameraSource: (callback) => {
        const listener = (event, value) => { callback(value); };
        ipcRenderer.on('update-camera-source', listener);
        return () => ipcRenderer.removeListener('update-camera-source', listener);
    },
    onUpdateBorderColor: (callback) => {
        const listener = (event, value) => { callback(value); };
        ipcRenderer.on('update-border-color', listener);
        return () => ipcRenderer.removeListener('update-border-color', listener);
    },
    onShortcutAction: (callback) => {
        const listener = (event, action) => { callback(action); };
        ipcRenderer.on('shortcut-action', listener);
        return () => ipcRenderer.removeListener('shortcut-action', listener);
    },
    readConfig: (section, key) => ipcRenderer.invoke('read-config', section, key),
    writeConfig: (section, key, value) => ipcRenderer.invoke('write-config', section, key, value),
    getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
    saveShortcuts: (map) => ipcRenderer.invoke('save-shortcuts', map),
    loadRtmpDestinations: () => ipcRenderer.invoke('load-rtmp-destinations'),
    saveRtmpDestinations: (destinations) => ipcRenderer.invoke('save-rtmp-destinations', destinations),
    saveAudioAlongside: (buffer, basePath, suffix, format) => ipcRenderer.invoke('save-audio-alongside', buffer, basePath, suffix, format),
    startRtmpStream: (destId, rtmpUrl, streamKey) => ipcRenderer.invoke('start-rtmp-stream', destId, rtmpUrl, streamKey),
    sendStreamChunk: (destIds, chunk) => ipcRenderer.send('stream-chunk', destIds, chunk),
    stopRtmpStream: (destId) => ipcRenderer.invoke('stop-rtmp-stream', destId),
    stopAllRtmpStreams: () => ipcRenderer.invoke('stop-all-rtmp-streams'),
    onRtmpStreamClosed: (callback) => {
        const listener = (event, destId, code) => callback(destId, code);
        ipcRenderer.on('rtmp-stream-closed', listener);
        return () => ipcRenderer.removeListener('rtmp-stream-closed', listener);
    },
    onSaveProgress: (callback) => {
        const listener = (event, percent) => callback(percent);
        ipcRenderer.on('save-progress', listener);
        return () => ipcRenderer.removeListener('save-progress', listener);
    },
    onDisplayChanged: (callback) => {
        const listener = () => callback();
        ipcRenderer.on('display-changed', listener);
        return () => ipcRenderer.removeListener('display-changed', listener);
    },
    setRecordingStatus: (isRecording) => ipcRenderer.send('set-recording-status', isRecording),
    getRecordingSettings: () => ipcRenderer.invoke('get-recording-settings'),
    saveRecordingSettings: (settings) => ipcRenderer.invoke('save-recording-settings', settings),
    getScenes: () => ipcRenderer.invoke('get-scenes'),
    saveScenes: (scenes) => ipcRenderer.invoke('save-scenes', scenes),
    setDisplayMediaSource: (sourceId) => ipcRenderer.invoke('set-display-media-source', sourceId),
});
