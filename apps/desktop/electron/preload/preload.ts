import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },

  // Launcher window
  minimizeLauncher: () => ipcRenderer.invoke('window:minimize'),
  maximizeLauncher: () => ipcRenderer.invoke('window:maximize'),
  closeLauncher: () => ipcRenderer.invoke('window:close'),
  isLauncherMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  switchToLauncher: () => ipcRenderer.invoke('window:switchToLauncher'),
  switchToOverlay: () => ipcRenderer.invoke('window:switchToOverlay'),

  // Overlay
  toggleOverlay: () => ipcRenderer.invoke('overlay:toggle'),
  showOverlay: () => ipcRenderer.invoke('overlay:show'),
  hideOverlay: () => ipcRenderer.invoke('overlay:hide'),
  setOverlayOpacity: (opacity: number) => ipcRenderer.invoke('overlay:setOpacity', opacity),
  setOverlayPassthrough: (enabled: boolean) => ipcRenderer.invoke('overlay:setPassthrough', enabled),
  setOverlaySize: (width: number, height: number) => ipcRenderer.invoke('overlay:setSize', width, height),
  resizeToContent: (w: number, h: number) => ipcRenderer.invoke('overlay:resizeToContent', w, h),

  // Disguise
  setDisguiseMode: (mode: string) => ipcRenderer.invoke('disguise:set', mode),

  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  exitApp: () => ipcRenderer.invoke('app:exit'),

  // Screen capture
  captureScreenshot: () => ipcRenderer.invoke('screenshot:capture'),
  captureScreenshotSilent: () => ipcRenderer.invoke('screenshot:captureSilent'),

  // AI query
  sendQuery: (payload: { query: string; apiKey: string; model: string; systemPrompt?: string; baseUrl?: string; history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>; useOpenAICompat?: boolean; openAICompatUrl?: string; openAICompatModel?: string; openAICompatKey?: string }) => ipcRenderer.invoke('ai:query', payload),
  sendVisionQuery: (payload: { text: string; imageBase64: string; apiKey: string; model: string; baseUrl?: string; systemPrompt?: string; history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>; useOpenAICompat?: boolean; openAICompatUrl?: string; openAICompatModel?: string; openAICompatKey?: string }) => ipcRenderer.invoke('ai:vision', payload),
  transcribeAudio: (payload: { audioBase64: string; apiKey: string; model: string; mimeType?: string }) => ipcRenderer.invoke('deepgram:transcribe', payload),

  // Audio capture (native module bridge)
  onAudioChunk: (callback: (chunk: Buffer) => void) => {
    ipcRenderer.on('audio:chunk', (_event, chunk) => callback(chunk));
  },
  onTranscriptSegment: (callback: (segment: { speakerId: string; text: string; isFinal: boolean }) => void) => {
    ipcRenderer.on('transcript:segment', (_event, segment) => callback(segment));
  },
  startAudioCapture: () => ipcRenderer.invoke('audio:start'),
  stopAudioCapture: () => ipcRenderer.invoke('audio:stop'),

  // Events from main process
  onStartRecording: (callback: () => void) => {
    ipcRenderer.on('shortcut:start-recording', () => callback());
  },
  onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
    ipcRenderer.on('window:fullscreen', (_event, isFullscreen) => callback(isFullscreen));
  },

  // Mobile web view
  mobileStart: (port: number) => ipcRenderer.invoke('mobile:start', port),
  mobileStop: () => ipcRenderer.invoke('mobile:stop'),
  mobileUpdate: (html: string) => ipcRenderer.invoke('mobile:update', html),
  mobileStatus: () => ipcRenderer.invoke('mobile:status'),

  // Screenshot + AI
  analyzeScreenshot: (context: string) => ipcRenderer.invoke('screenshot:analyze', context),

  // RAG System
  ragIndexProject: (projectPath: string, projectName?: string) => ipcRenderer.invoke('rag:index', projectPath, projectName),
  ragSearch: (query: string, projectName?: string, topK?: number) => ipcRenderer.invoke('rag:search', query, projectName, topK),
  ragChat: (message: string, projectName?: string, conversationId?: string) => ipcRenderer.invoke('rag:chat', message, projectName, conversationId),
  ragStatus: () => ipcRenderer.invoke('rag:status'),
  ragConversations: () => ipcRenderer.invoke('rag:conversations'),
  ragCreateConversation: (projectName?: string) => ipcRenderer.invoke('rag:createConversation', projectName),
  ragDeleteConversation: (conversationId: string) => ipcRenderer.invoke('rag:deleteConversation', conversationId),
  ragGetConfig: () => ipcRenderer.invoke('rag:getConfig'),
  ragSetConfig: (config: { mode?: string; ollamaUrl?: string; customEndpoint?: string; apiKey?: string; embeddingModel?: string; chatModel?: string }) => ipcRenderer.invoke('rag:setConfig', config),
  ragClear: () => ipcRenderer.invoke('rag:clear'),

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
});

declare global {
  interface Window {
    electronAPI: {
      platform: NodeJS.Platform;
      versions: { node: string; chrome: string; electron: string };

      minimizeLauncher: () => Promise<void>;
      maximizeLauncher: () => Promise<void>;
      closeLauncher: () => Promise<void>;
      isLauncherMaximized: () => Promise<boolean>;
      switchToLauncher: () => Promise<void>;
      switchToOverlay: () => Promise<void>;

      toggleOverlay: () => Promise<void>;
      showOverlay: () => Promise<void>;
      hideOverlay: () => Promise<void>;
      setOverlayOpacity: (opacity: number) => Promise<void>;
      setOverlayPassthrough: (enabled: boolean) => Promise<void>;
      setOverlaySize: (width: number, height: number) => Promise<void>;
      resizeToContent: (w: number, h: number) => Promise<void>;

      setDisguiseMode: (mode: string) => Promise<void>;

      getVersion: () => Promise<string>;
      getPlatform: () => Promise<string>;
      exitApp: () => Promise<void>;

      captureScreenshot: () => Promise<string | null>;
      captureScreenshotSilent: () => Promise<string | null>;
      sendQuery: (payload: { query: string; apiKey: string; model: string; systemPrompt?: string; baseUrl?: string; history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> }) => Promise<{ response: string }>;
      sendVisionQuery: (payload: { text: string; imageBase64: string; apiKey: string; model: string; baseUrl?: string; systemPrompt?: string; history?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> }) => Promise<{ response: string }>;
      transcribeAudio: (payload: { audioBase64: string; apiKey: string; model: string; mimeType?: string }) => Promise<{ text: string }>;
      mobileStart: (port: number) => Promise<{ port: number }>;
      mobileStop: () => Promise<{ stopped: boolean }>;
      mobileUpdate: (html: string) => Promise<{ updated: boolean }>;
      mobileStatus: () => Promise<{ running: boolean; port: number }>;

      onAudioChunk: (callback: (chunk: Buffer) => void) => void;
      onTranscriptSegment: (callback: (segment: { speakerId: string; text: string; isFinal: boolean }) => void) => void;
      startAudioCapture: () => Promise<void>;
      stopAudioCapture: () => Promise<void>;

      onStartRecording: (callback: () => void) => void;
      onFullscreenChange: (callback: (isFullscreen: boolean) => void) => void;

      // RAG System
      ragIndexProject: (projectPath: string, projectName?: string) => Promise<{ status: string; files?: number; chunks?: number; error?: string }>;
      ragSearch: (query: string, projectName?: string, topK?: number) => Promise<{ results?: Array<{ content: string; metadata: any; score: number }>; error?: string }>;
      ragChat: (message: string, projectName?: string, conversationId?: string) => Promise<{ response: string; error?: string }>;
      ragStatus: () => Promise<{ ollama_connected: boolean; vector_store?: any }>;
      ragConversations: () => Promise<Array<{ id: string; title: string; updated_at: string }>>;
      ragCreateConversation: (projectName?: string) => Promise<{ conversation_id: string | null; error?: string }>;
      ragDeleteConversation: (conversationId: string) => Promise<{ deleted: boolean }>;
      ragGetConfig: () => Promise<{ mode: string; ollamaUrl?: string; customEndpoint?: string; embeddingModel?: string; chatModel?: string }>;
      ragSetConfig: (config: { mode?: string; ollamaUrl?: string; customEndpoint?: string; apiKey?: string; embeddingModel?: string; chatModel?: string }) => Promise<{ success: boolean; config?: any; error?: string }>;
      ragClear: () => Promise<{ cleared: boolean }>;

      removeAllListeners: (channel: string) => void;
    };
  }
}
