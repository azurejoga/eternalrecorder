import React, { createContext, useContext, useState, useEffect } from 'react';
import i18n from '../locales/i18n';

const I18nContext = createContext();

export const I18nProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language);

  useEffect(() => {
    const handleLanguageChange = (lng) => {
      setCurrentLanguage(lng);
    };

    i18n.on('languageChanged', handleLanguageChange);

    // On mount: try to load language from portable config.ini (overrides localStorage/system default)
    if (window.electronAPI?.readConfig) {
      window.electronAPI.readConfig('geral', 'idioma').then((saved) => {
        if (saved && saved !== i18n.language) {
          i18n.changeLanguage(saved);
        }
      }).catch(() => {});
    }

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
    if (window.electronAPI?.writeConfig) {
      window.electronAPI.writeConfig('geral', 'idioma', lng).catch(() => {});
    }
  };

  return (
    <I18nContext.Provider value={{ changeLanguage, currentLanguage }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
