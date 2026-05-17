export * from './auth';
export * from './chat';
export * from './api';

export {};

declare global {
  interface Window {
    electronAPI?: {
      exitApp: () => void;
      minimizeLauncher: () => void;
      maximizeLauncher: () => void;
      closeLauncher: () => void;
      setOverlayOpacity: (opacity: number) => void;
      captureScreenshot: () => Promise<string | null>;
      captureScreenshotSilent: () => Promise<string | null>;
      sendQuery: (payload: any) => Promise<{ response: string }>;
      sendVisionQuery: (payload: { text: string; imageBase64: string; apiKey: string; model: string; baseUrl?: string }) => Promise<{ response: string }>;
      transcribeAudio: (payload: any) => Promise<{ text: string }>;
      startAudioCapture: () => Promise<void>;
      stopAudioCapture: () => Promise<void>;
      onAudioChunk: (callback: (chunk: string) => void) => void;
      ragStatus: () => Promise<{ ollamaConnected?: boolean; vectors?: number; projects?: string[]; conversations?: number }>;
      ragSetConfig: (config: { mode?: string; ollamaUrl?: string; embeddingModel?: string; chatModel?: string; apiKey?: string }) => Promise<{ success: boolean; config?: any }>;
      [key: string]: unknown;
    };
  }
}

export interface LogEntry {
  id: string;
  time: string;
  level: 'INFO' | 'DEBUG' | 'ERROR' | 'WARN';
  message: string;
  source: string;
}

export interface RAGStatus {
  ollamaConnected: boolean;
  vectors: number;
  projects: string[];
  conversations: number;
}

export interface RAGConfig {
  mode: 'local' | 'cloud' | 'custom';
  ollamaUrl?: string;
  embeddingModel?: string;
  chatModel?: string;
  apiKey?: string;
  provider?: string;
}

export interface Settings {
  transparency: number;
  autoScreenCapture: boolean;
  customOllamaUrl: string;
  ragMode: string;
  ragOllamaUrl: string;
  ragEmbeddingModel: string;
  ragChatModel: string;
  aiProvider: string;
  aiModel: string;
  sttProvider: string;
  ttsProvider: string;
}

export interface FileTreeItem {
  name: string;
  type: 'file' | 'folder';
  expanded?: boolean;
  children?: FileTreeItem[];
  path?: string;
}
