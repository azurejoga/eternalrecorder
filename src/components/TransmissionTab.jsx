import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useI18n } from '../contexts/I18nContext';

const TransmissionTab = () => {
  const { t } = useTranslation();
  const { currentLanguage } = useI18n();

  // ─── Source selection (mirrors RecorderTab) ────────────────────────────────
  const [captureMode, setCaptureMode] = useState('screen');
  const [desktopSources, setDesktopSources] = useState([]);
  const [selectedDesktopSource, setSelectedDesktopSource] = useState(null);
  const [windowSources, setWindowSources] = useState([]);
  const [selectedWindowSource, setSelectedWindowSource] = useState(null);

  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [useCamera, setUseCamera] = useState(false);

  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState('');
  const [recordSystemAudio, setRecordSystemAudio] = useState(false);

  // ─── Destinations ──────────────────────────────────────────────────────────
  const [destinations, setDestinations] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDestination, setNewDestination] = useState({ name: '', url: '', key: '' });

  // ─── Stream state ──────────────────────────────────────────────────────────
  const [streamStatus, setStreamStatus] = useState({});
  const [globalError, setGlobalError] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const captureStreamRef = useRef(null);
  const activeDestIdsRef = useRef(new Set());
  const prevCameraRef = useRef(null);

  const [destinationsLoaded, setDestinationsLoaded] = useState(false);

  // ─── Load destinations from encrypted file ────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (window.electronAPI?.loadRtmpDestinations) {
        try {
          const loaded = await window.electronAPI.loadRtmpDestinations();
          if (Array.isArray(loaded) && loaded.length > 0) setDestinations(loaded);
        } catch {}
      } else {
        // fallback: localStorage
        const saved = localStorage.getItem('rtmpDestinations');
        if (saved) { try { setDestinations(JSON.parse(saved)); } catch {} }
      }
      setDestinationsLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!destinationsLoaded) return;
    if (window.electronAPI?.saveRtmpDestinations) {
      window.electronAPI.saveRtmpDestinations(destinations).catch(() => {});
    } else {
      localStorage.setItem('rtmpDestinations', JSON.stringify(destinations));
    }
  }, [destinations, destinationsLoaded]);

  // ─── Load sources + devices (same timing as RecorderTab) ──────────────────
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === 'videoinput');
        setCameraDevices(cameras);
        if (cameras.length > 0) setSelectedCamera(c => c || cameras[0].deviceId);
        const mics = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(mics);
        if (mics.length > 0) setSelectedAudio(a => a || mics[0].deviceId);
      } catch {}
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDesktopSources();
      loadWindowSources();
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const loadDesktopSources = async () => {
    if (!window.electronAPI) return;
    try {
      const src = await window.electronAPI.getDesktopSources();
      setDesktopSources(src || []);
      if (src?.length > 0) setSelectedDesktopSource(s => s || src[0].id);
    } catch {}
  };

  const loadWindowSources = async () => {
    if (!window.electronAPI) return;
    try {
      const src = await window.electronAPI.getWindowSources();
      setWindowSources(src || []);
      if (src?.length > 0) setSelectedWindowSource(s => s || src[0].id);
    } catch {}
  };

  const reloadSources = async () => {
    await loadDesktopSources();
    await loadWindowSources();
  };

  // ─── Camera window management (same as RecorderTab) ───────────────────────
  useEffect(() => {
    if (!window.electronAPI) return;
    const prev = prevCameraRef.current;
    if (!useCamera) {
      if (prev !== null) window.electronAPI.toggleCameraWindow(false);
      prevCameraRef.current = null;
    } else if (useCamera && selectedCamera) {
      if (prev !== selectedCamera) {
        window.electronAPI.setCameraSource(selectedCamera);
        window.electronAPI.toggleCameraWindow(true);
      }
      prevCameraRef.current = selectedCamera;
    } else {
      if (prev !== null) window.electronAPI.toggleCameraWindow(false);
      prevCameraRef.current = null;
    }
  }, [selectedCamera, useCamera]);

  // ─── Listen for streams closed by main process ────────────────────────────
  useEffect(() => {
    const unsub = window.electronAPI?.onRtmpStreamClosed?.((destId, code) => {
      setStreamStatus(prev => ({ ...prev, [destId]: code === 0 ? 'idle' : 'error' }));
      activeDestIdsRef.current.delete(destId);
      if (activeDestIdsRef.current.size === 0) stopCapture();
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, []);

  // ─── Cleanup camera on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (useCamera && window.electronAPI) window.electronAPI.toggleCameraWindow(false);
    };
  }, []);

  // ─── Capture (same constraints as RecorderTab) ─────────────────────────────
  const getActiveSourceId = () =>
    captureMode === 'window' ? selectedWindowSource : selectedDesktopSource;

  const startCapture = async () => {
    if (mediaRecorderRef.current) return true;
    const activeSourceId = getActiveSourceId();
    if (!activeSourceId) {
      setGlobalError(t('recorder.clickToLoadScreens'));
      return false;
    }
    try {
      setGlobalError('');
      const screenConstraints = {
        audio: recordSystemAudio ? { mandatory: { chromeMediaSource: 'desktop' } } : false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: activeSourceId,
          }
        }
      };

      const screenStream = await navigator.mediaDevices.getUserMedia(screenConstraints);
      let micStream = null;
      if (selectedAudio) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: selectedAudio } },
            video: false
          });
        } catch {}
      }

      const tracks = [...screenStream.getVideoTracks()];
      let finalStream = screenStream;

      if (micStream || recordSystemAudio) {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const dest = ctx.createMediaStreamDestination();
          let hasAudio = false;
          if (recordSystemAudio && screenStream.getAudioTracks().length > 0) {
            ctx.createMediaStreamSource(screenStream).connect(dest);
            hasAudio = true;
          }
          if (micStream?.getAudioTracks().length > 0) {
            ctx.createMediaStreamSource(micStream).connect(dest);
            hasAudio = true;
          }
          if (hasAudio) {
            tracks.push(...dest.stream.getAudioTracks());
            finalStream = new MediaStream(tracks);
          }
        } catch {}
      }

      captureStreamRef.current = finalStream;

      const mimeType = MediaRecorder.isTypeSupported('video/webm; codecs=vp8')
        ? 'video/webm; codecs=vp8'
        : 'video/webm';

      const mr = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
        audioBitsPerSecond: 128_000
      });

      mr.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        if (activeDestIdsRef.current.size === 0) return;
        e.data.arrayBuffer().then(buf => {
          window.electronAPI?.sendStreamChunk?.([...activeDestIdsRef.current], buf);
        }).catch(() => {});
      };

      mr.onerror = () => {
        setGlobalError('MediaRecorder error. Stream stopped.');
        handleStopAll();
      };

      mr.start(250);
      mediaRecorderRef.current = mr;
      setIsCapturing(true);
      return true;
    } catch (err) {
      setGlobalError(err.message);
      return false;
    }
  };

  const stopCapture = () => {
    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch {}
      mediaRecorderRef.current = null;
    }
    if (captureStreamRef.current) {
      captureStreamRef.current.getTracks().forEach(t => t.stop());
      captureStreamRef.current = null;
    }
    setIsCapturing(false);
  };

  // ─── Per-destination controls ─────────────────────────────────────────────
  const handleStartDest = async (dest) => {
    const cur = streamStatus[dest.id];
    if (cur === 'streaming' || cur === 'connecting') return;
    setStreamStatus(prev => ({ ...prev, [dest.id]: 'connecting' }));
    setGlobalError('');

    if (!mediaRecorderRef.current) {
      const ok = await startCapture();
      if (!ok) {
        setStreamStatus(prev => ({ ...prev, [dest.id]: 'error' }));
        return;
      }
    }

    const result = await window.electronAPI?.startRtmpStream?.(dest.id, dest.url, dest.key);
    if (!result?.success) {
      setStreamStatus(prev => ({ ...prev, [dest.id]: 'error' }));
      setGlobalError(result?.error || 'Failed to start RTMP stream.');
      activeDestIdsRef.current.delete(dest.id);
      if (activeDestIdsRef.current.size === 0) stopCapture();
      return;
    }

    activeDestIdsRef.current.add(dest.id);
    setStreamStatus(prev => ({ ...prev, [dest.id]: 'streaming' }));
  };

  const handleStopDest = async (destId) => {
    await window.electronAPI?.stopRtmpStream?.(destId);
    activeDestIdsRef.current.delete(destId);
    setStreamStatus(prev => ({ ...prev, [destId]: 'idle' }));
    if (activeDestIdsRef.current.size === 0) stopCapture();
  };

  const handleStartAll = async () => {
    setGlobalError('');
    for (const dest of destinations) {
      const s = streamStatus[dest.id];
      if (s !== 'streaming' && s !== 'connecting') await handleStartDest(dest);
    }
  };

  const handleStopAll = async () => {
    await window.electronAPI?.stopAllRtmpStreams?.();
    activeDestIdsRef.current.clear();
    stopCapture();
    setStreamStatus({});
  };

  // ─── Destination management ───────────────────────────────────────────────
  const addDestination = () => {
    if (!newDestination.name || !newDestination.url) return;
    setDestinations(prev => [...prev, { id: Date.now().toString(), ...newDestination }]);
    setNewDestination({ name: '', url: '', key: '' });
    setShowAddForm(false);
  };

  const removeDestination = (id) => {
    const s = streamStatus[id];
    if (s === 'streaming' || s === 'connecting') return;
    setDestinations(prev => prev.filter(d => d.id !== id));
    setStreamStatus(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const getDisplayName = (dest) => {
    if (dest.name) return dest.name;
    const u = (dest.url || '').toLowerCase();
    if (u.includes('youtube')) return t('transmission.youtube');
    if (u.includes('facebook') || u.includes('fbcdn')) return t('transmission.facebook');
    if (u.includes('twitch')) return t('transmission.twitch');
    return t('transmission.custom');
  };

  const activeSourceId = getActiveSourceId();
  const anyActive = Object.values(streamStatus).some(s => s === 'streaming' || s === 'connecting');

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="tab-content transmission-tab">

      {/* Header */}
      <div className="transmission-header">
        <h2>{t('transmission.title')}</h2>
        <div className="stream-global-controls">
          {anyActive ? (
            <button className="btn-stop-stream" onClick={handleStopAll}>
              ⏹ {t('transmission.stopStreaming')}
            </button>
          ) : (
            <button
              className="btn-start-stream"
              onClick={handleStartAll}
              disabled={destinations.length === 0 || !activeSourceId}
            >
              ▶ {t('transmission.startStreaming')}
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {globalError && <div className="stream-error-banner">⚠ {globalError}</div>}

      {/* Source selection — identical to RecorderTab */}
      <div className="source-section">
        <div className="source-row">
          <label>{t('recorder.screenToRecord')}</label>
          <button
            type="button"
            className="btn-reload-src"
            onClick={reloadSources}
            disabled={isCapturing}
          >
            ↺ {t('recorder.clickToLoadScreens')}
          </button>
        </div>
        <div className="source-row">
          <div className="custom-select-sm" style={{ flex: '0 0 42%' }}>
            <select
              value={captureMode}
              onChange={e => setCaptureMode(e.target.value)}
              disabled={isCapturing}
            >
              <option value="screen">{t('recorder.fullScreen')}</option>
              <option value="window">{t('recorder.specificWindow')}</option>
            </select>
          </div>
          <div className="custom-select-sm" style={{ flex: 1 }}>
            {captureMode === 'screen' ? (
              <select
                value={selectedDesktopSource || ''}
                onChange={e => setSelectedDesktopSource(e.target.value)}
                disabled={isCapturing}
              >
                {desktopSources.length === 0 && <option value="">{t('recorder.clickToLoadScreens')}</option>}
                {desktopSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <select
                value={selectedWindowSource || ''}
                onChange={e => setSelectedWindowSource(e.target.value)}
                disabled={isCapturing}
              >
                {windowSources.length === 0 && <option value="">{t('recorder.selectWindow')}</option>}
                {windowSources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
        </div>
        <label className="src-checkbox">
          <input
            type="checkbox"
            checked={recordSystemAudio}
            onChange={e => setRecordSystemAudio(e.target.checked)}
            disabled={isCapturing}
          />
          <span>{t('recorder.recordSystemAudio')}</span>
        </label>

        {/* Camera */}
        <label className="src-checkbox">
          <input
            type="checkbox"
            checked={useCamera}
            onChange={e => setUseCamera(e.target.checked)}
            disabled={isCapturing}
          />
          <span>{t('recorder.useCamera')}</span>
        </label>
        {useCamera && (
          <div className="source-row">
            <label style={{ minWidth: 'unset', fontWeight: 400 }}>{t('recorder.cameraSource')}</label>
            <div className="custom-select-sm" style={{ flex: 1 }}>
              <select
                value={selectedCamera}
                onChange={e => setSelectedCamera(e.target.value)}
                disabled={isCapturing}
              >
                {cameraDevices.length === 0 && <option value="">—</option>}
                {cameraDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Microphone */}
        <div className="source-row">
          <label>{t('recorder.microphone')}</label>
          <div className="custom-select-sm" style={{ flex: 1 }}>
            <select
              value={selectedAudio}
              onChange={e => setSelectedAudio(e.target.value)}
              disabled={isCapturing}
            >
              <option value="">{t('recorder.selectMicrophone')}</option>
              {audioDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Mic ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Destinations */}
      <div className="destinations-section">
        <div className="section-header-row">
          <h3>{t('transmission.rtmpDestinations')}</h3>
        </div>

        {showAddForm ? (
          <div className="add-destination-form">
            <div className="form-group">
              <label>{t('transmission.addDestination')}</label>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="YouTube / Twitch / Facebook..."
                  value={newDestination.name}
                  onChange={e => setNewDestination(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="rtmp://a.rtmp.youtube.com/live2"
                  value={newDestination.url}
                  onChange={e => setNewDestination(p => ({ ...p, url: e.target.value }))}
                />
              </div>
              <div className="form-row">
                <input
                  type="text"
                  placeholder={t('transmission.streamKey')}
                  value={newDestination.key}
                  onChange={e => setNewDestination(p => ({ ...p, key: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setShowAddForm(false)}>
                {t('recorder.cancel')}
              </button>
              <button className="btn-add" onClick={addDestination} disabled={!newDestination.name || !newDestination.url}>
                {t('transmission.add')}
              </button>
            </div>
          </div>
        ) : (
          <button className="add-destination-btn" onClick={() => setShowAddForm(true)}>
            + {t('transmission.addDestination')}
          </button>
        )}

        <div className="destinations-list">
          {destinations.length === 0 ? (
            <p className="no-destinations">{t('transmission.noStream')}</p>
          ) : (
            destinations.map(dest => {
              const status = streamStatus[dest.id] || 'idle';
              const busy = status === 'streaming' || status === 'connecting';
              return (
                <div key={dest.id} className={`destination-card status-${status}`}>
                  <div className="destination-top">
                    <div className="destination-info">
                      <div className="destination-name">{getDisplayName(dest)}</div>
                      <div className="destination-url">
                        {dest.url}{dest.key ? ` / ${dest.key}` : ''}
                      </div>
                    </div>
                    <span className={`status-badge badge-${status}`}>
                      {status === 'streaming' ? '● LIVE'
                        : status === 'connecting' ? '◌ …'
                        : status === 'error' ? '✕ ERR'
                        : '○ OFF'}
                    </span>
                  </div>
                  <div className="destination-actions">
                    {busy ? (
                      <button className="btn-stream-dest active" onClick={() => handleStopDest(dest.id)}>
                        ⏹ {t('transmission.stopStreaming')}
                      </button>
                    ) : (
                      <button
                        className="btn-stream-dest"
                        onClick={() => handleStartDest(dest)}
                        disabled={!activeSourceId}
                      >
                        ▶ {t('transmission.startStreaming')}
                      </button>
                    )}
                    <button
                      className="btn-remove-dest"
                      onClick={() => removeDestination(dest.id)}
                      disabled={busy}
                    >
                      {t('transmission.remove')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        .transmission-tab {
          display: flex;
          flex-direction: column;
          padding: 16px 20px;
          overflow-y: auto;
          gap: 12px;
        }
        .transmission-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .transmission-header h2 { margin: 0; font-size: 1.3rem; color: #000; }
        .stream-global-controls { display: flex; gap: 8px; }
        .btn-start-stream {
          padding: 9px 18px; background: #00b894; color: #fff;
          border: none; border-radius: 8px; font-size: 0.85rem;
          font-weight: 600; cursor: pointer;
        }
        .btn-start-stream:hover:not(:disabled) { background: #009688; }
        .btn-start-stream:disabled { background: #b2dfdb; cursor: not-allowed; }
        .btn-stop-stream {
          padding: 9px 18px; background: #dc3545; color: #fff;
          border: none; border-radius: 8px; font-size: 0.85rem;
          font-weight: 600; cursor: pointer;
        }
        .btn-stop-stream:hover { background: #b71c1c; }
        .stream-error-banner {
          background: #fff3cd; border: 1px solid #ffc107;
          border-radius: 6px; padding: 9px 12px;
          font-size: 0.82rem; color: #856404;
        }
        .source-section {
          background: #f4faf8; border-radius: 8px;
          padding: 12px 14px; display: flex; flex-direction: column;
          gap: 8px; border-left: 4px solid #00b894;
        }
        .source-row {
          display: flex; align-items: center; gap: 8px;
        }
        .source-row label {
          min-width: 110px; font-size: 0.78rem; font-weight: 600;
          color: #666; text-transform: uppercase; white-space: nowrap;
        }
        .btn-reload-src {
          flex: 1; padding: 5px 10px; background: #f0f0f0;
          border: 1px solid #ddd; border-radius: 6px;
          font-size: 0.75rem; cursor: pointer;
        }
        .btn-reload-src:hover:not(:disabled) { background: #e8e8e8; }
        .btn-reload-src:disabled { color: #aaa; cursor: not-allowed; }
        .custom-select-sm select {
          width: 100%; padding: 8px 10px;
          border: 2px solid #e0e0e0; background: #fff; color: #333;
          border-radius: 8px; font-size: 0.85rem; appearance: none;
          cursor: pointer;
        }
        .custom-select-sm select:disabled { background: #f5f5f5; color: #999; }
        .src-checkbox {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.8rem; cursor: pointer;
        }
        .src-checkbox span { font-weight: 400; color: #333; }
        .destinations-section { display: flex; flex-direction: column; gap: 10px; }
        .section-header-row { display: flex; align-items: center; justify-content: space-between; }
        .destinations-section h3 { font-size: 1rem; color: #000; margin: 0; }
        .add-destination-btn {
          padding: 9px 16px; background: #f0f0f0; border: 2px dashed #ccc;
          border-radius: 8px; cursor: pointer; color: #666; font-size: 0.85rem;
          width: 100%; text-align: center; box-sizing: border-box;
        }
        .add-destination-btn:hover { background: #e8e8e8; }
        .add-destination-form { background: #f9f9f9; padding: 14px 16px; border-radius: 8px; }
        .form-group label {
          display: block; font-size: 0.85rem; font-weight: 600;
          margin-bottom: 8px; color: #333;
        }
        .form-row { margin-bottom: 7px; }
        .form-row input {
          width: 100%; padding: 8px 10px; border: 1px solid #ddd;
          border-radius: 6px; font-size: 0.83rem; box-sizing: border-box;
        }
        .form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; }
        .btn-cancel {
          padding: 7px 14px; background: #e0e0e0; color: #333;
          border: 1px solid #ccc; border-radius: 6px; font-size: 0.83rem; cursor: pointer;
        }
        .btn-add {
          padding: 7px 14px; background: #00b894; color: #fff;
          border: none; border-radius: 6px; font-size: 0.83rem; cursor: pointer;
        }
        .btn-add:disabled { background: #b2dfdb; cursor: not-allowed; }
        .destinations-list { display: flex; flex-direction: column; gap: 8px; }
        .no-destinations {
          text-align: center; color: #999; padding: 28px 16px;
          background: #f5f5f5; border-radius: 8px; font-size: 0.85rem;
        }
        .destination-card {
          background: #fff; border: 1.5px solid #e0e0e0;
          border-radius: 8px; padding: 12px 14px; transition: border-color 0.2s;
        }
        .destination-card.status-streaming { border-color: #00b894; background: #f4faf8; }
        .destination-card.status-connecting { border-color: #ffc107; }
        .destination-card.status-error { border-color: #dc3545; background: #fff5f5; }
        .destination-top {
          display: flex; align-items: flex-start;
          justify-content: space-between; margin-bottom: 9px;
        }
        .destination-name { font-weight: 600; font-size: 0.9rem; color: #000; margin-bottom: 2px; }
        .destination-url { font-size: 0.75rem; color: #666; word-break: break-all; }
        .status-badge {
          font-size: 0.72rem; font-weight: 700; padding: 2px 8px;
          border-radius: 10px; white-space: nowrap; margin-left: 8px; flex-shrink: 0;
        }
        .badge-streaming { background: #d4edda; color: #155724; }
        .badge-connecting { background: #fff3cd; color: #856404; }
        .badge-error { background: #f8d7da; color: #721c24; }
        .badge-idle { background: #e9ecef; color: #6c757d; }
        .destination-actions { display: flex; gap: 7px; }
        .btn-stream-dest {
          flex: 1; padding: 7px 10px; background: #28a745; color: #fff;
          border: none; border-radius: 6px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
        }
        .btn-stream-dest:hover:not(:disabled) { background: #218838; }
        .btn-stream-dest.active { background: #dc3545; }
        .btn-stream-dest.active:hover { background: #b71c1c; }
        .btn-stream-dest:disabled { background: #ccc; cursor: not-allowed; }
        .btn-remove-dest {
          padding: 7px 10px; background: transparent; color: #dc3545;
          border: 1px solid #dc3545; border-radius: 6px; font-size: 0.8rem; cursor: pointer;
        }
        .btn-remove-dest:hover:not(:disabled) { background: #f8d7da; }
        .btn-remove-dest:disabled { color: #ccc; border-color: #ccc; cursor: not-allowed; }
      `}</style>
    </div>
  );
};

export default TransmissionTab;
