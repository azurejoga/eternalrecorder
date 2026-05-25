import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ptBR from './pt-br.json';
import es from './es.json';
import zh from './zh.json';
import fr from './fr.json';
import de from './de.json';
import it from './it.json';
import ja from './ja.json';
import vi from './vi.json';
import th from './th.json';
import hi from './hi.json';
import nl from './nl.json';
import af from './af.json';
import el from './el.json';
import ru from './ru.json';
import uk from './uk.json';
import ko from './ko.json';
import tr from './tr.json';
import ar from './ar.json';
import he from './he.json';
import ca from './ca.json';
import eo from './eo.json';
import zhTW from './zh-TW.json';
import zhYue from './zh-yue.json';
import bo from './bo.json';

const supportedLanguages = [
  'en', 'pt-BR', 'es', 'zh', 'fr', 'de', 'it', 'ja', 'vi', 'th', 'hi', 'nl',
  'af', 'el', 'ru', 'uk', 'ko', 'tr', 'ar', 'he', 'ca', 'eo', 'zh-TW', 'zh-yue', 'bo'
];

function detectSystemLanguage() {
  const saved = localStorage.getItem('language');
  if (saved && supportedLanguages.includes(saved)) return saved;

  const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();

  if (nav === 'pt-br' || nav === 'pt_br') return 'pt-BR';
  if (nav.startsWith('pt')) return 'pt-BR';
  if (nav === 'zh-tw' || nav === 'zh_tw') return 'zh-TW';
  if (nav === 'zh-yue' || nav === 'yue') return 'zh-yue';
  if (nav.startsWith('zh')) return 'zh';
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('fr')) return 'fr';
  if (nav.startsWith('de')) return 'de';
  if (nav.startsWith('it')) return 'it';
  if (nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('vi')) return 'vi';
  if (nav.startsWith('th')) return 'th';
  if (nav.startsWith('hi')) return 'hi';
  if (nav.startsWith('nl')) return 'nl';
  if (nav.startsWith('af')) return 'af';
  if (nav.startsWith('el')) return 'el';
  if (nav.startsWith('ru')) return 'ru';
  if (nav.startsWith('uk')) return 'uk';
  if (nav.startsWith('ko')) return 'ko';
  if (nav.startsWith('tr')) return 'tr';
  if (nav.startsWith('ar')) return 'ar';
  if (nav.startsWith('he') || nav.startsWith('iw')) return 'he';
  if (nav.startsWith('ca')) return 'ca';
  if (nav.startsWith('eo')) return 'eo';
  if (nav.startsWith('bo')) return 'bo';
  return 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      'pt-BR': { translation: ptBR },
      es: { translation: es },
      zh: { translation: zh },
      fr: { translation: fr },
      de: { translation: de },
      it: { translation: it },
      ja: { translation: ja },
      vi: { translation: vi },
      th: { translation: th },
      hi: { translation: hi },
      nl: { translation: nl },
      af: { translation: af },
      el: { translation: el },
      ru: { translation: ru },
      uk: { translation: uk },
      ko: { translation: ko },
      tr: { translation: tr },
      ar: { translation: ar },
      he: { translation: he },
      ca: { translation: ca },
      eo: { translation: eo },
      'zh-TW': { translation: zhTW },
      'zh-yue': { translation: zhYue },
      bo: { translation: bo }
    },
    lng: detectSystemLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
