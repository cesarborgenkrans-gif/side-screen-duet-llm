const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('duet', {
  isElectron: true,
  // read a "Copy as path" file (text or image) or pass through raw text
  readSource: input => ipcRenderer.invoke('read-source', input),
  // LLM (proxied to LM Studio to dodge CORS); accepts a full messages[] array (supports vision)
  llmChat: opts => ipcRenderer.invoke('llm-chat', opts),
  llmModels: opts => ipcRenderer.invoke('llm-models', opts),
  // Compatible local TTS: generation + VRAM telemetry/unload
  ttsGenerate: opts => ipcRenderer.invoke('tts-generate', opts),
  vramTelemetry: baseURL => ipcRenderer.invoke('vram-telemetry', baseURL),
  openURL: url => ipcRenderer.invoke('open-url', url),
  // move the frameless window: 'panel' (side screen) | 'main' (primary strip) | undefined (toggle)
  moveWindow: target => ipcRenderer.invoke('move-window', target),
  windowLocation: () => ipcRenderer.invoke('window-location'),
});
