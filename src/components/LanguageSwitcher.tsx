import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => changeLanguage('en')}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          i18n.language === 'en'
            ? 'bg-white text-indigo-700'
            : 'bg-indigo-500 text-white hover:bg-indigo-400'
        }`}
        title="English"
      >
        EN
      </button>
      <button
        onClick={() => changeLanguage('ru')}
        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
          i18n.language === 'ru'
            ? 'bg-white text-indigo-700'
            : 'bg-indigo-500 text-white hover:bg-indigo-400'
        }`}
        title="Русский"
      >
        RU
      </button>
    </div>
  );
}

export default LanguageSwitcher;

