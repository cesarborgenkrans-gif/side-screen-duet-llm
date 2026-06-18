const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('duet', {
  isElectron: true,
  // read a "Copy as path" file (text or image) or pass through raw text
  readSource: input => ipcRenderer.invoke('read-source', input),
  // LLM (proxied to LM Studio to dodge CORS); accepts a full messages[] array (supports vision)
  llmChat: opts => ipcRenderer.invoke('llm-chat', opts),
  llmModels: opts => ipcRenderer.invoke('llm-models', opts),
  // WaifuVoice add-on: TTS + VRAM telemetry/unload
  ttsGenerate: opts => ipcRenderer.invoke('tts-generate', opts),
  vramTelemetry: baseURL => ipcRenderer.invoke('vram-telemetry', baseURL),
  vramUnload: baseURL => ipcRenderer.invoke('vram-unload', baseURL),
});
