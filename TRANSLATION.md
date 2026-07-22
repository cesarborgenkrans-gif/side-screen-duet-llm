# Translation maintenance

Duet ships static, offline locale packages for 21 languages. One language
selector retargets the interface, the requested LLM reply language, and the
optional local voice language.

## Runtime files

- `locales/*.json` contains one reviewable package per locale.
- `locales/duet-locales.js` is the generated browser/Electron bundle.
- `i18n.js` maps those packages to runtime metadata and voice-language names.
- `renderer.js` resolves stable keys through `t(key, vars)` with English as the
  fallback.

Generated locale files should not be hand-edited. The durable translation
source is maintained in the SparkleSnap Translation Center and exported into
this repository after validation. Public contributors can propose source-copy
changes or report translation corrections through GitHub issues.

## Interface conventions

- Use `data-i18n="key"` for element text.
- Use `data-i18n-ph="key"` for placeholders.
- Use `data-i18n-title="key"` for accessible titles.
- Use `t('key', { name: value })` for dynamic copy.
- Keep placeholders such as `{name}`, `{n}`, and `{required}` unchanged.
- Keep product and model names such as Tsuki, Selene, SparkleSnap, LM Studio,
  WaifuVoice, and VRAM unchanged.

Run `npm run check:i18n` before publishing. It verifies that every shipped
language contains every English source key and that the export carries a source
hash.
