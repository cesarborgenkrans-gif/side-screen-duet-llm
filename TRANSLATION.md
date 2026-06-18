# 🌐 Translation Methodology (SparkleSnap dashboards)

This is the **reusable i18n method** used in this project. Any agent (or human) extending the
dashboard should follow it so translations stay consistent and never tangle the logic.

## The method in one paragraph
**Static, offline dictionaries** (no live translation API). UI strings carry a stable **key**;
each language is a flat `{ key: "translated text" }` object. The DOM is marked with
`data-i18n` / `data-i18n-ph` attributes; a tiny `t(key, vars)` helper resolves a key for the
current language (falling back to English) and interpolates `{placeholders}`. **One** language
switch retargets **three** surfaces at once:

1. **UI text** — `applyStaticI18n()` walks every `data-i18n*` node and dynamic strings go through `t()`.
2. **LLM reply language** — a `LANGUAGE:` directive built from `langMeta().llm` is appended to each turn's system prompt.
3. **Voice** — `langMeta().voxcpm` is sent as the `language` field to WaifuVoice `/api/generate`.

Why static (not a translation API): this is an **offline kiosk app** — baked dictionaries are
instant, dependency-free, and never break on a dead endpoint. (This mirrors the "pre-translated
static" approach, the most reliable tier.)

## Where everything lives
```text
duet-electron/
├─ i18n.js                  ← THE dictionary + language registry (edit this to add languages/strings)
│   • window.I18N_LANGS[]   = selector order + per-language { code, native, llm, voxcpm }
│   • window.I18N{}         = { en:{key:val,…}, ja:{…}, … }  one flat object per language
│
├─ index.html              ← mark translatable UI with attributes (no logic here)
│   • data-i18n="key"       on the element whose textContent is translated
│   • data-i18n-ph="key"    on inputs/textarea whose placeholder is translated
│   • <select id="lang-select">  the language picker (options filled from I18N_LANGS)
│   • <script src="i18n.js"> loaded BEFORE renderer.js
│
├─ renderer.js             ← the engine (the only place i18n logic lives)
│   • LANGS / DICT / lang   read from window.* ; `lang` persisted in localStorage 'duet-lang'
│   • t(key, vars)          lookup + {var} interpolation + English fallback
│   • tag(key)/modeName(k)  small helpers ( "[ … ]" wrapper, localized mode label )
│   • applyStaticI18n()     walks [data-i18n] / [data-i18n-ph]
│   • langMeta()            current language's { llm, voxcpm } for the LLM + voice
│   • buildMessages()       appends `langDir` (LANGUAGE: write entirely in langMeta().llm)
│   • runDuet()/loadSource()/checkConnection()  all dynamic strings go through t(...)
│   • buildLangSelect()     fills the picker, handles change → applyStaticI18n()+refreshDynamicI18n()
│
├─ style.css               ← `.lang-select` styling only
└─ index.html <head>       ← Noto Sans JP/KR/SC web fonts so every script renders
```

## How to add a LANGUAGE
1. **`i18n.js` → `window.I18N_LANGS`**: add a row
   `{ code: 'xx', native: 'Native name', llm: 'English name for the LLM', voxcpm: 'VoxCPM name' }`.
2. **`i18n.js` → `window.I18N`**: add an `xx: { … }` block with **every key** (copy the `en`
   block and translate the values; keep `{name} {n} {i} {mode} {e} {kb}` placeholders intact).
3. That's it — the selector, UI, LLM language, and voice pick it up automatically. No code edits.

> Keep brand/model names **untranslated**: Tsuki, Selene, SparkleSnap, LM Studio, WaifuVoice, VRAM.

## How to add a translatable STRING
1. **Static UI:** put the text in `index.html` inside a `data-i18n="newkey"` element
   (or `data-i18n-ph` for a placeholder), then add `newkey` to **every** language in `i18n.js`.
2. **Dynamic string (set from JS):** in `renderer.js` use `t('newkey', { var: value })` instead of
   a literal, and add `newkey` (with `{var}` placeholders) to every language in `i18n.js`.
3. Missing keys fall back to English automatically, so you can stage work — but fill all languages
   before shipping.

## Conventions
- **Keys are stable & semantic** (`st_done`, `m_deepdive`), never the English text itself.
- **Interpolation** uses `{var}` tokens; `t()` replaces all occurrences.
- **Emojis** stay outside the translated span (e.g. `📎 <span data-i18n="load">…`), so they're shared.
- **Fallback** is always English (`DICT.en[key]`), then the raw key.
- **Persisted** under `localStorage['duet-lang']`.

## Current languages (10)
English · 日本語 · Svenska · 中文 · 한국어 · Deutsch · Français · Español · Italiano · Português

— part of [SparkleSnap](https://sparklesnap.dev) · © Cesar Borgenkrans.
