import React from 'react';
import { useTranslation } from 'react-i18next';

const TabNavigation = ({ activeTab, onTabChange }) => {
  const { t } = useTranslation();

  const tabs = [
    { id: 'recorder', label: t('tabs.recorder') },
    { id: 'scenes', label: t('tabs.scenes') },
    { id: 'settings', label: t('tabs.settings') },
    { id: 'transmission', label: t('tabs.transmission') }
  ];

  return (
    <>
      <div className="tab-navigation" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <style>{`
        .tab-navigation {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          border-bottom: 2px solid #e0e0e0;
          padding-bottom: 0;
        }

        .tab-button {
          flex: 1;
          padding: 12px 16px;
          border: none;
          background: transparent;
          color: #666;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          transition: all 0.2s ease;
          text-transform: uppercase;
        }

        .tab-button:hover {
          color: #000;
          background: #f0f0f0;
        }

        .tab-button.active {
          color: #000;
          border-bottom-color: #000;
        }
      `}</style>
    </>
  );
};

export default TabNavigation;
