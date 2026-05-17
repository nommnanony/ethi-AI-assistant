import type { Chat, Message, ChatResponse } from '../../types';

class ChatService {
  private baseUrl = 'http://localhost:4000';

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth-storage');
    let accessToken = '';
    if (token) {
      try {
        const parsed = JSON.parse(token);
        accessToken = parsed.state?.accessToken || parsed.accessToken || '';
      } catch {
        accessToken = '';
      }
    }
    console.log('Token from storage:', accessToken ? `${accessToken.substring(0, 20)}...` : 'EMPTY');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  async sendMessage(message: string, messages: Message[] = [], provider = 'gemini', model = 'gemini-2.5-flash'): Promise<ChatResponse> {
    if (window.electronAPI?.sendQuery) {
      return window.electronAPI.sendQuery({ message, model, provider, context: messages });
    }

    const chatMessages = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message }
    ];

    console.log('Sending to backend:', { provider, model, message: message.substring(0, 50) });

    const response = await fetch(`${this.baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        messages: chatMessages,
        provider,
        model,
      }),
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const errorMsg = text ? `HTTP ${response.status}: ${text.substring(0, 200)}` : `HTTP ${response.status}: Failed to send message`;
      console.error('Chat error:', errorMsg);
      throw new Error(errorMsg);
    }

    const text = await response.text();
    if (!text.trim()) {
      throw new Error('Empty response from server');
    }

    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON from server: ${text.substring(0, 100)}`);
    }

    console.log('Chat response:', result);
    return {
      response: result.content,
      usage: result.tokens ? {
        prompt_tokens: result.tokens.prompt,
        completion_tokens: result.tokens.completion,
        total_tokens: result.tokens.total,
      } : undefined,
    };
  }

  async getChats(page = 1, limit = 20): Promise<{ chats: Chat[]; total: number }> {
    const response = await fetch(`${this.baseUrl}/api/ai/chats?page=${page}&limit=${limit}`, {
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch chats');
    }

    return response.json();
  }

  async getChat(chatId: string): Promise<Chat> {
    const response = await fetch(`${this.baseUrl}/api/ai/chats/${chatId}`, {
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to fetch chat');
    }

    return response.json();
  }

  async deleteChat(chatId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/ai/chats/${chatId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to delete chat');
    }
  }

  async sendVisionQuery(payload: {
    text: string;
    imageBase64: string;
    apiKey?: string;
    model?: string;
    provider?: string;
  }): Promise<ChatResponse> {
    if (window.electronAPI?.sendVisionQuery) {
      return window.electronAPI.sendVisionQuery({
        ...payload,
        apiKey: payload.apiKey || '',
        model: payload.model || 'gemini-2.5-flash',
      });
    }

    throw new Error('Vision query requires Electron API');
  }

  async transcribeAudio(audioBlob: Blob, provider = 'deepgram'): Promise<string> {
    if (window.electronAPI?.transcribeAudio) {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const result = await window.electronAPI.transcribeAudio({ audio: base64, provider });
      return result.text;
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.wav');

    const response = await fetch(`${this.baseUrl}/api/transcription?provider=${provider}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Transcription failed');
    }

    const result = await response.json();
    return result.text;
  }

  async captureScreenshot(): Promise<string | null> {
    if (window.electronAPI?.captureScreenshot) {
      return window.electronAPI.captureScreenshot();
    }
    return null;
  }

  createMessage(role: Message['role'], content: string, metadata?: Message['metadata']): Message {
    return {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };
  }
}

export const chatService = new ChatService();