import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import logo from '../assets/logo.png';
import TabNavigation from './TabNavigation';
import RecorderTab from './RecorderTab';
import SettingsTab from './SettingsTab';
import TransmissionTab from './TransmissionTab';
import ScenesTab from './ScenesTab';

const ControlPanel = () => {
  const [activeTab, setActiveTab] = useState('recorder');
  const { t } = useTranslation();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'recorder':
        return <RecorderTab />;
      case 'scenes':
        return <ScenesTab />;
      case 'settings':
        return <SettingsTab />;
      case 'transmission':
        return <TransmissionTab />;
      default:
        return <RecorderTab />;
    }
  };

  return (
    <div className="control-panel">
      <div className="header-container">
        <img src={logo} alt={t('app.name')} className="app-logo" />
        <h1>{t('app.name')}</h1>
      </div>

      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="tab-content-wrapper">
        {renderTabContent()}
      </div>

      <footer className="app-footer">
        <div className="footer-content">
          <span className="footer-copyright">© 2026 Eternal Recorder</span>
          <a href="https://eternal-legend.com.br/" target="_blank" rel="noopener noreferrer" className="footer-link">
            eternal legend
          </a>
        </div>
      </footer>

      <style>{`
        .control-panel {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          width: 100%;
          height: 100vh;
          background: #f5f5f5;
          color: #333;
          padding: 24px;
          box-sizing: border-box;
          font-family: 'Segoe UI', sans-serif;
          overflow-y: auto;
        }

        .header-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 2rem;
          border-bottom: 2px solid #000;
          padding-bottom: 15px;
        }

        .app-logo {
          width: 40px;
          height: 40px;
          object-fit: contain;
        }

        h1 {
          font-size: 1.4rem;
          margin: 0;
          text-transform: none;
          letter-spacing: 0.5px;
          color: #000;
          font-weight: 800;
        }

        .tab-content-wrapper {
          flex: 1;
        }

        .tab-content {
          display: flex;
          flex-direction: column;
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
        }

        .checkbox-label {
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 0.8rem;
            cursor: pointer;
            user-select: none;
        }

        .app-footer {
          border-top: 1px solid #e0e0e0;
          padding-top: 15px;
          margin-top: auto;
        }

        .footer-content {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          font-size: 0.75rem;
          color: #666;
        }

        .footer-copyright {
          font-size: 0.7rem;
        }

        .footer-link {
          color: #00b894;
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s ease;
        }

        .footer-link:hover {
          color: #009688;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
};

export default ControlPanel;
