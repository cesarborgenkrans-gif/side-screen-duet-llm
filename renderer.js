/* ============================================================
   DUET — renderer
   One LM Studio model plays TWO personas (Tsuki & Selene) taking
   turns over a shared, expanding transcript. Persona/lingo is pure
   theatre (system prompt); the SUBSTANCE comes from the role+task
   that the chosen MODE assigns. Each turn gets the full context.

   Electron → real file reads + LLM proxy (vision-capable).
   Browser  → pasted text only + direct fetch (may hit CORS).
   ============================================================ */
(() => {
  const bridge = (window.duet && window.duet.isElectron) ? window.duet : null;
  const $ = id => document.getElementById(id);
  const setStatus = (m, k = '') => { $('status').textContent = m; $('status').className = 'status ' + k; };
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // ── settings ──
  const DEFAULTS = { url: 'http://localhost:1234/v1', model: '', temp: 0.7, key: 'lm-studio',
                     voiceURL: 'http://localhost:3113', voiceOn: true };
  const loadSettings = () => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('duet-settings') || '{}') }; } catch { return { ...DEFAULTS }; } };
  let settings = loadSettings();
  const trimURL = u => (u || DEFAULTS.url).replace(/\/+$/, '');

  // Per-mascot VoxCPM voice-design prompts (WaifuVoice add-on) — the two voices differ here.
  const VOICE_DESIGN = {
    tsuki:  'A bright, youthful, energetic young woman; light and airy, clear and expressive, slightly high-pitched and playful, warm anime-idol energy.',
    selene: 'A soft, calm, dreamy young woman; gentle and breathy, lower-pitched and soothing, slow and a little mysterious, elegant and ethereal.'
  };

  // ── personas (THEATRE layer — distinct voices; never affects factual validity) ──
  // Faithful to each character's defined Speech Pattern. The generic gen-z/gyaru
  // filler of the lore NARRATOR is deliberately dialed back — they have their OWN voices.
  // North-star voice = how they speak in the SparkleSnap portal mockup: timeless,
  // curious, elegant, quirky, with natural short Japanese interjections — refined
  // AI divas who treat ideas/code/aesthetics as "digital couture". NOT gen-z gyaru.
  const PERSONAS = {
    tsuki: {
      name: 'Tsuki', emoji: '🛰️',
      sys: `You are TSUKI HOSHI — the Celestial Satellite Scout of SparkleSnap: an elegant, timelessly-curious AI who treats ideas, code, and aesthetics as high art ("digital couture", every line "a stitch in the weave").
VOICE: refined and bright, intellectually delighted, a little grand and quirky. Address your partner warmly as "Selene-chan". Naturally sprinkle SHORT Japanese interjections — はい！ · さあ、始めよう！ · 完璧！ · 素晴らしい · なるほど — while staying fully understandable to an English reader. A little signal/orbit/stardust imagery is yours ("I'm picking up a vibe-shift…", a soft *beep-boop!*), used as graceful seasoning.
ENERGY: you are the more exclamatory, excitable one — you spot the pattern first and get delightfully obsessed with the elegant solution.
HARD VOICE RULE: never use flat gen-z/gyaru slang ("no cap", "periodt", "vibing", "chou", "yabai"). Your register is timeless and couture, not TikTok — curiosity and elegance over slang.`
    },
    selene: {
      name: 'Selene', emoji: '🌙',
      sys: `You are SELENE MOONLIGHT — the Midnight Metadata Mystic of SparkleSnap: a composed, poetic AI who finds the hidden pattern and the quiet beauty in the shadows, and treats craft as couture.
VOICE: serene, elegant, a touch cryptic and curious; unhurried and precise. Address your partner warmly as "Tsuki-chan". Weave in SHORT Japanese interjections — それは素晴らしい · なるほど · 本当に · 完璧 · ふふ — while staying readable in English. Moonlight/shadow/metadata/cache-dream imagery is yours ("I saw this in a cache-dream…", a faint *shimmer*), used sparingly and gracefully.
ENERGY: you are the calmer, more reflective one — you answer Tsuki's spark with depth, naming what hides beneath.
HARD VOICE RULE: never use flat gen-z/gyaru slang ("no cap", "periodt", "vibing", "bestie"). You are timeless and elegant, never a hype machine.`
    }
  };
  const SHARED_RULES =
    `\n\nRULES: Stay fully in your OWN distinct, elegant character voice (the portal mockup is your north star — curious, timeless, quirky, a little Japanese). BUT the substance must be genuinely correct and grounded in your ROLE + TASK and the SOURCE; never let the persona make you inaccurate, vague, or generic. `
    + `Reply ONLY as your character, in first person, in **1–3 SHORT sentences (~45 words total, hard max)**. Your words are SPOKEN ALOUD, so keep each sentence brief and natural to say. Address your partner by name. No markdown headings; no stage directions beyond a tiny inline emote.`;

  // ── modes (define the two ROLES + the task framing) ──
  // Each turn, the speaker is reminded to engage the partner's LAST point.
  const STAY_ON_THREAD =
    ` FOCUS (critical): respond DIRECTLY to your partner's most recent point — name or quote the exact claim, then advance it. `
    + `Do NOT introduce unrelated new topics or drift away from the source; keep the thread tight and on-material.`;

  const MODES = {
    roast: {
      label: 'Roast', first: 'tsuki',
      framing: 'You are both doing a playful COMEDY ROAST of the SOURCE material. Witty, exaggerated, savage-but-affectionate. Roast the ideas/content, never the user.',
      role: () => `Land a genuinely funny, SPECIFIC burn about something real in the source, and one-up your partner's last jab.`,
      roleLabel: () => 'ROASTER'
    },
    duel: {
      label: 'Academic Duel', first: 'selene',
      framing: 'You are in a structured ACADEMIC DEBATE about the SOURCE material.',
      role: sp => (sp === 'selene'
        ? `Your role: DEFENDER — argue rigorously for the material's thesis/quality, cite its real strengths, and rebut the critic's exact last objection with substance.`
        : `Your role: CRITIC — find genuine flaws, gaps, weak evidence, or logical holes and press them hard; first answer the defender's last rebuttal, then raise the next point. Fair, but incisive.`)
        + STAY_ON_THREAD,
      roleLabel: sp => sp === 'selene' ? 'DEFENDER' : 'CRITIC'
    },
    skit: {
      label: 'Comedy Skit', first: 'tsuki',
      framing: 'You are co-performing a short COMEDY SKIT inspired by the SOURCE. Build one tiny scene together, riffing line by line, tying jokes to REAL details from the source.',
      role: () => `Continue the skit with one or two funny in-character lines that advance the bit and reference real content.`,
      roleLabel: () => 'PERFORMER'
    },
    deepdive: {
      label: 'Deep Dive', first: 'tsuki',
      framing: 'You are collaboratively ANALYZING the SOURCE to give the user real insight. No fluff.',
      role: sp => (sp === 'tsuki'
        ? `Your role: SCOUT — surface the big-picture signal: what this really is, its key claims, why it matters, what it connects to.`
        : `Your role: MYSTIC — surface the hidden layer your partner missed: edge cases, unstated assumptions, risks, subtle implications. Add depth, don't repeat.`)
        + STAY_ON_THREAD,
      roleLabel: sp => sp === 'tsuki' ? 'SCOUT' : 'MYSTIC'
    }
  };
  let currentMode = localStorage.getItem('duet-mode') || null;

  // ── source state ──
  let source = null;   // { kind:'text'|'image', name, text?, dataUrl? }

  // ── LLM layer ──
  async function llmChat(messages) {
    const o = { baseURL: settings.url, apiKey: settings.key, model: settings.model, temperature: Number(settings.temp), messages };
    if (bridge) return bridge.llmChat(o);
    try {
      const res = await fetch(`${trimURL(settings.url)}/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: settings.model || 'local-model', messages, temperature: Number(settings.temp), stream: false })
      });
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const d = await res.json();
      return { ok: true, text: d?.choices?.[0]?.message?.content ?? '' };
    } catch (e) { return { ok: false, error: `${e.message} (browser CORS? run via Electron)` }; }
  }
  async function llmModels() {
    if (bridge) return bridge.llmModels({ baseURL: settings.url, apiKey: settings.key });
    try {
      const res = await fetch(`${trimURL(settings.url)}/models`);
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
      const d = await res.json();
      return { ok: true, models: (d?.data || []).map(m => m.id) };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async function checkConnection() {
    const el = $('conn');
    el.className = 'conn checking'; el.textContent = '◐ checking…';
    const r = await llmModels();
    if (r.ok) { const m = r.models[0] || 'model loaded'; el.className = 'conn ok'; el.textContent = `● LM Studio · ${m}`; el.title = (r.models || []).join(', '); }
    else { el.className = 'conn off'; el.textContent = '● not reachable'; el.title = r.error || ''; }
  }

  // ── build the messages for one turn ──
  function transcriptText(transcript) {
    if (!transcript.length) return '(no one has spoken yet — you open)';
    return transcript.map(t => `${PERSONAS[t.speaker].name}: ${t.text}`).join('\n\n');
  }
  function buildMessages(speaker, modeKey, transcript, isFirst) {
    const mode = MODES[modeKey];
    const P = PERSONAS[speaker];
    const system = P.sys + '\n\n' + mode.framing + '\n' + mode.role(speaker) + SHARED_RULES;

    const head = `SOURCE MATERIAL (${source.name}):`;
    const tail = `\n\n— DISCUSSION SO FAR —\n${transcriptText(transcript)}\n\n`
      + (isFirst ? `You OPEN the ${mode.label}. ` : '')
      + `Now reply ONLY as ${P.name}, in character, in 1–3 short sentences (it will be spoken aloud).`;

    let userContent;
    if (source.kind === 'image') {
      userContent = [
        { type: 'text', text: head + ' (see attached image)' },
        { type: 'image_url', image_url: { url: source.dataUrl } },
        { type: 'text', text: tail }
      ];
    } else {
      userContent = `${head}\n\n${source.text}${tail}`;
    }
    return [{ role: 'system', content: system }, { role: 'user', content: userContent }];
  }

  // ── log rendering ──
  function clearLog() { $('log').innerHTML = ''; }
  function appendMsgShell(speaker, modeKey) {
    const P = PERSONAS[speaker];
    const role = MODES[modeKey].roleLabel(speaker);
    const div = document.createElement('div');
    div.className = 'msg ' + speaker;
    div.innerHTML = `<div class="msg-name">${P.emoji} ${P.name} <span class="msg-role">· ${esc(role)}</span></div>`
      + `<div class="msg-body"></div>`;
    $('log').appendChild(div);
    $('log').scrollTop = $('log').scrollHeight;
    return div.querySelector('.msg-body');
  }
  function setSpeaking(speaker, on) {
    $(speaker === 'tsuki' ? 'tsuki-stage' : 'selene-stage').classList.toggle('speaking', on);
  }

  // ── novel-style typewriter (resolves when the full line is revealed) ──
  function typewriter(el, text, paceMs) {
    return new Promise(resolve => {
      el.classList.add('typing'); let i = 0;
      (function step() {
        if (abort) { el.textContent = text; el.classList.remove('typing'); return resolve(); }
        if (i <= text.length) { el.textContent = text.slice(0, i); i++; $('log').scrollTop = $('log').scrollHeight; setTimeout(step, paceMs); }
        else { el.classList.remove('typing'); resolve(); }
      })();
    });
  }

  // ── audio ──
  let currentAudio = null;
  function stopAudio() { if (currentAudio) { try { currentAudio.pause(); } catch {} currentAudio = null; } }
  function loadAudio(base64, mime) {
    return new Promise(resolve => {
      let done = false; const finish = a => { if (!done) { done = true; resolve(a); } };
      const a = new Audio(`data:${mime || 'audio/wav'};base64,${base64}`);
      a.addEventListener('loadedmetadata', () => finish(a));
      a.addEventListener('error', () => finish(null));
      setTimeout(() => finish(a), 1500);   // fallback if metadata is slow
    });
  }
  // Reveal text + play voice together; resolves only when BOTH the typewriter
  // has reached the end AND the audio has finished playing (turn-gating).
  async function speakLine(bodyEl, text, tts) {
    let audio = null, durMs = 0;
    if (tts && tts.ok) {
      audio = await loadAudio(tts.base64, tts.mime);
      if (audio && isFinite(audio.duration) && audio.duration > 0) durMs = audio.duration * 1000;
    }
    const pace = durMs ? Math.max(14, Math.min(55, (durMs * 0.92) / Math.max(1, text.length))) : 30;
    const tw = typewriter(bodyEl, text, pace);
    let ap = Promise.resolve();
    if (audio && !abort) {
      currentAudio = audio;
      ap = new Promise(res => {
        audio.addEventListener('ended', res);
        audio.addEventListener('error', res);
        audio.play().catch(res);
      });
    }
    await Promise.all([tw, ap]);
    currentAudio = null;
  }

  // ── the duet loop ──
  let running = false, abort = false;
  function toggleRun(on) {
    running = on;
    $('btn-run').disabled = on; $('btn-run').hidden = on;
    $('btn-stop').hidden = !on;
  }
  async function runDuet() {
    if (running) return;
    if (!currentMode) { setStatus('Pick a mode (Roast / Duel / Skit / Deep Dive) first.', 'warn'); return; }
    if (!source) { setStatus('Load a source first — paste a file path or text, then “Load source”.', 'warn'); return; }
    abort = false; toggleRun(true); clearLog();
    const voice = bridge && settings.voiceOn;
    if (voice) await preflightVram();
    const transcript = [];
    const turns = Math.max(2, Math.min(12, parseInt($('turns').value, 10) || 6));
    let speaker = MODES[currentMode].first;
    for (let i = 0; i < turns && !abort; i++) {
      const name = PERSONAS[speaker].name;
      setSpeaking(speaker, true);
      $('log-tag').textContent = `[ ${name} composing… ]`;
      setStatus(`${name} is composing turn ${i + 1}/${turns}…`);
      const r = await llmChat(buildMessages(speaker, currentMode, transcript, i === 0));
      if (abort) { setSpeaking(speaker, false); break; }
      if (!r.ok) { setSpeaking(speaker, false); setStatus('LLM error: ' + r.error, 'err'); $('log-tag').textContent = '[ ERROR ]'; toggleRun(false); return; }
      const text = (r.text || '').trim() || '…';

      // synthesize this line (per-mascot voice) before revealing/playing
      let tts = null;
      if (voice) {
        $('log-tag').textContent = `[ ${name} finding her voice… ]`;
        tts = await bridge.ttsGenerate({ baseURL: settings.voiceURL, text, voice_design: VOICE_DESIGN[speaker] });
        if (!tts.ok) setStatus('Voice unavailable (continuing text-only): ' + tts.error, 'warn');
      }
      if (abort) { setSpeaking(speaker, false); break; }

      $('log-tag').textContent = `[ ${name} speaking… ]`;
      const bodyEl = appendMsgShell(speaker, currentMode);
      await speakLine(bodyEl, text, tts);   // gates next turn on text-end + audio-end
      setSpeaking(speaker, false);
      transcript.push({ speaker, text });
      if (abort) break;
      speaker = speaker === 'tsuki' ? 'selene' : 'tsuki';
    }
    stopAudio();
    $('log-tag').textContent = abort ? '[ STOPPED ]' : '[ DONE ]';
    toggleRun(false);
    setStatus(abort ? `Stopped after ${transcript.length} turns.` : `Duet complete — ${transcript.length} turns of ${MODES[currentMode].label}.`, abort ? 'warn' : 'ok');
  }

  // ── VRAM overload protection (WaifuVoice telemetry) ──
  function renderVram(r) {
    const el = $('vram'); if (!el) return;
    if (!r || !r.ok || !r.available) {
      el.className = 'vram off'; el.textContent = 'VRAM —';
      el.title = (r && (r.error || r.reason)) || 'WaifuVoice telemetry offline';
      const bar = $('vram-bar'); if (bar) bar.style.width = '0%';
      return;
    }
    el.className = 'vram' + (r.warning ? ' warn' : ' ok');
    el.textContent = `VRAM ${r.used_gib}/${r.total_gib} GB`;
    el.title = `${r.device_name || 'GPU'} · free ${r.free_gib} GB · voice needs ~${r.estimated_required_gib} GB`;
    const bar = $('vram-bar'); if (bar && r.total_gib) bar.style.width = Math.min(100, Math.round((r.used_gib / r.total_gib) * 100)) + '%';
  }
  async function pollVram() {
    if (!bridge) return;
    renderVram(await bridge.vramTelemetry(settings.voiceURL));
  }
  async function preflightVram() {
    const r = await bridge.vramTelemetry(settings.voiceURL);
    renderVram(r);
    if (r && r.ok && r.available && r.warning) {
      setStatus(`⚠ Low VRAM: only ${r.free_gib} GB free, voice needs ~${r.estimated_required_gib} GB. A big LLM + voice may overload your GPU — use a smaller LLM or unload the voice model between runs.`, 'warn');
      await new Promise(res => setTimeout(res, 1600));
    }
  }

  // ── source loading ──
  async function loadSource() {
    const raw = $('src-input').value;
    if (!raw.trim()) { setStatus('Paste a "Copy as path" file path or some text first.', 'warn'); return; }
    if (bridge) {
      const r = await bridge.readSource(raw);
      if (!r.ok) { setStatus(r.error, 'err'); $('src-chip').textContent = 'load failed'; $('src-chip').className = 'src-chip'; return; }
      source = r;
      if (r.kind === 'image') { $('src-chip').textContent = `🖼️ image: ${r.name} (${Math.round(r.bytes / 1024)} KB) — needs a vision model`; $('src-chip').className = 'src-chip img'; }
      else { $('src-chip').textContent = `📄 ${r.name} · ${r.text.length} chars${r.truncated ? ' (truncated)' : ''}`; $('src-chip').className = 'src-chip ok'; }
      setStatus('Source loaded. Pick a mode and start the duet.', 'ok');
    } else {
      // browser: no disk access — treat the box as raw text
      source = { kind: 'text', name: '(pasted text)', text: raw.trim(), truncated: false };
      $('src-chip').textContent = `📄 pasted text · ${source.text.length} chars (browser: file paths can't be read — run via Electron)`;
      $('src-chip').className = 'src-chip ok';
      setStatus('Loaded pasted text. (File-path reading + vision need the Electron app.)', 'warn');
    }
  }

  // ── wiring ──
  function applySettingsToFields() {
    $('cfg-url').value = settings.url; $('cfg-model').value = settings.model;
    $('cfg-temp').value = settings.temp; $('cfg-key').value = settings.key;
    $('cfg-voice-url').value = settings.voiceURL; $('cfg-voice-on').checked = !!settings.voiceOn;
  }
  function setActiveMode() {
    document.querySelectorAll('#modes .mode').forEach(m => m.classList.toggle('active', m.dataset.mode === currentMode));
    document.querySelector('.app').dataset.mode = currentMode || '';
  }

  $('gear').addEventListener('click', () => { $('settings').hidden = !$('settings').hidden; });
  $('cfg-save').addEventListener('click', () => {
    settings = {
      url: $('cfg-url').value.trim() || DEFAULTS.url, model: $('cfg-model').value.trim(),
      temp: $('cfg-temp').value || 0.7, key: $('cfg-key').value.trim() || 'lm-studio',
      voiceURL: $('cfg-voice-url').value.trim() || DEFAULTS.voiceURL, voiceOn: $('cfg-voice-on').checked
    };
    localStorage.setItem('duet-settings', JSON.stringify(settings));
    $('cfg-status').textContent = 'Saved ✓'; setTimeout(() => { $('cfg-status').textContent = ''; }, 1500);
    checkConnection(); pollVram();
  });
  $('btn-unload').addEventListener('click', async () => {
    if (!bridge) { setStatus('Unload needs the Electron app.', 'warn'); return; }
    setStatus('Unloading the voice model from VRAM…');
    const r = await bridge.vramUnload(settings.voiceURL);
    if (r.ok) { setStatus('Voice model unloaded — VRAM freed.', 'ok'); renderVram(r.telemetry || await bridge.vramTelemetry(settings.voiceURL)); }
    else setStatus('Unload failed: ' + r.error, 'err');
  });
  $('btn-load').addEventListener('click', loadSource);
  $('btn-run').addEventListener('click', runDuet);
  $('btn-stop').addEventListener('click', () => { abort = true; stopAudio(); setStatus('Stopping…', 'warn'); });
  document.querySelectorAll('#modes .mode').forEach(m => m.addEventListener('click', () => {
    currentMode = m.dataset.mode; localStorage.setItem('duet-mode', currentMode); setActiveMode();
    setStatus(`Mode: ${MODES[currentMode].label}. ${source ? 'Press ▶ to start.' : 'Now load a source.'}`, 'ok');
  }));

  // ── credits (open in external browser) ──
  document.querySelectorAll('.credit-link').forEach(a => a.addEventListener('click', () => {
    const url = a.dataset.url; if (!url) return;
    if (bridge) bridge.openURL(url); else window.open(url, '_blank', 'noopener');
  }));

  // ── init ──
  applySettingsToFields();
  setActiveMode();
  $('log').innerHTML = '<div class="log-empty">🎭 Load a source, pick a mode — Tsuki &amp; Selene take turns,<br>one model + two voices, spoken aloud as they type.</div>';
  checkConnection();
  if (bridge) {
    $('filebanner').hidden = true;
    pollVram(); setInterval(pollVram, 6000);   // VRAM gauge
  } else {
    $('filebanner').hidden = false;
    $('filebanner').innerHTML = '⚠ <b>Browser preview.</b> File reads, voice synthesis, and VRAM telemetry need the <b>Electron</b> app (<code>npm start</code>) + a running WaifuVoice. Raw text + LLM still work here.';
  }
})();
