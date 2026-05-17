import { create } from 'zustand';
import type { Message, Agent, Model, Chat } from '../types';

interface ChatState {
  messages: Message[];
  chats: Chat[];
  currentChat: Chat | null;
  isTyping: boolean;
  selectedAgent: Agent | null;
  selectedModel: Model | null;
  isLocal: boolean;
  
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  setTyping: (typing: boolean) => void;
  setSelectedAgent: (agent: Agent | null) => void;
  setSelectedModel: (model: Model | null) => void;
  setIsLocal: (local: boolean) => void;
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;
  setCurrentChat: (chat: Chat | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  chats: [],
  currentChat: null,
  isTyping: false,
  selectedAgent: null,
  selectedModel: null,
  isLocal: false,

  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg
      ),
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
