import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState } from 'react';
import { useChat } from '../../hooks';
import { useToast } from '../../hooks/useToast';
import { Bot, User, Copy, Check, Code2, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
export function ChatArea() {
    const { messages, isTyping } = useChat();
    const { success } = useToast();
    const [copiedId, setCopiedId] = useState(null);
    const messagesEndRef = React.useRef(null);
    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    const copyToClipboard = async (text, id) => {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        success('Copied to clipboard!');
        setTimeout(() => setCopiedId(null), 2000);
    };
    if (messages.length === 0) {
        return (_jsx("div", { className: "flex-1 flex items-center justify-center bg-background", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "text-6xl mb-4", children: "\uD83E\uDD16" }), _jsx("h2", { className: "text-xl font-semibold text-text-primary mb-2", children: "Welcome to EthiAI" }), _jsx("p", { className: "text-text-muted", children: "Send a message to start chatting" })] }) }));
    }
    return (_jsxs("div", { className: "flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin", children: [messages.map((message) => (_jsx(MessageBubble, { message: message, onCopy: copyToClipboard, copiedId: copiedId }, message.id))), isTyping && _jsx(TypingIndicator, {}), _jsx("div", { ref: messagesEndRef })] }));
}
function MessageBubble({ message, onCopy, copiedId }) {
    const isUser = message.role === 'user';
    return (_jsxs("div", { className: cn('flex gap-4', isUser && 'flex-row-reverse'), children: [_jsx("div", { className: cn('flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center', isUser ? 'bg-accent-purple' : 'bg-accent-cyan'), children: isUser ? _jsx(User, { className: "w-4 h-4 text-white" }) : _jsx(Bot, { className: "w-4 h-4 text-white" }) }), _jsxs("div", { className: cn('max-w-3xl', isUser && 'ml-4'), children: [_jsxs("div", { className: cn('rounded-lg p-4', isUser
                            ? 'bg-gradient-to-r from-accent-purple/20 to-accent-purple/10 border border-accent-purple/30'
                            : 'bg-surface-base border border-border'), children: [_jsx("p", { className: "text-sm text-text-primary whitespace-pre-wrap", children: message.content }), message.code && (_jsxs("div", { className: "mt-3 rounded-lg bg-surface-elevated border border-border overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2 bg-surface-hover border-b border-border", children: [_jsxs("span", { className: "text-xs text-text-muted flex items-center gap-1", children: [_jsx(Code2, { className: "w-3 h-3" }), "Code"] }), _jsx("button", { onClick: () => onCopy(message.code, message.id), className: "text-xs text-text-muted hover:text-text-primary flex items-center gap-1", children: copiedId === message.id ? (_jsxs(_Fragment, { children: [_jsx(Check, { className: "w-3 h-3" }), "Copied"] })) : (_jsxs(_Fragment, { children: [_jsx(Copy, { className: "w-3 h-3" }), "Copy"] })) })] }), _jsx("pre", { className: "p-3 overflow-x-auto", children: _jsx("code", { className: "text-xs text-text-secondary font-mono", children: message.code }) })] })), message.tools && message.tools.length > 0 && (_jsx("div", { className: "mt-3 pt-3 border-t border-border/50", children: _jsxs("div", { className: "flex items-center gap-2 text-xs text-text-muted", children: [_jsx(Zap, { className: "w-3 h-3 text-accent-cyan" }), _jsxs("span", { children: ["Tools: ", message.tools.join(', ')] })] }) }))] }), message.metadata && (_jsxs("div", { className: "mt-1 text-xs text-text-muted flex items-center gap-3", children: [message.metadata.model && _jsx("span", { children: message.metadata.model }), message.metadata.tokens && (_jsxs("span", { children: [message.metadata.tokens.total, " tokens"] })), message.metadata.error && (_jsx("span", { className: "text-red-400", children: message.metadata.error }))] }))] })] }));
}
function TypingIndicator() {
    return (_jsxs("div", { className: "flex gap-4", children: [_jsx("div", { className: "flex-shrink-0 w-8 h-8 rounded-full bg-accent-cyan flex items-center justify-center", children: _jsx(Bot, { className: "w-4 h-4 text-white" }) }), _jsx("div", { className: "bg-surface-base border border-border rounded-lg p-4", children: _jsxs("div", { className: "flex gap-1", children: [_jsx("span", { className: "w-2 h-2 bg-accent-cyan rounded-full animate-bounce", style: { animationDelay: '0ms' } }), _jsx("span", { className: "w-2 h-2 bg-accent-cyan rounded-full animate-bounce", style: { animationDelay: '150ms' } }), _jsx("span", { className: "w-2 h-2 bg-accent-cyan rounded-full animate-bounce", style: { animationDelay: '300ms' } })] }) })] }));
}
