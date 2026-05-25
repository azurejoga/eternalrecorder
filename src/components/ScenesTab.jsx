import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const getSceneLayout = (scene) => {
  if (!scene) return 'screen';
  if (scene.audioOnlyMode) return 'audio';
  if (scene.cameraOnlyMode) return 'camera';
  if (scene.useCamera) return 'screen+camera';
  return 'screen';
};

const getSceneLayoutIcon = (scene) => {
  const l = getSceneLayout(scene);
  if (l === 'audio') return '🎤';
  if (l === 'camera') return '📷';
  if (l === 'screen+camera') return '🖥️📷';
  return '🖥️';
};

const ScenesTab = () => {
  const { t } = useTranslation();

  const [scenes, setScenes] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [activeLiveSceneId, setActiveLiveSceneId] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');

  // Load scenes from persistence on mount
  useEffect(() => {
    if (!window.electronAPI?.getScenes) return;
    window.electronAPI.getScenes().then(s => setScenes(s || [])).catch(() => {});
  }, []);

  // Listen for recording state changes from RecorderTab
  useEffect(() => {
    const onState = (e) => {
      setIsRecording(e.detail.isRecording);
      setActiveLiveSceneId(e.detail.activeLiveSceneId);
    };
    // Also listen for scenes updated by RecorderTab (e.g. if user saves from there)
    const onScenesUpdated = () => {
      window.electronAPI?.getScenes?.().then(s => setScenes(s || [])).catch(() => {});
    };
    window.addEventListener('recorder:state', onState);
    window.addEventListener('scenesUpdated', onScenesUpdated);
    return () => {
      window.removeEventListener('recorder:state', onState);
      window.removeEventListener('scenesUpdated', onScenesUpdated);
    };
  }, []);

  const persistScenes = (updated) => {
    setScenes(updated);
    window.electronAPI?.saveScenes?.(updated).catch(() => {});
    window.dispatchEvent(new Event('scenesUpdated'));
  };

  const handleSceneClick = (scene) => {
    if (editingId === scene.id || confirmDeleteId === scene.id) return;
    if (isRecording) {
      window.dispatchEvent(new CustomEvent('scenes:switch', { detail: scene }));
    } else {
      window.dispatchEvent(new CustomEvent('scenes:apply', { detail: scene }));
    }
  };

  const handleRenameStart = (scene) => {
    setEditingId(scene.id);
    setEditingName(scene.name);
    setConfirmDeleteId(null);
  };

  const handleRenameSave = () => {
    const name = editingName.trim();
    if (!name) return;
    const updated = scenes.map(s => s.id === editingId ? { ...s, name } : s);
    persistScenes(updated);
    setEditingId(null);
    setEditingName('');
  };

  const handleRenameCancel = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleDeleteRequest = (id) => {
    setConfirmDeleteId(id);
    setEditingId(null);
  };

  const handleDeleteConfirm = (id) => {
    const updated = scenes.filter(s => s.id !== id);
    persistScenes(updated);
    setConfirmDeleteId(null);
  };

  const handleAddScene = () => {
    const name = newSceneName.trim();
    if (!name) return;
    const snap = window.__recorderSnapshot || {};
    const newScene = {
      id: Date.now().toString(),
      name,
      captureMode: snap.captureMode || 'screen',
      selectedDesktopSource: snap.selectedDesktopSource || null,
      selectedWindowSource: snap.selectedWindowSource || null,
      useCamera: snap.useCamera ?? true,
      selectedCamera: snap.selectedCamera || '',
      cameraOnlyMode: snap.cameraOnlyMode || false,
      audioOnlyMode: snap.audioOnlyMode || false,
      multiAudioMode: snap.multiAudioMode || false,
      selectedAudio: snap.selectedAudio || '',
      recordSystemAudio: snap.recordSystemAudio || false,
      borderColor: snap.borderColor || '#00f2fe',
      hasGradient: snap.hasGradient || false,
      borderColor2: snap.borderColor2 || '#ff0055',
      isNeon: snap.isNeon || false,
      selectedFormat: snap.selectedFormat || 'webm',
    };
    setNewSceneName('');
    setShowAddForm(false);
    persistScenes([...scenes, newScene]);
  };

  const layoutLabel = (scene) => {
    const l = getSceneLayout(scene);
    if (l === 'audio') return t('recorder.audioOnlyMode');
    if (l === 'camera') return t('recorder.cameraOnlyMode');
    if (l === 'screen+camera') return t('recorder.layoutScreenCamera');
    return t('recorder.layoutScreen');
  };

  return (
    <div className="scenes-tab">
      <p className="scenes-tab-hint">
        {isRecording ? t('recorder.scenesHintRecording') : t('scenes.hint')}
      </p>

      {scenes.length === 0 && !showAddForm && (
        <div className="scenes-empty">
          <span>🎬</span>
          <p>{t('recorder.noScenes')}</p>
          <p className="scenes-empty-sub">{t('scenes.addHint')}</p>
        </div>
      )}

      <div className="scenes-list">
        {scenes.map(scene => {
          const isActive = isRecording && activeLiveSceneId === scene.id;
          const isInactive = isRecording && activeLiveSceneId !== scene.id;
          const isEditing = editingId === scene.id;
          const isConfirmingDelete = confirmDeleteId === scene.id;

          return (
            <div
              key={scene.id}
              className={`scene-card${isActive ? ' scene-card-active' : ''}${isInactive ? ' scene-card-inactive' : ''}`}
            >
              <div
                className="scene-card-body"
                onClick={() => handleSceneClick(scene)}
                title={isRecording ? t('recorder.switchToScene') : t('recorder.applyScene')}
              >
                <span className="scene-card-icon">{getSceneLayoutIcon(scene)}</span>
                <div className="scene-card-text">
                  {isEditing ? (
                    <div className="scene-edit-row" onClick={e => e.stopPropagation()}>
                      <input
                        className="scene-edit-input"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameSave();
                          if (e.key === 'Escape') handleRenameCancel();
                        }}
                        autoFocus
                        maxLength={30}
                      />
                      <button className="sc-btn sc-btn-confirm" onClick={handleRenameSave}>{t('recorder.save')}</button>
                      <button className="sc-btn sc-btn-cancel" onClick={handleRenameCancel}>{t('recorder.cancel')}</button>
                    </div>
                  ) : (
                    <>
                      <span className="scene-card-name">{scene.name}</span>
                      <span className="scene-card-layout">{layoutLabel(scene)}</span>
                    </>
                  )}
                </div>
              </div>

              {!isRecording && !isEditing && (
                <div className="scene-card-actions">
                  {isConfirmingDelete ? (
                    <>
                      <button className="sc-btn sc-btn-danger" onClick={() => handleDeleteConfirm(scene.id)}>
                        {t('scenes.confirmDelete')}
                      </button>
                      <button className="sc-btn sc-btn-cancel" onClick={() => setConfirmDeleteId(null)}>
                        {t('recorder.cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="sc-btn sc-btn-icon"
                        onClick={e => { e.stopPropagation(); handleRenameStart(scene); }}
                        title={t('scenes.editScene')}
                      >✏️</button>
                      <button
                        className="sc-btn sc-btn-icon"
                        onClick={e => { e.stopPropagation(); handleDeleteRequest(scene.id); }}
                        title={t('scenes.deleteScene')}
                      >🗑️</button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isRecording && (
        showAddForm ? (
          <div className="scene-add-form">
            <p className="scene-add-info">
              {getSceneLayoutIcon(window.__recorderSnapshot || {})} {t('recorder.liveSceneSnapshot')}
            </p>
            <div className="scene-add-row">
              <input
                className="scene-edit-input"
                type="text"
                placeholder={t('recorder.sceneName')}
                value={newSceneName}
                onChange={e => setNewSceneName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddScene();
                  if (e.key === 'Escape') { setShowAddForm(false); setNewSceneName(''); }
                }}
                autoFocus
                maxLength={30}
              />
              <button className="sc-btn sc-btn-confirm" onClick={handleAddScene}>{t('recorder.save')}</button>
              <button className="sc-btn sc-btn-cancel" onClick={() => { setShowAddForm(false); setNewSceneName(''); }}>
                {t('recorder.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button className="scene-add-main-btn" onClick={() => setShowAddForm(true)}>
            + {t('recorder.saveScene')}
          </button>
        )
      )}

      <style>{`
        .scenes-tab { display: flex; flex-direction: column; gap: 10px; }
        .scenes-tab-hint { font-size: 0.75rem; color: #888; margin: 0; line-height: 1.4; }
        .scenes-empty {
          display: flex; flex-direction: column; align-items: center;
          padding: 28px 16px; color: #bbb; gap: 4px;
        }
        .scenes-empty span { font-size: 2.2rem; }
        .scenes-empty p { margin: 0; font-size: 0.85rem; }
        .scenes-empty-sub { font-size: 0.72rem !important; color: #ccc; margin-top: 4px !important; text-align: center; }
        .scenes-list { display: flex; flex-direction: column; gap: 6px; }
        .scene-card {
          display: flex; align-items: center; justify-content: space-between;
          border: 2px solid #e0e0e0; border-radius: 10px; background: #fff;
          padding: 10px 12px; gap: 8px; transition: border-color 0.15s;
        }
        .scene-card:hover { border-color: #bbb; }
        .scene-card-active { border-color: #000 !important; background: #000; color: #fff; }
        .scene-card-inactive { opacity: 0.5; }
        .scene-card-body {
          display: flex; align-items: center; gap: 10px;
          flex: 1; cursor: pointer; min-width: 0;
        }
        .scene-card-icon { font-size: 1.15rem; flex-shrink: 0; }
        .scene-card-text { display: flex; flex-direction: column; min-width: 0; }
        .scene-card-name {
          font-size: 0.88rem; font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .scene-card-layout { font-size: 0.7rem; color: #999; margin-top: 1px; }
        .scene-card-active .scene-card-layout { color: #aaa; }
        .scene-card-actions { display: flex; gap: 4px; flex-shrink: 0; }
        .scene-edit-row { display: flex; gap: 5px; align-items: center; }
        .scene-edit-input {
          flex: 1; padding: 5px 8px; border: 2px solid #e0e0e0;
          border-radius: 6px; font-size: 0.85rem; min-width: 0;
        }
        .scene-edit-input:focus { outline: none; border-color: #000; }
        .sc-btn {
          padding: 5px 10px; border: none; border-radius: 6px;
          font-size: 0.78rem; cursor: pointer; font-weight: 600; white-space: nowrap;
        }
        .sc-btn-confirm { background: #000; color: #fff; }
        .sc-btn-cancel { background: #e0e0e0; color: #333; }
        .sc-btn-danger { background: #ff3b30; color: #fff; }
        .sc-btn-icon { background: transparent; font-size: 0.88rem; padding: 4px 5px; }
        .sc-btn-icon:hover { background: #f0f0f0; border-radius: 6px; }
        .scene-add-main-btn {
          width: 100%; padding: 10px; border: 2px dashed #ccc; border-radius: 10px;
          font-size: 0.82rem; cursor: pointer; background: transparent;
          color: #888; transition: all 0.15s; text-align: center;
        }
        .scene-add-main-btn:hover { border-color: #000; color: #000; }
        .scene-add-form {
          border: 2px solid #e0e0e0; border-radius: 10px;
          padding: 12px; background: #fafafa;
        }
        .scene-add-info { font-size: 0.72rem; color: #666; margin: 0 0 8px; line-height: 1.4; }
        .scene-add-row { display: flex; gap: 5px; align-items: center; }
      `}</style>
    </div>
  );
};

export default ScenesTab;
