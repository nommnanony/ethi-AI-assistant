import React, { useState } from 'react';
import { useChat } from '../../hooks';

import { useToast } from '../../hooks/useToast';
import { Bot, User, Copy, Check, Code2, Zap } from 'lucide-react';
import type { Message } from '../../types';
import { cn } from '../../lib/utils';

export function ChatArea() {
  const { messages, isTyping } = useChat();
  const { success } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    success('Copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">Welcome to Natively AI</h2>
          <p className="text-text-muted">Send a message to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onCopy={copyToClipboard}
          copiedId={copiedId}
        />
      ))}
      {isTyping && <TypingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  onCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

function MessageBubble({ message, onCopy, copiedId }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-4', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-accent-purple' : 'bg-accent-cyan'
        )}
      >
        {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
      </div>

      <div className={cn('max-w-3xl', isUser && 'ml-4')}>
        <div
          className={cn(
            'rounded-lg p-4',
            isUser
              ? 'bg-gradient-to-r from-accent-purple/20 to-accent-purple/10 border border-accent-purple/30'
              : 'bg-surface-base border border-border'
          )}
        >
          <p className="text-sm text-text-primary whitespace-pre-wrap">{message.content}</p>

          {message.code && (
            <div className="mt-3 rounded-lg bg-surface-elevated border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-surface-hover border-b border-border">
                <span className="text-xs text-text-muted flex items-center gap-1">
                  <Code2 className="w-3 h-3" />
                  Code
                </span>
                <button
                  onClick={() => onCopy(message.code!, message.id)}
                  className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1"
                >
                  {copiedId === message.id ? (
                    <>
                      <Check className="w-3 h-3" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 overflow-x-auto">
                <code className="text-xs text-text-secondary font-mono">{message.code}</code>
              </pre>
            </div>
          )}

          {message.tools && message.tools.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Zap className="w-3 h-3 text-accent-cyan" />
                <span>Tools: {message.tools.join(', ')}</span>
              </div>
            </div>
          )}
        </div>

        {message.metadata && (
          <div className="mt-1 text-xs text-text-muted flex items-center gap-3">
            {message.metadata.model && <span>{message.metadata.model}</span>}
            {message.metadata.tokens && (
              <span>
                {message.metadata.tokens.total} tokens
              </span>
            )}
            {message.metadata.error && (
              <span className="text-red-400">{message.metadata.error}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-cyan flex items-center justify-center">
        <Bot className="w-4 h-4 text-white" />
      </div>
      <div className="bg-surface-base border border-border rounded-lg p-4">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-accent-cyan rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
