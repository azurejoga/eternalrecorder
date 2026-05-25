import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const RecorderTab = () => {
  const { t } = useTranslation();

  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [captureMode, setCaptureMode] = useState('screen');
  const [desktopSources, setDesktopSources] = useState([]);
  const [selectedDesktopSource, setSelectedDesktopSource] = useState(null);
  const [windowSources, setWindowSources] = useState([]);
  const [selectedWindowSource, setSelectedWindowSource] = useState(null);

  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [useCamera, setUseCamera] = useState(true);

  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState('');
  const [recordSystemAudio, setRecordSystemAudio] = useState(false);

  const [borderColor, setBorderColor] = useState('#00f2fe');
  const [hasGradient, setHasGradient] = useState(false);
  const [borderColor2, setBorderColor2] = useState('#ff0055');
  const [isNeon, setIsNeon] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordedBufferRef = useRef(null);
  const lastDataTimestampRef = useRef(0);
  const micGainNodeRef = useRef(null);

  const canvasRef = useRef(null);
  const screenVideoElRef = useRef(null);
  const cameraVideoElRef = useRef(null);
  const animFrameRef = useRef(null);
  const activeLiveSceneRef = useRef(null);
  const liveScreenStreamRef = useRef(null);
  const liveCamStreamRef = useRef(null);
  const liveMicStreamRef = useRef(null);
  const liveAudioCtxRef = useRef(null);
  const switchLiveSceneFnRef = useRef(null);

  const systemAudioRecorderRef = useRef(null);
  const micAudioRecorderRef = useRef(null);
  const systemAudioChunksRef = useRef([]);
  const micAudioChunksRef = useRef([]);

  const shortcutHandlers = useRef({});
  shortcutHandlers.current = { isRecording, isPaused };

  // Refs for accessibility focus management
  const loadScreensButtonRef = useRef(null);
  const startRecordingButtonRef = useRef(null);
  const dialogContainerRef = useRef(null);

  const [audioOnlyMode, setAudioOnlyMode] = useState(false);
  const [cameraOnlyMode, setCameraOnlyMode] = useState(false);
  const [multiAudioMode, setMultiAudioMode] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const [elapsedTime, setElapsedTime] = useState(0);
  const recordingStartTimeRef = useRef(null);
  const pausedElapsedRef = useRef(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState('webm');

  const [scenes, setScenes] = useState([]);
  const [sceneMode, setSceneMode] = useState(() => localStorage.getItem('sceneMode') === 'true');
  const [activeLiveSceneId, setActiveLiveSceneId] = useState(null);
  const [showSceneForm, setShowSceneForm] = useState(false);
  const [sceneFormName, setSceneFormName] = useState('');

  const getSceneLayout = (scene) => {
    if (!scene) return 'screen';
    if (scene.audioOnlyMode) return 'audio';
    if (scene.cameraOnlyMode) return 'camera';
    if (scene.useCamera) return 'screen+camera';
    return 'screen';
  };

  const getSceneLayoutIcon = (scene) => {
    const l = getSceneLayout(scene);
    if (l === 'audio') return '\uD83C\uDFA4';
    if (l === 'camera') return '\uD83D\uDCF7';
    if (l === 'screen+camera') return '\uD83D\uDDA5\uFE0F\uD83D\uDCF7';
    return '\uD83D\uDDA5\uFE0F';
  };

  const formatDuration = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  // Get video format from localStorage (only WebM is supported by MediaRecorder API)
  const getVideoMimeType = () => {
    // Use VP8 for better compatibility and stability (less corruption issues)
    // VP9 can cause corruption in some Chromium builds
    if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8')) {
      return 'video/webm; codecs=vp8';
    }
    // Fallback to VP9 if VP8 not supported
    if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
      return 'video/webm; codecs=vp9';
    }
    // Final fallback - basic webm
    return 'video/webm';
  };

  // Load devices with delay to avoid IPC crash on startup
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === 'videoinput');
        const mics = devices.filter(d => d.kind === 'audioinput');

        setCameraDevices(cameras);
        // if (cameras.length > 0) setSelectedCamera(cameras[0].deviceId); // Don't auto-select to avoid IPC

        setAudioDevices(mics);
        if (mics.length > 0) setSelectedAudio(mics[0].deviceId); // Auto-select first real device
      } catch (err) {
        console.error('Error loading devices:', err);
      }
    }, 1000); // 1 second delay to let Electron fully initialize

    return () => clearTimeout(timer);
  }, []);

  // ─ Recording duration timer ────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) {
      setElapsedTime(0);
      recordingStartTimeRef.current = null;
      pausedElapsedRef.current = 0;
      return;
    }
    if (isPaused) {
      pausedElapsedRef.current = elapsedTime;
      return;
    }
    const base = Date.now() - pausedElapsedRef.current * 1000;
    recordingStartTimeRef.current = base;
    const id = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - base) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [isRecording, isPaused]);

  // ─ Save-progress listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!window.electronAPI?.onSaveProgress) return;
    return window.electronAPI.onSaveProgress((pct) => setSaveProgress(pct ?? 0));
  }, []);

  // ─ Display change detection ────────────────────────────────────────────────
  // When a monitor is connected/disconnected or resolution changes, DXGI/WGC
  // capture can break. Auto-reload sources and warn the user if recording.
  useEffect(() => {
    if (!window.electronAPI?.onDisplayChanged) return;
    return window.electronAPI.onDisplayChanged(() => {
      reloadSources();
      if (isRecording) {
        setStatusMessage(t('recorder.displayChangedWarning'));
      }
    });
  }, [isRecording]);

  // ─ Global shortcut handler ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.electronAPI?.onShortcutAction) return;
    return window.electronAPI.onShortcutAction((action) => {
      const { isRecording, isPaused } = shortcutHandlers.current;
      switch (action) {
        case 'start':        if (!isRecording) handleStartRef.current?.(); break;
        case 'stop':         if (isRecording)  handleStopRef.current?.();  break;
        case 'pause':        if (isRecording)  handlePauseResumeRef.current?.(); break;
        case 'mute':         handleMuteMicRef.current?.(); break;
        case 'toggle-audio': setRecordSystemAudio(prev => !prev); break;
        default: break;
      }
    });
  }, []);

  const handleStartRef = useRef(null);
  const handleStopRef = useRef(null);
  const handlePauseResumeRef = useRef(null);
  const handleMuteMicRef = useRef(null);
  const applySceneHandlerRef = useRef(null);
  const switchSceneHandlerRef = useRef(null);

  // Load saved scenes on mount
  useEffect(() => {
    if (!window.electronAPI?.getScenes) return;
    window.electronAPI.getScenes().then(s => setScenes(s || [])).catch(() => {});
  }, []);

  // Persist sceneMode
  useEffect(() => { localStorage.setItem('sceneMode', sceneMode); }, [sceneMode]);

  // Keep a snapshot of current settings so ScenesTab can read them when saving a new scene
  useEffect(() => {
    window.__recorderSnapshot = {
      captureMode, selectedDesktopSource, selectedWindowSource,
      useCamera, selectedCamera, cameraOnlyMode, audioOnlyMode,
      multiAudioMode, selectedAudio, recordSystemAudio,
      borderColor, hasGradient, borderColor2, isNeon, selectedFormat,
    };
  }, [captureMode, selectedDesktopSource, selectedWindowSource, useCamera, selectedCamera,
      cameraOnlyMode, audioOnlyMode, multiAudioMode, selectedAudio, recordSystemAudio,
      borderColor, hasGradient, borderColor2, isNeon, selectedFormat]);

  // Broadcast recording state so ScenesTab can show live-switch UI
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('recorder:state', { detail: { isRecording, activeLiveSceneId } }));
  }, [isRecording, activeLiveSceneId]);

  // Listen for events dispatched by ScenesTab
  useEffect(() => {
    const onApply = (e) => applySceneHandlerRef.current?.(e.detail);
    const onSwitch = (e) => switchSceneHandlerRef.current?.(e.detail);
    const onScenesUpdated = () => {
      window.electronAPI?.getScenes?.().then(s => setScenes(s || [])).catch(() => {});
    };
    window.addEventListener('scenes:apply', onApply);
    window.addEventListener('scenes:switch', onSwitch);
    window.addEventListener('scenesUpdated', onScenesUpdated);
    return () => {
      window.removeEventListener('scenes:apply', onApply);
      window.removeEventListener('scenes:switch', onSwitch);
      window.removeEventListener('scenesUpdated', onScenesUpdated);
    };
  }, []);

  // Reset format when switching audio-only / camera-only mode
  useEffect(() => {
    setSelectedFormat(audioOnlyMode ? 'mp3' : 'webm');
  }, [audioOnlyMode, cameraOnlyMode]);

  // Camera-only mode implies camera must be on
  useEffect(() => {
    if (cameraOnlyMode) setUseCamera(true);
  }, [cameraOnlyMode]);

  // ─ Auto-load desktop and window sources on mount (with delay to avoid Electron bug #46369)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadDesktopSources();
      loadWindowSources();
    }, 1500); // 1.5 second delay to ensure Electron is fully initialized

    return () => clearTimeout(timer);
  }, []);

  // Load desktop sources on demand (to avoid Electron bug #46369)
  const loadDesktopSources = async () => {
    if (!window.electronAPI) return;

    const activeElement = document.activeElement;

    try {
      const d_sources = await window.electronAPI.getDesktopSources();
      setDesktopSources(d_sources || []);
      if (d_sources && d_sources.length > 0) setSelectedDesktopSource(d_sources[0].id);

      setTimeout(() => {
        if (activeElement && typeof activeElement.focus === 'function') {
          activeElement.focus();
        }
      }, 50);
    } catch (err) {
      console.error('Error loading desktop sources:', err);
    }
  };

  const loadWindowSources = async () => {
    if (!window.electronAPI) return;
    try {
      const w_sources = await window.electronAPI.getWindowSources();
      setWindowSources(w_sources || []);
      if (w_sources && w_sources.length > 0) setSelectedWindowSource(w_sources[0].id);
    } catch (err) {
      console.error('Error loading window sources:', err);
    }
  };

  const reloadSources = async () => {
    await loadDesktopSources();
    await loadWindowSources();
  };

  // Sync Camera Selections (only when camera is enabled)
  const prevCameraRef = useRef(null);

  useEffect(() => {
    if (!window.electronAPI) return;

    const prevCamera = prevCameraRef.current;

    // Hide camera window when camera is disabled
    if (!useCamera) {
      // Only hide if it was previously shown
      if (prevCamera !== null) {
        window.electronAPI.toggleCameraWindow(false);
      }
      prevCameraRef.current = null;
    }
    // Show camera window and set source when camera is enabled and source is selected
    else if (useCamera && selectedCamera) {
      // Only update if camera actually changed
      if (prevCamera !== selectedCamera) {
        window.electronAPI.setCameraSource(selectedCamera);
        window.electronAPI.toggleCameraWindow(true);
      }
      prevCameraRef.current = selectedCamera;
    }
    // Hide camera window when camera is enabled but no source selected
    else {
      if (prevCamera !== null) {
        window.electronAPI.toggleCameraWindow(false);
      }
      prevCameraRef.current = null;
    }
  }, [selectedCamera, useCamera]);

  useEffect(() => {
    // Send complex object instead of just string
    if (window.electronAPI) {
      window.electronAPI.setBorderColor({
        color1: borderColor,
        color2: borderColor2,
        isGradient: hasGradient,
        isNeon: isNeon
      });
    }
  }, [borderColor, borderColor2, hasGradient, isNeon]);


  const handleMuteMic = () => {
    setMicMuted(prev => {
      const newMuted = !prev;
      if (micGainNodeRef.current) {
        micGainNodeRef.current.gain.value = newMuted ? 0 : 1;
      }
      return newMuted;
    });
  };
  handleMuteMicRef.current = handleMuteMic;

  const playBeep = (frequency, duration) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration / 1000);
      osc.onended = () => ctx.close();
    } catch (e) {
      console.warn('Beep failed:', e);
    }
  };

  const handleStart = async () => {
    if (audioOnlyMode) {
      await handleStartAudioOnly();
      return;
    }
    if (cameraOnlyMode) {
      await handleStartCameraOnly();
      return;
    }
    if (sceneMode && scenes.length > 0) {
      await handleStartWithLiveScenes(scenes);
      return;
    }
    const activeSourceId = captureMode === 'window' ? selectedWindowSource : selectedDesktopSource;
    if (!activeSourceId) return;

    // Maintain focus on the button to prevent focus loss
    const activeElement = document.activeElement;

    try {
      // 1. Capture Screen/Window (Video only — audio mixed separately below)
      // For screen mode: request system audio inline via chromeMediaSource.
      // For window mode: system audio must come from a separate desktop capture
      //   because chromeMediaSource audio is tied to the full desktop, not a window.
      const isWindowMode = captureMode === 'window';
      const canRequestDesktopAudio = recordSystemAudio && !isWindowMode;
      // Register the source so Electron 30 setDisplayMediaRequestHandler can resolve it
      await window.electronAPI?.setDisplayMediaSource?.(activeSourceId);

      const screenConstraints = {
        audio: canRequestDesktopAudio ? {
          mandatory: {
            chromeMediaSource: 'desktop'
          }
        } : false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: activeSourceId,
          }
        }
      };

      let screenStream;
      try {
        screenStream = await navigator.mediaDevices.getUserMedia(screenConstraints);
      } catch (getUserMediaErr) {
        console.error('[capture] getUserMedia failed:', getUserMediaErr.message, '| mode:', captureMode, '| sourceId:', activeSourceId);
        if (isWindowMode) {
          // getUserMedia failed for window source (common with DXGI fallback on Electron 30).
          // Re-register source and try the modern getDisplayMedia path instead.
          console.log('[capture] Falling back to getDisplayMedia for window source');
          await window.electronAPI?.setDisplayMediaSource?.(activeSourceId);
          screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: false
          });
          console.log('[capture] getDisplayMedia succeeded, tracks:', screenStream.getTracks().length);
        } else {
          throw getUserMediaErr;
        }
      }

      // Detect if capture drops mid-recording (GPU reset, window closed, DXGI failure)
      screenStream.getVideoTracks().forEach(track => {
        track.onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            setStatusMessage(t('recorder.captureFailedWarning'));
          }
        };
      });

      // 1b. Window mode + system audio: capture audio from a desktop source separately
      let windowSysAudioStream = null;
      if (isWindowMode && recordSystemAudio && desktopSources.length > 0) {
        try {
          const deskSrcId = selectedDesktopSource || desktopSources[0].id;
          windowSysAudioStream = await navigator.mediaDevices.getUserMedia({
            audio: { mandatory: { chromeMediaSource: 'desktop' } },
            video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: deskSrcId } }
          });
          windowSysAudioStream.getVideoTracks().forEach(t => t.stop());
        } catch (sysErr) {
          console.warn('System audio capture for window mode failed:', sysErr);
        }
      }

      // 2. Capture Microphone (if selected)
      let micStream = null;
      if (selectedAudio) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: selectedAudio } },
            video: false
          });
        } catch (err) {
          console.error("Failed to get microphone stream:", err);
          // Don't fail the whole recording if mic fails
        }
      }

      // 3. Mix audio tracks
      const tracks = [...screenStream.getVideoTracks()];
      let combinedStream = screenStream;

      if (micStream || canRequestDesktopAudio || windowSysAudioStream) {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const dest = audioContext.createMediaStreamDestination();
          let hasAnyAudio = false;

          if (canRequestDesktopAudio && screenStream.getAudioTracks().length > 0) {
            const sysSource = audioContext.createMediaStreamSource(screenStream);
            sysSource.connect(dest);
            hasAnyAudio = true;
          }

          if (windowSysAudioStream && windowSysAudioStream.getAudioTracks().length > 0) {
            audioContext.createMediaStreamSource(windowSysAudioStream).connect(dest);
            hasAnyAudio = true;
          }

          if (micStream && micStream.getAudioTracks().length > 0) {
            const micSource = audioContext.createMediaStreamSource(micStream);
            micSource.connect(dest);
            hasAnyAudio = true;
          }

          if (hasAnyAudio) {
            tracks.push(...dest.stream.getAudioTracks());
            combinedStream = new MediaStream(tracks);
          }
        } catch (audioErr) {
          console.error("Audio mixing failed, falling back to screen audio/no audio:", audioErr);
        }
      }

      // 3b. Multi-audio: separate recorders for system audio and mic
      if (multiAudioMode) {
        systemAudioChunksRef.current = [];
        micAudioChunksRef.current = [];
        const audioMime = MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
          ? 'audio/webm; codecs=opus' : 'audio/webm';

        if (canRequestDesktopAudio && screenStream.getAudioTracks().length > 0) {
          try {
            const sysAudioStream = new MediaStream(screenStream.getAudioTracks());
            const sysRec = new MediaRecorder(sysAudioStream, { mimeType: audioMime });
            sysRec.ondataavailable = (e) => { if (e.data?.size > 0) systemAudioChunksRef.current.push(e.data); };
            sysRec.start(5000);
            systemAudioRecorderRef.current = sysRec;
          } catch (err) { console.error('System audio recorder failed:', err); }
        }
        if (windowSysAudioStream && windowSysAudioStream.getAudioTracks().length > 0) {
          try {
            const sysAudioStream = new MediaStream(windowSysAudioStream.getAudioTracks());
            const sysRec = new MediaRecorder(sysAudioStream, { mimeType: audioMime });
            sysRec.ondataavailable = (e) => { if (e.data?.size > 0) systemAudioChunksRef.current.push(e.data); };
            sysRec.start(5000);
            systemAudioRecorderRef.current = sysRec;
          } catch (err) { console.error('System audio recorder failed (window mode):', err); }
        }

        if (micStream && micStream.getAudioTracks().length > 0) {
          try {
            const micAudioStream = new MediaStream(micStream.getAudioTracks());
            const micRec = new MediaRecorder(micAudioStream, { mimeType: audioMime });
            micRec.ondataavailable = (e) => { if (e.data?.size > 0) micAudioChunksRef.current.push(e.data); };
            micRec.start(5000);
            micAudioRecorderRef.current = micRec;
          } catch (err) { console.error('Mic audio recorder failed:', err); }
        }
      }

      const mimeType = getVideoMimeType();

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8000000
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
          lastDataTimestampRef.current = Date.now();
        }
      };

      mediaRecorder.onstop = async () => {
        // 1. Request final data chunk to ensure proper flush
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            try {
                mediaRecorder.requestData();
            } catch (err) {
                console.warn('requestData() not supported, continuing...');
            }
        }

        // 2. Wait for flush (300ms ensures complete buffer flush)
        await new Promise(resolve => setTimeout(resolve, 300));

        // 3. Cleanup all streams
        [screenStream, micStream, windowSysAudioStream].forEach(s => {
          if (s) s.getTracks().forEach(t => t.stop());
        });

        // Verify we have valid chunks before creating blob
        if (chunksRef.current.length === 0) {
          console.warn('No chunks collected, recording may have failed');
          return;
        }

        const mimeType = getVideoMimeType();
        const blob = new Blob(chunksRef.current, { type: mimeType });

        // 4. Verify blob size is reasonable (at least 1KB)
        if (blob.size < 1024) {
          console.warn('Blob is too small (< 1KB), recording may have failed');
          return;
        }

        const buffer = await blob.arrayBuffer();
        // Store buffer for later use when format is selected
        recordedBufferRef.current = buffer;
        chunksRef.current = [];
        lastDataTimestampRef.current = 0;
      };

      // Detect unexpected capture failure (DXGI/WGC track drop)
      screenStream.getVideoTracks().forEach(track => {
        track.onended = () => {
          if (mediaRecorderRef.current?.state !== 'inactive') {
            setStatusMessage(t('recorder.captureFailedWarning'));
          }
        };
      });

      // Use larger slice (5 seconds) for better stability and less corruption
      mediaRecorder.start(5000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      window.electronAPI?.setRecordingStatus(true);
      playBeep(880, 200);
      setStatusMessage(t('recorder.statusRecordingStarted'));

      if (activeElement && typeof activeElement.focus === 'function') {
        activeElement.focus();
      }
    } catch (e) {
      console.error("Failed to start recording", e);
      alert(t('recorder.errorStartingRecording', { message: e.message }));
      setIsRecording(false);
      window.electronAPI?.setRecordingStatus(false);
    }
  };
  handleStartRef.current = handleStart;

  const handleStartCameraOnly = async () => {
    if (!selectedCamera) return;
    const activeElement = document.activeElement;
    try {
      // 1. Capture webcam at high resolution
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedCamera }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });

      // 2. Capture Microphone (if selected)
      let micStream = null;
      if (selectedAudio) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: selectedAudio } }, video: false
          });
        } catch (err) {
          console.error('Failed to get microphone stream:', err);
        }
      }

      // 3. Mix audio tracks
      const tracks = [...camStream.getVideoTracks()];
      let combinedStream = camStream;

      if (micStream) {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const dest = audioContext.createMediaStreamDestination();
          const micSource = audioContext.createMediaStreamSource(micStream);
          const gainNode = audioContext.createGain();
          gainNode.gain.value = micMuted ? 0 : 1;
          micSource.connect(gainNode);
          gainNode.connect(dest);
          micGainNodeRef.current = gainNode;
          tracks.push(...dest.stream.getAudioTracks());
          combinedStream = new MediaStream(tracks);
        } catch (audioErr) {
          console.error('Audio mixing failed:', audioErr);
        }
      }

      // 3b. Multi-audio: separate recorder for mic
      if (multiAudioMode && micStream) {
        micAudioChunksRef.current = [];
        const audioMime = MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
          ? 'audio/webm; codecs=opus' : 'audio/webm';
        try {
          const micAudioStream = new MediaStream(micStream.getAudioTracks());
          const micRec = new MediaRecorder(micAudioStream, { mimeType: audioMime });
          micRec.ondataavailable = (e) => { if (e.data?.size > 0) micAudioChunksRef.current.push(e.data); };
          micRec.start(5000);
          micAudioRecorderRef.current = micRec;
        } catch (err) { console.error('Mic audio recorder failed:', err); }
      }

      const mimeType = getVideoMimeType();
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8000000
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
          lastDataTimestampRef.current = Date.now();
        }
      };

      mediaRecorder.onstop = async () => {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          try { mediaRecorder.requestData(); } catch {}
        }
        await new Promise(resolve => setTimeout(resolve, 300));
        [camStream, micStream].forEach(s => {
          if (s) s.getTracks().forEach(t => t.stop());
        });
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1024) return;
        recordedBufferRef.current = await blob.arrayBuffer();
        chunksRef.current = [];
        lastDataTimestampRef.current = 0;
      };

      mediaRecorder.start(5000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      window.electronAPI?.setRecordingStatus(true);
      playBeep(880, 200);
      setStatusMessage(t('recorder.statusRecordingStarted'));
      if (activeElement?.focus) activeElement.focus();
    } catch (e) {
      console.error('Failed to start camera-only recording', e);
      alert(t('recorder.errorStartingRecording', { message: e.message }));
      setIsRecording(false);
      window.electronAPI?.setRecordingStatus(false);
    }
  };

  const handleStartAudioOnly = async () => {
    const activeElement = document.activeElement;
    try {
      let sysStream = null;
      let micStream = null;

      if (recordSystemAudio && desktopSources.length > 0) {
        const srcId = selectedDesktopSource || desktopSources[0].id;
        sysStream = await navigator.mediaDevices.getUserMedia({
          audio: { mandatory: { chromeMediaSource: 'desktop' } },
          video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: srcId } }
        });
        sysStream.getVideoTracks().forEach(t => t.stop());
      }

      if (selectedAudio) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: selectedAudio } }, video: false
          });
        } catch (err) {
          console.error('Mic capture failed:', err);
        }
      }

      if (!sysStream && !micStream) throw new Error('No audio source available');

      // Mix all sources through a single AudioContext so MediaRecorder gets one clean track
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();

      if (sysStream && sysStream.getAudioTracks().length > 0) {
        audioCtx.createMediaStreamSource(sysStream).connect(dest);
      }

      if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = audioCtx.createMediaStreamSource(micStream);
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = micMuted ? 0 : 1;
        micSource.connect(gainNode);
        gainNode.connect(dest);
        micGainNodeRef.current = gainNode;
      }

      const audioMime = MediaRecorder.isTypeSupported('audio/webm; codecs=opus')
        ? 'audio/webm; codecs=opus' : 'audio/webm';

      // Multi-audio: separate recorders for system + mic
      if (multiAudioMode) {
        systemAudioChunksRef.current = [];
        micAudioChunksRef.current = [];
        if (sysStream && sysStream.getAudioTracks().length > 0) {
          try {
            const sysRec = new MediaRecorder(new MediaStream(sysStream.getAudioTracks()), { mimeType: audioMime });
            sysRec.ondataavailable = (e) => { if (e.data?.size > 0) systemAudioChunksRef.current.push(e.data); };
            sysRec.start(5000);
            systemAudioRecorderRef.current = sysRec;
          } catch (err) { console.error('System audio recorder failed:', err); }
        }
        if (micStream && micStream.getAudioTracks().length > 0) {
          try {
            const micRec = new MediaRecorder(new MediaStream(micStream.getAudioTracks()), { mimeType: audioMime });
            micRec.ondataavailable = (e) => { if (e.data?.size > 0) micAudioChunksRef.current.push(e.data); };
            micRec.start(5000);
            micAudioRecorderRef.current = micRec;
          } catch (err) { console.error('Mic audio recorder failed:', err); }
        }
      }

      // Record the single mixed stream from AudioContext destination
      const mediaRecorder = new MediaRecorder(dest.stream, { mimeType: audioMime });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        await new Promise(r => setTimeout(r, 300));
        if (sysStream) sysStream.getTracks().forEach(t => t.stop());
        if (micStream) micStream.getTracks().forEach(t => t.stop());
        audioCtx.close();
        micGainNodeRef.current = null;
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: audioMime });
        if (blob.size < 512) return;
        recordedBufferRef.current = await blob.arrayBuffer();
        chunksRef.current = [];
      };

      mediaRecorder.start(5000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      window.electronAPI?.setRecordingStatus(true);
      playBeep(880, 200);
      setStatusMessage(t('recorder.statusRecordingStarted'));
      if (activeElement?.focus) activeElement.focus();
    } catch (e) {
      console.error('Failed to start audio-only recording', e);
      alert(t('recorder.errorStartingRecording', { message: e.message }));
      setIsRecording(false);
      window.electronAPI?.setRecordingStatus(false);
    }
  };

  const handleStop = () => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    const stopStreamsRef = (ref) => {
      const v = ref.current;
      if (Array.isArray(v)) v.forEach(s => s?.getTracks().forEach(t => t.stop()));
      else v?.getTracks().forEach(t => t.stop());
      ref.current = null;
    };
    stopStreamsRef(liveScreenStreamRef);
    stopStreamsRef(liveCamStreamRef);
    stopStreamsRef(liveMicStreamRef);
    if (screenVideoElRef.current) { screenVideoElRef.current.srcObject = null; screenVideoElRef.current = null; }
    if (cameraVideoElRef.current) { cameraVideoElRef.current.srcObject = null; cameraVideoElRef.current = null; }
    liveAudioCtxRef.current?.close().catch(() => {}); liveAudioCtxRef.current = null;
    switchLiveSceneFnRef.current = null;
    canvasRef.current = null;
    activeLiveSceneRef.current = null;
    setActiveLiveSceneId(null);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (systemAudioRecorderRef.current && systemAudioRecorderRef.current.state !== 'inactive') {
      systemAudioRecorderRef.current.stop();
    }
    systemAudioRecorderRef.current = null;
    if (micAudioRecorderRef.current && micAudioRecorderRef.current.state !== 'inactive') {
      micAudioRecorderRef.current.stop();
    }
    micAudioRecorderRef.current = null;
    setIsRecording(false);
    window.electronAPI?.setRecordingStatus(false);
    playBeep(220, 400);
    setIsPaused(false);
    setStatusMessage(t('recorder.statusRecordingStopped'));
    setShowFormatDialog(true);
    setTimeout(() => {
      const cancelButton = document.querySelector('.dialog-btn-cancel');
      if (cancelButton) cancelButton.focus();
    }, 100);
  };
  handleStopRef.current = handleStop;

  const confirmStopRecording = async () => {
    setShowFormatDialog(false);

    if (recordedBufferRef.current) {
      setIsSaving(true);
      setSaveProgress(0);
      try {
        const result = await window.electronAPI.saveRecording(recordedBufferRef.current, selectedFormat);
        if (result.success) {
          console.log(`Saved to ${result.filePath}`);
          if (multiAudioMode && window.electronAPI.saveAudioAlongside) {
            if (systemAudioChunksRef.current.length > 0) {
              const sysBlob = new Blob(systemAudioChunksRef.current, { type: 'audio/webm' });
              const sysBuf = await sysBlob.arrayBuffer();
              await window.electronAPI.saveAudioAlongside(sysBuf, result.filePath, 'system_audio', 'wav');
            }
            if (micAudioChunksRef.current.length > 0) {
              const micBlob = new Blob(micAudioChunksRef.current, { type: 'audio/webm' });
              const micBuf = await micBlob.arrayBuffer();
              await window.electronAPI.saveAudioAlongside(micBuf, result.filePath, 'microphone', 'wav');
            }
          }
        } else if (!result.canceled) {
          console.error('Error saving recording:', result.error);
        }
      } catch (err) {
        console.error('Error saving recording:', err);
      } finally {
        setIsSaving(false);
        setSaveProgress(0);
      }
      recordedBufferRef.current = null;
      systemAudioChunksRef.current = [];
      micAudioChunksRef.current = [];
    }
  };

  const cancelStopRecording = () => {
    setShowFormatDialog(false);
    // Clear the buffer if canceled
    recordedBufferRef.current = null;
  };

  // ─ Live scene canvas recording ─────────────────────────────────────────────
  const switchLiveScene = (scene) => {
    if (switchLiveSceneFnRef.current) {
      switchLiveSceneFnRef.current(scene);
    } else {
      activeLiveSceneRef.current = scene;
      setActiveLiveSceneId(scene.id);
    }
  };

  const saveScene = async () => {
    const name = sceneFormName.trim();
    if (!name) return;
    const newScene = {
      id: Date.now().toString(),
      name,
      captureMode,
      selectedDesktopSource,
      selectedWindowSource,
      useCamera,
      selectedCamera,
      cameraOnlyMode,
      audioOnlyMode,
      multiAudioMode,
      selectedAudio,
      recordSystemAudio,
      borderColor,
      hasGradient,
      borderColor2,
      isNeon,
      selectedFormat,
    };
    const updated = [...scenes, newScene];
    setScenes(updated);
    setShowSceneForm(false);
    setSceneFormName('');
    if (window.electronAPI?.saveScenes) {
      await window.electronAPI.saveScenes(updated);
    }
  };

  const handleStartWithLiveScenes = async (liveScenesList) => {
    const activeElement = document.activeElement;
    const stopRef = (ref) => {
      const v = ref.current;
      if (Array.isArray(v)) v.forEach(s => s?.getTracks().forEach(t => t.stop()));
      else v?.getTracks().forEach(t => t.stop());
      ref.current = null;
    };
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      canvasRef.current = canvas;
      const ctx = canvas.getContext('2d');

      // ── 1. Open unique screen/window sources ────────────────────────────────
      const screenSrcMap = new Map(); // srcId -> { stream, el }
      for (const scene of liveScenesList) {
        if (scene.audioOnlyMode || scene.cameraOnlyMode) continue;
        const srcId = scene.captureMode === 'window' ? scene.selectedWindowSource : scene.selectedDesktopSource;
        if (!srcId || screenSrcMap.has(srcId)) continue;
        const wantAudio = scene.captureMode !== 'window' &&
          liveScenesList.some(s => s.recordSystemAudio && s.captureMode !== 'window' &&
            (s.captureMode === 'window' ? s.selectedWindowSource : s.selectedDesktopSource) === srcId);
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: wantAudio ? { mandatory: { chromeMediaSource: 'desktop' } } : false,
          video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: srcId } }
        });
        const el = document.createElement('video');
        el.srcObject = stream; el.muted = true;
        await new Promise(r => { el.onloadedmetadata = r; el.play(); });
        if (screenSrcMap.size === 0 && el.videoWidth > 0) {
          canvas.width = el.videoWidth; canvas.height = el.videoHeight;
        }
        screenSrcMap.set(srcId, { stream, el });
      }

      // ── 2. Open unique camera devices ───────────────────────────────────────
      const camDevMap = new Map(); // deviceId -> { stream, el }
      for (const scene of liveScenesList) {
        if (scene.audioOnlyMode) continue;
        const needsCam = scene.cameraOnlyMode || (scene.useCamera && !scene.audioOnlyMode);
        if (!needsCam || !scene.selectedCamera || camDevMap.has(scene.selectedCamera)) continue;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: scene.selectedCamera }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        const el = document.createElement('video');
        el.srcObject = stream; el.muted = true;
        await new Promise(r => { el.onloadedmetadata = r; el.play(); });
        camDevMap.set(scene.selectedCamera, { stream, el });
      }

      // ── 3. Open unique mic devices + system audio, wire through AudioContext ─
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      liveAudioCtxRef.current = audioCtx;
      const masterDest = audioCtx.createMediaStreamDestination();

      const micGainMap = new Map(); // deviceId -> gainNode
      const uniqueMics = [...new Set(liveScenesList.map(s => s.selectedAudio).filter(Boolean))];
      const allMicStreams = [];
      for (const deviceId of uniqueMics) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } }, video: false });
          allMicStreams.push(stream);
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = 0; // muted by default; activated on switch
          audioCtx.createMediaStreamSource(stream).connect(gainNode);
          gainNode.connect(masterDest);
          micGainMap.set(deviceId, gainNode);
        } catch (err) { console.error('Mic failed:', deviceId, err); }
      }

      const sysGainMap = new Map(); // srcId -> gainNode
      for (const [srcId, { stream }] of screenSrcMap) {
        const audioTracks = stream.getAudioTracks();
        if (audioTracks.length > 0) {
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = 0;
          audioCtx.createMediaStreamSource(new MediaStream(audioTracks)).connect(gainNode);
          gainNode.connect(masterDest);
          sysGainMap.set(srcId, gainNode);
        }
      }

      // ── 4. Scene switch logic with audio gain transitions ───────────────────
      const doSwitchScene = (scene) => {
        for (const [deviceId, gainNode] of micGainMap) {
          gainNode.gain.setTargetAtTime(
            !scene.audioOnlyMode && scene.selectedAudio === deviceId ? 1 : 0,
            audioCtx.currentTime, 0.05
          );
        }
        for (const [srcId, gainNode] of sysGainMap) {
          const activeSrc = scene.captureMode === 'window' ? scene.selectedWindowSource : scene.selectedDesktopSource;
          gainNode.gain.setTargetAtTime(
            scene.recordSystemAudio && scene.captureMode !== 'window' && srcId === activeSrc ? 1 : 0,
            audioCtx.currentTime, 0.05
          );
        }
        activeLiveSceneRef.current = scene;
        setActiveLiveSceneId(scene.id);
      };
      switchLiveSceneFnRef.current = doSwitchScene;
      doSwitchScene(liveScenesList[0]); // activate first scene

      // ── 5. Canvas render loop ───────────────────────────────────────────────
      const renderFrame = () => {
        const scene = activeLiveSceneRef.current;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (scene) {
          const layout = getSceneLayout(scene);
          const srcId = scene.captureMode === 'window' ? scene.selectedWindowSource : scene.selectedDesktopSource;
          const screenEl = screenSrcMap.get(srcId)?.el;
          const camEl = camDevMap.get(scene.selectedCamera)?.el;
          if (layout === 'screen' && screenEl?.readyState >= 2) {
            ctx.drawImage(screenEl, 0, 0, canvas.width, canvas.height);
          } else if (layout === 'camera' && camEl?.readyState >= 2) {
            ctx.drawImage(camEl, 0, 0, canvas.width, canvas.height);
          } else if (layout === 'screen+camera') {
            if (screenEl?.readyState >= 2) ctx.drawImage(screenEl, 0, 0, canvas.width, canvas.height);
            if (camEl?.readyState >= 2) {
              const cw = Math.round(canvas.width * 0.27);
              const ch = Math.round(canvas.height * 0.27);
              ctx.drawImage(camEl, canvas.width - cw - 18, canvas.height - ch - 18, cw, ch);
            }
          }
          // 'audio' layout: black frame (no video)
        }
        animFrameRef.current = requestAnimationFrame(renderFrame);
      };
      renderFrame();

      // ── 6. Build canvas MediaStream + start recording ───────────────────────
      const canvasStream = canvas.captureStream(30);
      masterDest.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t));

      liveScreenStreamRef.current = [...screenSrcMap.values()].map(v => v.stream);
      liveCamStreamRef.current = [...camDevMap.values()].map(v => v.stream);
      liveMicStreamRef.current = allMicStreams;

      const mimeType = getVideoMimeType();
      const mediaRecorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 8000000 });
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data?.size > 0) { chunksRef.current.push(e.data); lastDataTimestampRef.current = Date.now(); }
      };
      mediaRecorder.onstop = async () => {
        await new Promise(r => setTimeout(r, 300));
        if (chunksRef.current.length === 0) return;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size < 1024) return;
        recordedBufferRef.current = await blob.arrayBuffer();
        chunksRef.current = [];
      };

      mediaRecorder.start(2000);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      window.electronAPI?.setRecordingStatus(true);
      playBeep(880, 200);
      setStatusMessage(t('recorder.statusRecordingStarted'));
      if (activeElement?.focus) activeElement.focus();
    } catch (e) {
      console.error('Failed to start live scene recording:', e);
      if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
      stopRef(liveScreenStreamRef); stopRef(liveCamStreamRef); stopRef(liveMicStreamRef);
      liveAudioCtxRef.current?.close().catch(() => {}); liveAudioCtxRef.current = null;
      switchLiveSceneFnRef.current = null;
      alert(t('recorder.errorStartingRecording', { message: e.message }));
      setIsRecording(false);
      window.electronAPI?.setRecordingStatus(false);
    }
  };

  const applyScene = (scene) => {
    setCaptureMode(scene.captureMode || 'screen');
    setAudioOnlyMode(scene.audioOnlyMode || false);
    setCameraOnlyMode(scene.cameraOnlyMode || false);
    setMultiAudioMode(scene.multiAudioMode || false);
    setRecordSystemAudio(scene.recordSystemAudio || false);
    setUseCamera(scene.useCamera !== undefined ? scene.useCamera : true);
    if (scene.selectedCamera) setSelectedCamera(scene.selectedCamera);
    if (scene.selectedAudio) setSelectedAudio(scene.selectedAudio);
    if (scene.selectedDesktopSource) setSelectedDesktopSource(scene.selectedDesktopSource);
    if (scene.selectedWindowSource) setSelectedWindowSource(scene.selectedWindowSource);
    setBorderColor(scene.borderColor || '#00f2fe');
    setHasGradient(scene.hasGradient || false);
    setBorderColor2(scene.borderColor2 || '#ff0055');
    setIsNeon(scene.isNeon || false);
    setSelectedFormat(scene.selectedFormat || 'webm');
  };

  const deleteScene = async (id) => {
    const updated = scenes.filter(s => s.id !== id);
    setScenes(updated);
    if (window.electronAPI?.saveScenes) {
      await window.electronAPI.saveScenes(updated);
    }
  };
  // Keep event handler refs fresh on every render
  applySceneHandlerRef.current = applyScene;
  switchSceneHandlerRef.current = switchLiveScene;

  const handlePauseResume = () => {
    if (mediaRecorderRef.current) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setStatusMessage(t('recorder.statusRecordingResumed'));
      } else {
        mediaRecorderRef.current.pause();
        setStatusMessage(t('recorder.statusRecordingPaused'));
      }
    }
    setIsPaused(!isPaused);
    setTimeout(() => {
      const pauseButton = document.querySelector('.btn-pause');
      if (pauseButton) pauseButton.focus();
    }, 50);
  };
  handlePauseResumeRef.current = handlePauseResume;

  return (
    <>
      {/* Aria-live region for screen reader status announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
      >
        {statusMessage}
      </div>

      {/* Scene Mode — scenes are managed in the Scenes tab */}
      <div className="settings-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={sceneMode}
            onChange={(e) => setSceneMode(e.target.checked)}
            disabled={isRecording}
          />
          <span>{t('recorder.sceneMode')}</span>
        </label>
        <p style={{ fontSize: '0.72rem', color: '#888', margin: '4px 0 0 20px', lineHeight: 1.4 }}>
          {sceneMode ? t('recorder.scenesHintActive') : t('recorder.sceneTabHint')}
        </p>
      </div>

      {/* Audio-only mode toggle */}
      <div className="settings-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={audioOnlyMode}
            onChange={(e) => { setAudioOnlyMode(e.target.checked); if (e.target.checked) setCameraOnlyMode(false); }}
            disabled={isRecording}
          />
          <span>{t('recorder.audioOnlyMode')}</span>
        </label>
      </div>

      {/* Camera-only mode toggle */}
      <div className="settings-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={cameraOnlyMode}
            onChange={(e) => { setCameraOnlyMode(e.target.checked); if (e.target.checked) setAudioOnlyMode(false); }}
            disabled={isRecording}
          />
          <span>{t('recorder.cameraOnlyMode')}</span>
        </label>
        {cameraOnlyMode && (
          <p style={{ fontSize: '0.72rem', color: '#888', margin: '4px 0 0 20px', lineHeight: 1.4 }}>
            {t('recorder.cameraOnlyDesc')}
          </p>
        )}
      </div>

      {/* Multi-audio recording — available in all modes */}
      <div className="settings-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={multiAudioMode}
            onChange={(e) => setMultiAudioMode(e.target.checked)}
            disabled={isRecording}
          />
          <span>{t('recorder.multiAudio')}</span>
        </label>
        {multiAudioMode && (
          <p style={{ fontSize: '0.72rem', color: '#888', margin: '4px 0 0 20px', lineHeight: 1.4 }}>
            {t('recorder.multiAudioFiles')}
          </p>
        )}
      </div>

      {/* System audio in audio-only mode */}
      {audioOnlyMode && (
        <div className="settings-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={recordSystemAudio}
              onChange={(e) => setRecordSystemAudio(e.target.checked)}
              disabled={isRecording}
            />
            <span>{t('recorder.recordSystemAudio')}</span>
          </label>
        </div>
      )}

      {/* Camera source — shown in camera-only mode (screen/window section is hidden) */}
      {cameraOnlyMode && (
        <div className="settings-group camera-section">
          <label>{t('recorder.cameraSource')}</label>
          <div className="custom-select">
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              disabled={isRecording}
              tabIndex="0"
            >
              {cameraDevices.length === 0 && (
                <option value="">{t('recorder.selectCamera')}</option>
              )}
              {cameraDevices.map(s => (
                <option key={s.deviceId} value={s.deviceId}>{s.label || `Camera ${s.deviceId}`}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Screen / Window capture + camera — hidden in audio-only and camera-only mode */}
      {!audioOnlyMode && !cameraOnlyMode && (<>
      <div className="settings-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
          <label id="capture-source-label">{t('recorder.screenToRecord')}</label>
          <button
            type="button"
            ref={loadScreensButtonRef}
            onClick={reloadSources}
            disabled={isRecording}
            aria-label={t('recorder.clickToLoadScreens')}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              background: '#f0f0f0',
              border: '1px solid #ddd',
              borderRadius: '6px',
              cursor: isRecording ? 'not-allowed' : 'pointer'
            }}
          >
            {t('recorder.clickToLoadScreens')}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <div className="custom-select" style={{ flex: '0 0 42%' }}>
            <select
              aria-labelledby="capture-source-label"
              value={captureMode}
              onChange={(e) => setCaptureMode(e.target.value)}
              disabled={isRecording}
              tabIndex="0"
            >
              <option value="screen">{t('recorder.fullScreen')}</option>
              <option value="window">{t('recorder.specificWindow')}</option>
            </select>
          </div>
          <div className="custom-select" style={{ flex: 1 }}>
            {captureMode === 'screen' ? (
              <select
                id="desktop-source-select"
                value={selectedDesktopSource || ''}
                onChange={(e) => setSelectedDesktopSource(e.target.value)}
                disabled={isRecording}
                tabIndex="0"
              >
                {desktopSources.length === 0 && (
                  <option value="">{t('recorder.clickToLoadScreens')}</option>
                )}
                {desktopSources.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            ) : (
              <select
                id="window-source-select"
                value={selectedWindowSource || ''}
                onChange={(e) => setSelectedWindowSource(e.target.value)}
                disabled={isRecording}
                tabIndex="0"
              >
                {windowSources.length === 0 && (
                  <option value="">{t('recorder.selectWindow')}</option>
                )}
                {windowSources.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>
        <label className="checkbox-label" style={{ marginTop: '10px' }}>
          <input
            id="record-system-audio"
            type="checkbox"
            checked={recordSystemAudio}
            onChange={(e) => setRecordSystemAudio(e.target.checked)}
            disabled={isRecording}
          />
          <span>{t('recorder.recordSystemAudio')}</span>
        </label>
      </div>

      <div className="settings-group">
        <label className="checkbox-label">
          <input
            id="use-camera"
            type="checkbox"
            checked={useCamera}
            onChange={(e) => setUseCamera(e.target.checked)}
            disabled={isRecording}
          />
          <span>{t('recorder.useCamera')}</span>
        </label>
      </div>

      {useCamera && (
        <div className="settings-group camera-section">
          <label>{t('recorder.cameraSource')}</label>
          <div className="custom-select">
            <select
              value={selectedCamera}
              onChange={(e) => setSelectedCamera(e.target.value)}
              tabIndex="0"
            >
              {cameraDevices.map(s => (
                <option key={s.deviceId} value={s.deviceId}>{s.label || `Camera ${s.deviceId}`}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      </>)}

      <div className="settings-group">
        <label htmlFor="microphone-select" id="microphone-label">{t('recorder.microphone')}</label>
        <div className="custom-select">
          <select
            id="microphone-select"
            aria-labelledby="microphone-label"
            value={selectedAudio}
            onChange={(e) => setSelectedAudio(e.target.value)}
            disabled={isRecording}
            tabIndex="0"
          >
            <option value="">{t('recorder.selectMicrophone')}</option>
            {audioDevices.map(s => (
              <option key={s.deviceId} value={s.deviceId}>{s.label || `Mic ${s.deviceId}`}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="settings-group">
        <label>{t('recorder.cameraBorderStyle')}</label>

        <div className="style-controls">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={hasGradient}
              onChange={(e) => setHasGradient(e.target.checked)}
            />
            {t('recorder.gradient')}
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={isNeon}
              onChange={(e) => setIsNeon(e.target.checked)}
            />
            {t('recorder.neonGlow')}
          </label>
        </div>

        <div className="color-pickers">
          <input
            type="color"
            value={borderColor}
            onChange={(e) => setBorderColor(e.target.value)}
            className="color-picker"
            title={t('recorder.primaryColor')}
          />
          {hasGradient && (
            <input
              type="color"
              value={borderColor2}
              onChange={(e) => setBorderColor2(e.target.value)}
              className="color-picker"
              title={t('recorder.secondaryColor')}
            />
          )}
        </div>
      </div>

      {isRecording && (
        <div className="rec-duration-row">
          <span className="rec-dot" aria-hidden="true">●</span>
          <span className="rec-duration-label">{formatDuration(elapsedTime)}</span>
          {isPaused && <span className="rec-paused-badge">{t('recorder.pause')}</span>}
        </div>
      )}

      <div className="controls" role="region" aria-label={t('recorder.rec')}>
        {!isRecording ? (
          <button
            ref={startRecordingButtonRef}
            className="btn-main btn-start"
            onClick={handleStart}
            disabled={audioOnlyMode
              ? (!selectedAudio && !recordSystemAudio)
              : cameraOnlyMode
                ? !selectedCamera
                : (captureMode === 'window' ? !selectedWindowSource : !selectedDesktopSource)}
            aria-label={t('recorder.rec')}
          >
            {t('recorder.rec')}
          </button>
        ) : (
          <div className="active-controls">
            <button className="btn-main btn-pause" onClick={handlePauseResume} aria-label={isPaused ? t('recorder.resume') : t('recorder.pause')}>
              {isPaused ? t('recorder.resume') : t('recorder.pause')}
            </button>
            <button className="btn-main btn-stop" onClick={handleStop} aria-label={t('recorder.stop')}>
              {t('recorder.stop')}
            </button>
          </div>
        )}
      </div>

      <style>{`
        .scenes-row {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 4px;
            align-items: center;
        }
        .scene-chip {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 4px 10px 4px 12px;
            border: 2px solid #e0e0e0;
            border-radius: 20px;
            font-size: 0.78rem;
            cursor: pointer;
            background: #f9f9f9;
            transition: all 0.15s;
            user-select: none;
            max-width: 140px;
        }
        .scene-chip span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .scene-chip:hover:not(.scene-chip-disabled) {
            border-color: #000;
            background: #f0f0f0;
        }
        .scene-chip-disabled {
            opacity: 0.45;
            cursor: not-allowed;
        }
        .scene-chip-active {
            border-color: #000;
            background: #000;
            color: #fff;
            font-weight: 700;
        }
        .scene-chip-active .scene-chip-delete {
            color: #aaa;
        }
        .scene-chip-inactive {
            opacity: 0.55;
        }
        .layout-option {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 5px 10px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 0.78rem;
            cursor: pointer;
            background: #f9f9f9;
            user-select: none;
            transition: all 0.15s;
        }
        .layout-option:hover {
            border-color: #bbb;
        }
        .layout-option-active {
            border-color: #000;
            background: #000;
            color: #fff;
        }
        .scene-chip-delete {
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1rem;
            color: #bbb;
            padding: 0;
            line-height: 1;
            flex-shrink: 0;
        }
        .scene-chip-delete:hover {
            color: #ff3b30;
        }
        .scene-add-btn {
            padding: 4px 10px;
            border: 2px dashed #ccc;
            border-radius: 20px;
            font-size: 0.78rem;
            cursor: pointer;
            background: transparent;
            color: #888;
            transition: all 0.15s;
        }
        .scene-add-btn:hover:not(:disabled) {
            border-color: #000;
            color: #000;
        }
        .scene-add-btn:disabled {
            opacity: 0.45;
            cursor: not-allowed;
        }
        .scene-name-row {
            display: flex;
            gap: 6px;
            margin-top: 8px;
        }
        .scene-name-input {
            flex: 1;
            padding: 6px 10px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 0.85rem;
            min-width: 0;
        }
        .scene-name-input:focus {
            outline: none;
            border-color: #000;
        }
        .scene-confirm-btn {
            padding: 6px 12px;
            background: #000;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 0.82rem;
            cursor: pointer;
            font-weight: 700;
            white-space: nowrap;
        }
        .scene-cancel-btn {
            padding: 6px 12px;
            background: #e0e0e0;
            color: #333;
            border: none;
            border-radius: 8px;
            font-size: 0.82rem;
            cursor: pointer;
            white-space: nowrap;
        }

        .settings-group {
            margin-bottom: 15px;
        }

        .settings-group label {
            display: block;
            font-size: 0.75rem;
            font-weight: 700;
            margin-bottom: 5px;
            color: #666;
            text-transform: uppercase;
        }

        .custom-select {
            position: relative;
        }

        select {
            width: 100%;
            padding: 10px;
            border: 2px solid #e0e0e0;
            background: #fff;
            color: #333;
            border-radius: 8px;
            font-size: 0.9rem;
            appearance: none;
            cursor: pointer;
            transition: border-color 0.2s;
        }
        select:hover {
            border-color: #bbb;
        }
        select:focus {
            outline: none;
            border-color: #000;
            box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.2);
        }

        .color-picker {
            flex: 1;
            height: 40px;
            border: none;
            padding: 0;
            background: none;
            cursor: pointer;
        }

        .style-controls {
            display: flex;
            gap: 15px;
            margin-bottom: 10px;
        }

        .checkbox-label {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 0.8rem;
            cursor: pointer;
            user-select: none;
        }

        .checkbox-label input:focus-visible {
            outline: 2px solid #000;
            outline-offset: 2px;
        }

        .checkbox-label:hover input {
            outline: 2px solid #000;
            outline-offset: 2px;
        }

        .color-pickers {
            display: flex;
            gap: 10px;
        }

        .camera-section {
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(-10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .rec-duration-row {
            display: flex;
            align-items: center;
            gap: 6px;
            justify-content: center;
            margin-bottom: 10px;
            font-size: 1.1rem;
            font-weight: 700;
            color: #ff3b30;
            font-variant-numeric: tabular-nums;
        }
        .rec-dot {
            font-size: 0.7rem;
            animation: blink 1s step-start infinite;
        }
        @keyframes blink { 50% { opacity: 0; } }
        .rec-paused-badge {
            font-size: 0.65rem;
            background: #ff9500;
            color: #fff;
            border-radius: 4px;
            padding: 1px 6px;
            font-weight: 700;
            text-transform: uppercase;
        }
        .controls {
            margin-top: auto;
            display: flex;
            justify-content: center;
        }

        .active-controls {
            display: flex;
            gap: 10px;
            width: 100%;
        }

        .btn-main {
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 12px;
            font-weight: 800;
            font-size: 1rem;
            text-transform: uppercase;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .btn-main:active {
            transform: translateY(2px);
            box-shadow: 0 2px 3px rgba(0,0,0,0.1);
        }

        .btn-start {
            background-color: #000;
            color: #fff;
        }

        .btn-start:hover {
            background-color: #333;
        }

        .btn-stop {
            background-color: #ff3b30;
            color: #fff;
        }

        .btn-pause {
            background-color: #fff;
            color: #000;
            border: 2px solid #000;
        }

        .dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
        }

        .dialog-overlay:focus-within {
            outline: 2px solid #000;
        }

        .dialog-content {
            background: white;
            padding: 24px;
            border-radius: 12px;
            width: 320px;
            max-width: 90%;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }

        .dialog-title {
            font-size: 1.1rem;
            font-weight: 700;
            margin-bottom: 16px;
            color: #000;
        }

        .format-option {
            display: flex;
            align-items: center;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .format-option:hover,
        .format-option:focus-within {
            border-color: #bbb;
            background: #f9f9f9;
        }

        .format-option.selected,
        .format-option.selected:focus-within {
            border-color: #000;
            background: #f0f0f0;
        }

        .format-option input {
            margin-right: 12px;
            cursor: pointer;
        }

        .format-label {
            flex: 1;
            font-size: 0.9rem;
            font-weight: 600;
        }

        .format-description {
            display: block;
            font-size: 0.75rem;
            color: #666;
            margin-top: 2px;
        }

        .dialog-actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }

        .dialog-btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            font-weight: 700;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.2s;
        }

        .dialog-btn:focus-visible {
            outline: 2px solid #000;
            outline-offset: 2px;
        }

        .dialog-btn-cancel {
            background: #e0e0e0;
            color: #333;
        }

        .dialog-btn-cancel:hover,
        .dialog-btn-cancel:focus-visible {
            background: #d0d0d0;
        }

        .dialog-btn-confirm {
            background: #000;
            color: #fff;
        }

        .dialog-btn-confirm:hover,
        .dialog-btn-confirm:focus-visible {
            background: #333;
        }

        .save-progress-track {
            width: 100%;
            height: 8px;
            background: #e0e0e0;
            border-radius: 4px;
            overflow: hidden;
        }
        .save-progress-fill {
            height: 100%;
            background: #000;
            border-radius: 4px;
            transition: width 0.3s ease;
        }
        @keyframes indeterminate {
            0%   { transform: translateX(-100%); width: 60%; }
            100% { transform: translateX(200%);  width: 60%; }
        }
      `}</style>

      {isSaving && (
        <div className="dialog-overlay" role="dialog" aria-modal="true" aria-label={t('recorder.saving')}>
          <div className="dialog-content" style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 700, marginBottom: 12 }}>{t('recorder.saving')}</p>
            <div className="save-progress-track">
              <div
                className="save-progress-fill"
                style={{ width: `${saveProgress > 0 ? saveProgress : 100}%`,
                         animation: saveProgress > 0 ? 'none' : 'indeterminate 1.4s ease infinite' }}
              />
            </div>
            {saveProgress > 0 && (
              <p style={{ fontSize: '0.8rem', color: '#555', marginTop: 8 }}>
                {Math.round(saveProgress)}%
              </p>
            )}
          </div>
        </div>
      )}

      {showFormatDialog && (
        <div
          className="dialog-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="format-dialog-title"
        >
          <div className="dialog-content" ref={dialogContainerRef}>
            <h2 id="format-dialog-title" className="dialog-title">{t('recorder.selectFormat')}</h2>

            {audioOnlyMode ? (
              <>
                {[['mp3','MP3',t('recorder.mp3Description')],['wav','WAV',t('recorder.wavDescription')],['flac','FLAC',t('recorder.flacDescription')]].map(([val, label, desc]) => (
                  <label key={val} className={`format-option ${selectedFormat === val ? 'selected' : ''}`} onClick={() => setSelectedFormat(val)}>
                    <input type="radio" name="format" value={val} checked={selectedFormat === val} onChange={(e) => setSelectedFormat(e.target.value)} tabIndex="0" />
                    <div><div className="format-label">{label}</div><span className="format-description">{desc}</span></div>
                  </label>
                ))}
              </>
            ) : (
              <>
                <label className={`format-option ${selectedFormat === 'webm' ? 'selected' : ''}`} onClick={() => setSelectedFormat('webm')}>
                  <input type="radio" name="format" value="webm" checked={selectedFormat === 'webm'} onChange={(e) => setSelectedFormat(e.target.value)} tabIndex="0" />
                  <div><div className="format-label">WebM {t('recorder.nativeFormat')}</div><span className="format-description">{t('recorder.webmDescription')}</span></div>
                </label>
                <label className={`format-option ${selectedFormat === 'mp4' ? 'selected' : ''}`} onClick={() => setSelectedFormat('mp4')}>
                  <input type="radio" name="format" value="mp4" checked={selectedFormat === 'mp4'} onChange={(e) => setSelectedFormat(e.target.value)} tabIndex="0" />
                  <div><div className="format-label">MP4</div><span className="format-description">{t('recorder.mp4Description')}</span></div>
                </label>
                <label className={`format-option ${selectedFormat === 'mkv' ? 'selected' : ''}`} onClick={() => setSelectedFormat('mkv')}>
                  <input type="radio" name="format" value="mkv" checked={selectedFormat === 'mkv'} onChange={(e) => setSelectedFormat(e.target.value)} tabIndex="0" />
                  <div><div className="format-label">MKV</div><span className="format-description">{t('recorder.mkvDescription')}</span></div>
                </label>
                <label className={`format-option ${selectedFormat === 'mp3' ? 'selected' : ''}`} onClick={() => setSelectedFormat('mp3')}>
                  <input type="radio" name="format" value="mp3" checked={selectedFormat === 'mp3'} onChange={(e) => setSelectedFormat(e.target.value)} tabIndex="0" />
                  <div><div className="format-label">MP3</div><span className="format-description">{t('recorder.mp3Description')}</span></div>
                </label>
              </>
            )}

            <div className="dialog-actions">
              <button className="dialog-btn dialog-btn-cancel" onClick={cancelStopRecording} aria-label={t('recorder.cancel')} tabIndex="0">
                {t('recorder.cancel')}
              </button>
              <button className="dialog-btn dialog-btn-confirm" onClick={confirmStopRecording} aria-label={t('recorder.save')} tabIndex="0">
                {t('recorder.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RecorderTab;
