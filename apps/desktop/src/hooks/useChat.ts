import { useCallback, useRef } from 'react';
import { useChatStore } from '../store';
import { chatService } from '../services/api';
import { useSettingsStore } from '../store';
import type { Message, Model, Agent } from '../types';
import { generateId } from '../lib/utils';

const REQUEST_TIMEOUT = 25000; // 25 seconds

interface CustomProvider {
    id: string;
    name: string;
    curlCommand: string;
    responsePath: string;
}

function getCustomProviders(): CustomProvider[] {
    const stored = localStorage.getItem('customProviders');
    return stored ? JSON.parse(stored) : [];
}

export function useChat() {
  const {
    messages,
    isTyping,
    selectedModel,
    selectedAgent,
    isLocal,
    addMessage,
    updateMessage,
    clearMessages,
    setTyping,
    setSelectedModel,
    setSelectedAgent,
    setIsLocal,
  } = useChatStore();

  const { aiProvider, aiModel } = useSettingsStore();
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutIdRef = useRef<number | null>(null);

  const clearOurTimeout = useCallback(() => {
    if (timeoutIdRef.current) {
      window.clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    const provider = aiProvider || 'gemini';
    const model = aiModel || 'gemini-2.5-flash';

    console.log('[Chat] Sending message:', { provider, model, content: content.substring(0, 50) });

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    addMessage(userMessage);

    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    addMessage(assistantMessage);

    setTyping(true);
    abortControllerRef.current = new AbortController();

    // Set timeout to stop loading after 25 seconds
    timeoutIdRef.current = window.setTimeout(() => {
      console.log('[Chat] Request timed out');
      updateMessage(assistantMessageId, {
        content: 'Request timed out. The AI provider may be unavailable. Please try again or switch to a different provider in Settings.',
        metadata: { error: 'timeout', model, provider },
      });
      setTyping(false);
    }, REQUEST_TIMEOUT);

    try {
      const customProviders = getCustomProviders();
      console.log('[Chat] Custom providers:', customProviders.map(cp => ({ id: cp.id, name: cp.name })));
      console.log('[Chat] Current provider:', provider);
      
      // Check if provider is a custom provider ID
      const customProvider = customProviders.find(cp => cp.id === provider || cp.name === provider);
      console.log('[Chat] Found custom provider:', customProvider?.name || 'none');
      
      if (customProvider) {
        // Use custom provider cURL endpoint - clear the 25s frontend timeout IMMEDIATELY
        clearOurTimeout();
        console.log('[Chat] Cleared frontend timeout, starting custom request');
        
        const controller = new AbortController();
        const abortId = setTimeout(() => {
          console.log('[Chat] Custom request 60s timeout fired');
          controller.abort();
        }, 60000); // 60 seconds for custom

        try {
          console.log('[Chat] Sending to custom endpoint:', customProvider.name);
          console.log('[Chat] Request body:', JSON.stringify({
            curlCommand: customProvider.curlCommand.substring(0, 100) + '...',
            messageLength: content.length,
            responsePath: customProvider.responsePath
          }));
          
          const response = await fetch('http://localhost:4000/api/ai/custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              curlCommand: customProvider.curlCommand,
              message: content,
              responsePath: customProvider.responsePath,
            }),
            signal: controller.signal,
          });
          
          console.log('[Chat] Response received, status:', response.status);
          clearTimeout(abortId);
          clearOurTimeout();

          const text = await response.text();
          if (!text.trim()) throw new Error('Empty response from custom provider');

          let data: any;
          try {
            data = JSON.parse(text);
          } catch {
            throw new Error(`Invalid JSON from custom provider: ${text.substring(0, 100)}`);
          }

          if (!response.ok) {
            throw new Error(data.message || `Custom provider error: ${response.status}`);
          }

          updateMessage(assistantMessageId, { content: data.content });
          console.log('[Chat] Custom provider response received');
        } catch (fetchError: any) {
          clearTimeout(abortId);
          clearOurTimeout();
          throw fetchError;
        }
      } else if (provider === 'ollama' || isLocal) {
        const ollamaUrl = useSettingsStore.getState().customOllamaUrl || 'http://localhost:11434';
        
        const controller = new AbortController();
        const abortId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

        try {
          const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: model,
              prompt: content,
              stream: false,
            }),
            signal: controller.signal,
          });
          clearTimeout(abortId);
          clearOurTimeout();

          if (!response.ok) throw new Error(`Ollama error: ${response.status}`);

          const text = await response.text();
          if (!text.trim()) throw new Error('Empty response from Ollama');
          
          let data: any;
          try {
            data = JSON.parse(text);
          } catch {
            throw new Error(`Invalid JSON from Ollama: ${text.substring(0, 100)}`);
          }
          
          const fullResponse = data.response || 'No response from Ollama';
          updateMessage(assistantMessageId, { content: fullResponse });
          console.log('[Chat] Ollama response received');
        } catch (fetchError: any) {
          clearTimeout(abortId);
          clearOurTimeout();
          throw fetchError;
        }
      } else {
        const response = await chatService.sendMessage(content, messages, provider, model);
        
        updateMessage(assistantMessageId, {
          content: response.response,
          metadata: {
            model: model,
            provider: provider,
            tokens: response.usage
              ? {
                  prompt: response.usage.prompt_tokens,
                  completion: response.usage.completion_tokens,
                  total: response.usage.total_tokens,
                }
              : undefined,
          },
        });
        console.log('[Chat] API response received');
      }
    } catch (err: any) {
      console.error('[Chat] Error:', err.message);
      
      if (err.name === 'AbortError') {
        updateMessage(assistantMessageId, { content: 'Request was cancelled' });
      } else {
        updateMessage(assistantMessageId, {
          content: `Error: ${err.message || 'Failed to get response from AI. Check your API key in Settings.'}`,
          metadata: { error: err.message, model, provider },
        });
      }
    } finally {
      clearOurTimeout();
      setTyping(false);
      abortControllerRef.current = null;
    }
  }, [aiProvider, aiModel, isLocal, messages, addMessage, updateMessage, setTyping]);

  const stopGeneration = useCallback(() => {
    console.log('[Chat] Stopping generation');
    clearOurTimeout();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setTyping(false);
  }, [setTyping, clearOurTimeout]);

  const selectModel = useCallback((model: Model) => {
    setSelectedModel(model);
  }, [setSelectedModel]);

  const selectAgent = useCallback((agent: Agent) => {
    setSelectedAgent(agent);
  }, [setSelectedAgent]);

  const toggleLocalMode = useCallback(() => {
    setIsLocal(!isLocal);
  }, [isLocal, setIsLocal]);

  const takeScreenshot = useCallback(async () => {
    const screenshot = await chatService.captureScreenshot();
    if (screenshot) {
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: '[Screenshot captured]',
        timestamp: Date.now(),
        metadata: { model: aiModel, provider: aiProvider },
      };
      addMessage(userMessage);
    }
    return screenshot;
  }, [aiModel, aiProvider, addMessage]);

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    const text = await chatService.transcribeAudio(audioBlob);
    return text;
  }, []);

  return {
    messages,
    isTyping,
    selectedModel,
    selectedAgent,
    isLocal,
    sendMessage,
    stopGeneration,
    clearMessages,
    selectModel,
    selectAgent,
    toggleLocalMode,
    takeScreenshot,
    transcribeAudio,
  };
}