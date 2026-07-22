/* Generated locale packages live in locales/duet-locales.js.
   This adapter owns runtime language metadata and TTS language routing. */
(() => {
  'use strict';

  const packages = window.DUET_LOCALES || {};
  const metadata = [
    { code: 'en', native: 'English', llm: 'English', voxcpm: 'English' },
    { code: 'ja', native: '日本語', llm: 'Japanese', voxcpm: 'Japanese' },
    { code: 'sv', native: 'Svenska', llm: 'Swedish', voxcpm: 'Swedish' },
    { code: 'zh-Hans', native: '简体中文', llm: 'Simplified Chinese', voxcpm: 'Chinese' },
    { code: 'zh-Hant', native: '繁體中文', llm: 'Traditional Chinese', voxcpm: 'Chinese' },
    { code: 'ko', native: '한국어', llm: 'Korean', voxcpm: 'Korean' },
    { code: 'id', native: 'Bahasa Indonesia', llm: 'Indonesian', voxcpm: 'Indonesian' },
    { code: 'vi', native: 'Tiếng Việt', llm: 'Vietnamese', voxcpm: 'Vietnamese' },
    { code: 'th', native: 'ไทย', llm: 'Thai', voxcpm: 'Thai' },
    { code: 'hi', native: 'हिन्दी', llm: 'Hindi', voxcpm: 'Hindi' },
    { code: 'es', native: 'Español', llm: 'Spanish', voxcpm: 'Spanish' },
    { code: 'pt-BR', native: 'Português (Brasil)', llm: 'Brazilian Portuguese', voxcpm: 'Portuguese' },
    { code: 'fr', native: 'Français', llm: 'French', voxcpm: 'French' },
    { code: 'de', native: 'Deutsch', llm: 'German', voxcpm: 'German' },
    { code: 'pl', native: 'Polski', llm: 'Polish', voxcpm: 'Polish' },
    { code: 'tr', native: 'Türkçe', llm: 'Turkish', voxcpm: 'Turkish' },
    { code: 'ru', native: 'Русский', llm: 'Russian', voxcpm: 'Russian' },
    { code: 'uk', native: 'Українська', llm: 'Ukrainian', voxcpm: 'Ukrainian' },
    { code: 'el', native: 'Ελληνικά', llm: 'Greek', voxcpm: 'Greek' },
    { code: 'it', native: 'Italiano', llm: 'Italian', voxcpm: 'Italian' },
    { code: 'ms', native: 'Bahasa Melayu', llm: 'Malay', voxcpm: 'Malay' }
  ];

  window.I18N_LANGS = metadata;
  window.I18N = Object.fromEntries(metadata.map(({ code }) => [code, packages[code]?.strings || {}]));
  window.I18N_REQUIRED_KEYS = Object.keys(packages.en?.strings || {});
  window.I18N_SOURCE_HASH = packages.en?.sourceHash || '';
})();
