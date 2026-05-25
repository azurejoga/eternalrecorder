import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useI18n } from '../contexts/I18nContext';

const DEFAULT_SHORTCUTS = {
  start: 'Control+Shift+R',
  stop: 'Control+Shift+S',
  pause: 'Control+Shift+P',
  mute: 'Control+Shift+M',
  'toggle-audio': 'Control+Shift+A',
  'toggle-window': 'Control+Shift+H',
};

const DEFAULT_REC_SETTINGS = {
  fps: '30',
  videoBitrate: '2500',
  audioBitrate: '192',
  resolution: 'source',
  closeBehavior: 'exit', // 'exit' = close completely, 'tray' = minimize to tray
};

function toDisplay(acc) {
  return (acc || '')
    .replace('Control', 'Ctrl')
    .replace('CommandOrControl', 'Ctrl');
}

function captureKeys(e) {
  const mods = [];
  if (e.ctrlKey || e.metaKey) mods.push('Control');
  if (e.shiftKey) mods.push('Shift');
  if (e.altKey) mods.push('Alt');
  const skip = ['Control', 'Shift', 'Alt', 'Meta', 'OS'];
  const key = e.key;
  if (!skip.includes(key)) {
    const k = key.length === 1 ? key.toUpperCase() : key;
    mods.push(k);
  }
  return mods.length > 1 ? mods.join('+') : null;
}

const SettingsTab = () => {
  const { t } = useTranslation();
  const { changeLanguage, currentLanguage } = useI18n();
  const [appVersion, setAppVersion] = useState('');

  const [shortcuts, setShortcuts] = useState({ ...DEFAULT_SHORTCUTS });
  const [editingAction, setEditingAction] = useState(null);
  const [capturedKey, setCapturedKey] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  const [recSettings, setRecSettings] = useState({ ...DEFAULT_REC_SETTINGS });
  const [recSaveMsg, setRecSaveMsg] = useState('');

  useEffect(() => {
    if (window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion().then(v => setAppVersion(v)).catch(() => {});
    }
    if (window.electronAPI?.getShortcuts) {
      window.electronAPI.getShortcuts().then(map => {
        if (map) setShortcuts({ ...DEFAULT_SHORTCUTS, ...map });
      }).catch(() => {});
    }
    if (window.electronAPI?.getRecordingSettings) {
      window.electronAPI.getRecordingSettings().then(s => {
        if (s) setRecSettings({ ...DEFAULT_REC_SETTINGS, ...s });
      }).catch(() => {});
    }
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (!editingAction) return;
    e.preventDefault();
    e.stopPropagation();
    const combo = captureKeys(e);
    if (combo) setCapturedKey(combo);
  }, [editingAction]);

  const startEdit = (action) => {
    setEditingAction(action);
    setCapturedKey('');
  };

  const confirmEdit = async () => {
    if (!capturedKey) { setEditingAction(null); return; }
    const updated = { ...shortcuts, [editingAction]: capturedKey };
    setShortcuts(updated);
    setEditingAction(null);
    setCapturedKey('');
    if (window.electronAPI?.saveShortcuts) {
      const r = await window.electronAPI.saveShortcuts(updated);
      setSaveMsg(r?.success ? t('settings.shortcutSaved') : (r?.error || ''));
      setTimeout(() => setSaveMsg(''), 2500);
    }
  };

  const cancelEdit = () => { setEditingAction(null); setCapturedKey(''); };

  const resetAll = async () => {
    setShortcuts({ ...DEFAULT_SHORTCUTS });
    if (window.electronAPI?.saveShortcuts) {
      await window.electronAPI.saveShortcuts({ ...DEFAULT_SHORTCUTS });
    }
    setSaveMsg(t('settings.shortcutSaved'));
    setTimeout(() => setSaveMsg(''), 2500);
  };

  const saveRecSettings = async (updated) => {
    setRecSettings(updated);
    if (window.electronAPI?.saveRecordingSettings) {
      const r = await window.electronAPI.saveRecordingSettings(updated);
      setRecSaveMsg(r?.success ? t('settings.shortcutSaved') : (r?.error || ''));
      setTimeout(() => setRecSaveMsg(''), 2000);
    }
  };

  const shortcutRows = [
    { action: 'start',         label: t('settings.shortcutStart') },
    { action: 'stop',          label: t('settings.shortcutStop') },
    { action: 'pause',         label: t('settings.shortcutPause') },
    { action: 'mute',          label: t('settings.shortcutMute') },
    { action: 'toggle-audio',  label: t('settings.shortcutToggleAudio') },
    { action: 'toggle-window', label: t('settings.shortcutToggleWindow') },
  ];

  const languages = [
    { code: 'en',     name: t('settings.language_en') },
    { code: 'pt-BR',  name: t('settings.language_pt_br') },
    { code: 'es',     name: t('settings.language_es') },
    { code: 'zh',     name: t('settings.language_zh') },
    { code: 'fr',     name: t('settings.language_fr') },
    { code: 'de',     name: t('settings.language_de') },
    { code: 'it',     name: t('settings.language_it') },
    { code: 'ja',     name: t('settings.language_ja') },
    { code: 'vi',     name: t('settings.language_vi') },
    { code: 'th',     name: t('settings.language_th') },
    { code: 'hi',     name: t('settings.language_hi') },
    { code: 'nl',     name: t('settings.language_nl') },
    { code: 'af',     name: t('settings.language_af') },
    { code: 'el',     name: t('settings.language_el') },
    { code: 'ru',     name: t('settings.language_ru') },
    { code: 'uk',     name: t('settings.language_uk') },
    { code: 'ko',     name: t('settings.language_ko') },
    { code: 'tr',     name: t('settings.language_tr') },
    { code: 'ar',     name: t('settings.language_ar') },
    { code: 'he',     name: t('settings.language_he') },
    { code: 'ca',     name: t('settings.language_ca') },
    { code: 'eo',     name: t('settings.language_eo') },
    { code: 'zh-TW',  name: t('settings.language_zh_tw') },
    { code: 'zh-yue', name: t('settings.language_zh_yue') },
    { code: 'bo',     name: t('settings.language_bo') },
  ];

  return (
    <div className="tab-content settings-tab" onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Language */}
      <div className="settings-group">
        <label>{t('settings.language')}</label>
        <div className="custom-select">
          <select
            value={currentLanguage}
            onChange={(e) => changeLanguage(e.target.value)}
            aria-label={t('settings.language')}
          >
            {languages.map(lang => (
              <option key={lang.code} value={lang.code}>{lang.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Shortcuts editor */}
      <div className="settings-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label style={{ margin: 0 }}>{t('settings.shortcuts')}</label>
          <button className="btn-reset-shortcuts" onClick={resetAll}>
            {t('settings.shortcutReset')}
          </button>
        </div>
        {saveMsg && <div className="shortcut-save-msg">{saveMsg}</div>}
        <div className="shortcuts-list" role="list">
          {shortcutRows.map(({ action, label }) => (
            <div key={action} className="shortcut-row" role="listitem">
              <span className="shortcut-label">{label}</span>
              {editingAction === action ? (
                <div className="shortcut-capture-row">
                  <div
                    className="shortcut-capture-box"
                    tabIndex={0}
                    onKeyDown={handleKeyDown}
                    autoFocus
                  >
                    {capturedKey ? toDisplay(capturedKey) : t('settings.shortcutCapture')}
                  </div>
                  <button className="btn-sc-ok" onClick={confirmEdit} disabled={!capturedKey}>✓</button>
                  <button className="btn-sc-cancel" onClick={cancelEdit}>✕</button>
                </div>
              ) : (
                <div className="shortcut-display-row">
                  <kbd className="shortcut-keys">{toDisplay(shortcuts[action])}</kbd>
                  <button className="btn-sc-edit" onClick={() => startEdit(action)}>
                    {t('settings.shortcutEdit')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recording quality settings */}
      <div className="settings-group">
        <label style={{ marginBottom: 8, display: 'block' }}>{t('settings.recordingQuality')}</label>
        {recSaveMsg && <div className="shortcut-save-msg">{recSaveMsg}</div>}
        <div className="rec-settings-grid">
          <label className="rec-label">{t('settings.recFps')}</label>
          <div className="custom-select">
            <select value={recSettings.fps} onChange={e => saveRecSettings({ ...recSettings, fps: e.target.value })} aria-label={t('settings.recFps')}>
              <option value="24">24 fps</option>
              <option value="30">30 fps</option>
              <option value="60">60 fps</option>
            </select>
          </div>

          <label className="rec-label">{t('settings.recVideoBitrate')}</label>
          <div className="custom-select">
            <select value={recSettings.videoBitrate} onChange={e => saveRecSettings({ ...recSettings, videoBitrate: e.target.value })} aria-label={t('settings.recVideoBitrate')}>
              <option value="1000">1 Mbps</option>
              <option value="2500">2.5 Mbps</option>
              <option value="5000">5 Mbps</option>
              <option value="8000">8 Mbps</option>
            </select>
          </div>

          <label className="rec-label">{t('settings.recAudioBitrate')}</label>
          <div className="custom-select">
            <select value={recSettings.audioBitrate} onChange={e => saveRecSettings({ ...recSettings, audioBitrate: e.target.value })} aria-label={t('settings.recAudioBitrate')}>
              <option value="96">96 kbps</option>
              <option value="128">128 kbps</option>
              <option value="192">192 kbps</option>
              <option value="320">320 kbps</option>
            </select>
          </div>

          <label className="rec-label">{t('settings.recResolution')}</label>
          <div className="custom-select">
            <select value={recSettings.resolution} onChange={e => saveRecSettings({ ...recSettings, resolution: e.target.value })} aria-label={t('settings.recResolution')}>
              <option value="source">{t('settings.recResolutionSource')}</option>
              <option value="1920:1080">1920×1080</option>
              <option value="1280:720">1280×720</option>
              <option value="854:480">854×480</option>
            </select>
          </div>

          <label className="rec-label">{t('settings.closeBehavior')}</label>
          <div className="custom-select">
            <select value={recSettings.closeBehavior || 'exit'} onChange={e => saveRecSettings({ ...recSettings, closeBehavior: e.target.value })} aria-label={t('settings.closeBehavior')}>
              <option value="exit">{t('settings.closeBehaviorExit')}</option>
              <option value="tray">{t('settings.closeBehaviorTray')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ASIO notice */}
      <div className="settings-group asio-notice">
        <label>{t('settings.asioTitle')}</label>
        <p className="asio-text">{t('settings.asioDesc')}</p>
      </div>

      {appVersion && (
        <div className="settings-group version-group">
          <div className="version-info">
            <span className="version-label">{t('settings.version')}</span>
            <span className="version-value">{appVersion}</span>
          </div>
        </div>
      )}

      <style>{`
        .shortcuts-list { display: flex; flex-direction: column; gap: 4px; }
        .shortcut-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 6px 0; border-bottom: 1px solid #f0f0f0;
        }
        .shortcut-label { font-size: 0.82rem; color: #333; flex: 1; }
        .shortcut-display-row { display: flex; align-items: center; gap: 6px; }
        .shortcut-keys {
          font-family: 'Consolas', monospace; font-size: 0.73rem;
          background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px;
          padding: 2px 6px; color: #333; white-space: nowrap;
        }
        .btn-sc-edit {
          padding: 3px 8px; font-size: 0.72rem; background: #e8f4fd;
          border: 1px solid #90caf9; border-radius: 4px; cursor: pointer; color: #1565c0;
        }
        .btn-sc-edit:hover { background: #bbdefb; }
        .shortcut-capture-row { display: flex; align-items: center; gap: 5px; }
        .shortcut-capture-box {
          min-width: 120px; padding: 4px 8px; border: 2px solid #1976d2;
          border-radius: 6px; font-size: 0.75rem; font-family: 'Consolas', monospace;
          background: #e3f2fd; color: #0d47a1; cursor: default; text-align: center;
          outline: none;
        }
        .btn-sc-ok {
          padding: 3px 8px; font-size: 0.78rem; background: #4caf50;
          border: none; border-radius: 4px; cursor: pointer; color: #fff;
        }
        .btn-sc-ok:disabled { background: #ccc; cursor: not-allowed; }
        .btn-sc-cancel {
          padding: 3px 7px; font-size: 0.78rem; background: #ef5350;
          border: none; border-radius: 4px; cursor: pointer; color: #fff;
        }
        .btn-reset-shortcuts {
          padding: 3px 10px; font-size: 0.72rem; background: #f5f5f5;
          border: 1px solid #bbb; border-radius: 5px; cursor: pointer; color: #555;
        }
        .btn-reset-shortcuts:hover { background: #eeeeee; }
        .shortcut-save-msg {
          font-size: 0.75rem; color: #2e7d32; background: #e8f5e9;
          border-radius: 5px; padding: 4px 8px; margin-bottom: 6px;
        }
        .rec-settings-grid {
          display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; align-items: center;
        }
        .rec-label { font-size: 0.82rem; color: #333; }
        .asio-notice { background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px; padding: 8px 10px; }
        .asio-text { font-size: 0.78rem; color: #6d4c00; margin: 4px 0 0; line-height: 1.5; }
        .version-group { margin-top: 8px; }
        .version-info {
          display: flex; justify-content: space-between;
          font-size: 0.8rem; color: #666; margin-bottom: 4px;
        }
        .version-label { font-weight: 700; text-transform: uppercase; }
        .update-status {
          font-size: 0.78rem; color: #555; background: #f5f5f5;
          border-radius: 6px; padding: 6px 10px;
        }
      `}</style>
    </div>
  );
};

export default SettingsTab;
