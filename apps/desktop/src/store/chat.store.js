import { create } from 'zustand';
export const useChatStore = create((set) => ({
    messages: [],
    chats: [],
    currentChat: null,
    isTyping: false,
    selectedAgent: null,
    selectedModel: null,
    isLocal: false,
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    updateMessage: (id, updates) => set((state) => ({
        messages: state.messages.map((msg) => msg.id === id ? { ...msg, ...updates } : msg),
    })),
    clearMessages: () => set({ messages: [] }),
    setTyping: (isTyping) => set({ isTyping }),
    setSelectedAgent: (selectedAgent) => set({ selectedAgent }),
    setSelectedModel: (selectedModel) => set({ selectedModel }),
    setIsLocal: (isLocal) => set({ isLocal }),
    setChats: (chats) => set({ chats }),
    addChat: (chat) => set((state) => ({ chats: [chat, ...state.chats] })),
    setCurrentChat: (currentChat) => set({ currentChat }),
}));
