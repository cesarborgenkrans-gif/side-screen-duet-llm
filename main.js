/* ============================================================
   DUET — main process
   Frameless window sized to the exact bounds of the target panel.
   IPC: read-source (a "Copy as path" file → text or base64 image, or raw text),
   llm-chat (messages[]-based, proxied to LM Studio to dodge CORS + support vision),
   llm-models (connection test). One LM Studio model drives both personas.
   ============================================================ */
const { app, BrowserWindow, screen, ipcMain, globalShortcut, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');

const TARGET_X = parseInt(process.env.FOUNDRY_TARGET_X || '3440', 10);
const WINDOWED = process.argv.includes('--windowed');
const MAX_TEXT = 60000;   // cap pasted/loaded document size sent to the model

let mainWindow = null;

function logDisplays() {
  const primaryId = screen.getPrimaryDisplay().id;
  const info = screen.getAllDisplays().map((d, i) => ({
    index: i, id: d.id, primary: d.id === primaryId,
    bounds: d.bounds, size: d.size, rotation: d.rotation, scaleFactor: d.scaleFactor
  }));
  try { fsSync.writeFileSync(path.join(__dirname, 'displays-detected.json'), JSON.stringify(info, null, 2)); } catch {}
}

function pickTargetDisplay() {
  const displays = screen.getAllDisplays();
  const idx = parseInt(process.env.FOUNDRY_TARGET_DISPLAY ?? '', 10);
  if (!Number.isNaN(idx) && displays[idx]) return displays[idx];
  const sig = displays.find(d => {
    const { width: w, height: h } = d.bounds;
    return (w === 1440 && h === 2560) || (w === 2560 && h === 1440);
  });
  if (sig) return sig;
  const byX = displays.find(d => d.bounds.x >= TARGET_X);
  if (byX) return byX;
  const primaryId = screen.getPrimaryDisplay().id;
  return displays.find(d => d.id !== primaryId) || displays[displays.length - 1];
}

function createWindow() {
  const base = {
    frame: false, resizable: false, movable: false, alwaysOnTop: true,
    backgroundColor: '#0d0d1a',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true }
  };
  if (WINDOWED) {
    mainWindow = new BrowserWindow({ ...base, width: 480, height: 854, frame: true, resizable: true, movable: true, alwaysOnTop: false });
  } else {
    const t = pickTargetDisplay();
    const b = t.bounds;
    mainWindow = new BrowserWindow({ ...base, x: b.x, y: b.y, width: b.width, height: b.height });
    const enforce = () => { try { mainWindow.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height }); } catch {} };
    mainWindow.once('ready-to-show', enforce);
    mainWindow.webContents.once('did-finish-load', enforce);
  }
  mainWindow.loadFile('index.html');
  mainWindow.on('closed', () => (mainWindow = null));
}

// ── read a source: file path (text/image) or raw pasted text ──
const IMG_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp' };
ipcMain.handle('read-source', async (_e, raw) => {
  let s = String(raw ?? '').trim();
  // strip surrounding quotes that Windows "Copy as path" adds
  if (s.length >= 2 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) s = s.slice(1, -1);
  if (!s) return { ok: false, error: 'Nothing to read — paste a file path or some text.' };
  let stat = null; try { stat = await fs.stat(s); } catch {}
  if (stat && stat.isFile()) {
    const ext = path.extname(s).toLowerCase();
    if (IMG_MIME[ext]) {
      const buf = await fs.readFile(s);
      return { ok: true, kind: 'image', name: path.basename(s), mime: IMG_MIME[ext],
               dataUrl: `data:${IMG_MIME[ext]};base64,${buf.toString('base64')}`, bytes: buf.length };
    }
    try {
      let text = await fs.readFile(s, 'utf8');
      const truncated = text.length > MAX_TEXT;
      if (truncated) text = text.slice(0, MAX_TEXT);
      return { ok: true, kind: 'text', name: path.basename(s), text, truncated };
    } catch (e) { return { ok: false, error: `Could not read ${path.basename(s)} as text: ${e.message}` }; }
  }
  // not a file → treat as raw text
  let text = s; const truncated = text.length > MAX_TEXT; if (truncated) text = text.slice(0, MAX_TEXT);
  return { ok: true, kind: 'text', name: '(pasted text)', text, truncated };
});

// ── LLM chat (messages[] passthrough, supports vision content parts) ──
ipcMain.handle('llm-chat', async (_e, opts) => {
  const { baseURL, apiKey, model, temperature, messages } = opts || {};
  try {
    const url = `${(baseURL || 'http://localhost:1234/v1').replace(/\/+$/, '')}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey || 'lm-studio'}` },
      body: JSON.stringify({ model: model || 'local-model', messages, temperature: typeof temperature === 'number' ? temperature : 0.7,
        frequency_penalty: 0.6, presence_penalty: 0.4, stream: false })
    });
    if (!res.ok) return { ok: false, error: `LM Studio HTTP ${res.status}: ${(await res.text()).slice(0, 240)}` };
    const data = await res.json();
    return { ok: true, text: data?.choices?.[0]?.message?.content ?? '' };
  } catch (e) {
    return { ok: false, error: `${e.message} — is LM Studio's server running (Developer ▸ Start Server)?` };
  }
});

ipcMain.handle('llm-models', async (_e, opts) => {
  const { baseURL, apiKey } = opts || {};
  try {
    const url = `${(baseURL || 'http://localhost:1234/v1').replace(/\/+$/, '')}/models`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey || 'lm-studio'}` } });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, models: (data?.data || []).map(m => m.id) };
  } catch (e) { return { ok: false, error: e.message }; }
});

// ── WaifuVoice add-on: synthesize a line → WAV (base64) ──
const trimU = u => (u || 'http://localhost:3113').replace(/\/+$/, '');
ipcMain.handle('tts-generate', async (_e, opts) => {
  const { baseURL, text, voice_design, language, cfg_value, inference_timesteps, seed } = opts || {};
  try {
    const res = await fetch(`${trimU(baseURL)}/api/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text, voice_design: voice_design || '', language: language || 'English', mode: 'voice-design',
        cfg_value: cfg_value ?? 2.0, inference_timesteps: inference_timesteps ?? 10,
        seed: seed ?? -1, max_len: 4096, denoise: false, consent_ack: true
      })
    });
    if (!res.ok) return { ok: false, error: `WaifuVoice HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: true, base64: buf.toString('base64'), mime: 'audio/wav', sampleRate: res.headers.get('X-Sample-Rate') || '' };
  } catch (e) { return { ok: false, error: `${e.message} — is WaifuVoice running at ${trimU(baseURL)}?` }; }
});

// ── WaifuVoice VRAM telemetry / unload (overload protection) ──
ipcMain.handle('vram-telemetry', async (_e, baseURL) => {
  try {
    const res = await fetch(`${trimU(baseURL)}/api/vram`);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, ...(await res.json()) };
  } catch (e) { return { ok: false, error: e.message }; }
});
// ── open a credit link in the external browser ──
ipcMain.handle('open-url', async (_e, url) => {
  if (!/^https?:\/\//.test(url)) return { ok: false, error: 'invalid URL' };
  try { await shell.openExternal(url); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});

app.whenReady().then(() => {
  logDisplays();
  createWindow();
  globalShortcut.register('Escape', () => app.quit());
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
