import React, { useState, useRef, useCallback } from 'react';
import { useChat } from '../../hooks';
import { Textarea, Button } from '../ui';
import { Send, Mic, Camera, Square } from 'lucide-react';
import { cn } from '../../lib/utils';

export function ChatInput() {
  const { sendMessage, isTyping, stopGeneration, selectedAgent } = useChat();
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    if (!message.trim() || isTyping) return;
    await sendMessage(message);
    setMessage('');
  }, [message, isTyping, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleScreenshot = async () => {
    if (window.electronAPI?.captureScreenshot) {
      await window.electronAPI.captureScreenshot();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
    } else {
      setIsRecording(true);
    }
  };

  return (
    <div className="glass border-t border-border p-4">
      <div className="flex items-end gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleScreenshot}
          className="text-text-muted hover:text-text-primary"
          title="Take Screenshot"
        >
          <Camera className="w-5 h-5" />
        </Button>

        <Button
          variant={isRecording ? 'danger' : 'ghost'}
          size="icon"
          onClick={toggleRecording}
          className={cn(isRecording && 'text-accent-orange')}
          title={isRecording ? 'Stop Recording' : 'Voice Input'}
        >
          <Mic className={cn('w-5 h-5', isRecording && 'animate-pulse')} />
        </Button>

        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
            className="min-h-[48px] max-h-[200px]"
            rows={1}
            style={{
              height: 'auto',
              resize: 'none',
            }}
            onInput={(e: any) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
            }}
          />
        </div>

        <div className="flex items-center gap-2">
          {selectedAgent && (
            <div className="px-3 py-2 rounded-lg bg-surface-elevated border border-border text-sm text-text-secondary">
              <span className="mr-2">🤖</span>
              {selectedAgent.name}
            </div>
          )}

          {isTyping ? (
            <Button variant="danger" onClick={stopGeneration}>
              <Square className="w-5 h-5 mr-2" />
              Stop
            </Button>
          ) : (
            <Button onClick={handleSend} disabled={!message.trim()}>
              <Send className="w-5 h-5 mr-2" />
              Send
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <button className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-elevated border border-border/50 text-xs text-text-muted hover:text-text-secondary">
          <span className="text-accent-cyan font-bold">/</span>
          <span>Commands</span>
        </button>
        <button className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-elevated border border-border/50 text-xs text-text-muted hover:text-text-secondary">
          <span className="text-accent-cyan font-bold">@</span>
          <span>Files</span>
        </button>
        <button className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-elevated border border-border/50 text-xs text-text-muted hover:text-text-secondary">
          <span className="text-accent-cyan font-bold">#</span>
          <span>Functions</span>
        </button>
        <div className="flex-1" />
        <span className="text-xs text-text-muted">Enter to send</span>
      </div>
    </div>
  );
}
