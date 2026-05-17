import { create } from 'zustand';
import { persist } from 'zustand/middleware';
const defaultSettings = {
    transparency: 70,
    autoScreenCapture: false,
    customOllamaUrl: 'http://localhost:11434',
    ragMode: 'local',
    ragOllamaUrl: 'http://localhost:11434',
    ragEmbeddingModel: 'nomic-embed-text',
    ragChatModel: 'qwen2.5-coder:3b',
    aiProvider: 'gemini',
    aiModel: 'gemini-2.5-flash',
    sttProvider: 'deepgram',
    ttsProvider: 'openai',
};
export const useSettingsStore = create()(persist((set) => ({
    ...defaultSettings,
    ragConfig: {
        mode: 'local',
        ollamaUrl: 'http://localhost:11434',
        embeddingModel: 'nomic-embed-text',
        chatModel: 'qwen2.5-coder:3b',
    },
    aiProvider: 'gemini',
    aiModel: 'gemini-2.5-flash',
    sttProvider: 'deepgram',
    ttsProvider: 'deepgram',
    ollamaModels: [],
    ragStatus: null,
    setTransparency: (transparency) => set({ transparency }),
    setAutoScreenCapture: (autoScreenCapture) => set({ autoScreenCapture }),
    setCustomOllamaUrl: (customOllamaUrl) => set({ customOllamaUrl }),
    setRagConfig: (config) => set((state) => ({
        ragConfig: { ...state.ragConfig, ...config },
        ...(config.mode && { ragMode: config.mode }),
        ...(config.ollamaUrl && { ragOllamaUrl: config.ollamaUrl }),
        ...(config.embeddingModel && { ragEmbeddingModel: config.embeddingModel }),
        ...(config.chatModel && { ragChatModel: config.chatModel }),
    })),
    setAIProvider: (aiProvider) => set({ aiProvider }),
    setAIModel: (aiModel) => set({ aiModel }),
    setRagStatus: (ragStatus) => set({ ragStatus }),
    setSttProvider: (sttProvider) => set({ sttProvider }),
    setTtsProvider: (ttsProvider) => set({ ttsProvider }),
    setOllamaModels: (ollamaModels) => set({ ollamaModels }),
    resetSettings: () => set(defaultSettings),
}), {
    name: 'settings-storage',
}));
