import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useCallback } from 'react';
import { useChat } from '../../hooks';
import { Textarea, Button } from '../ui';
import { Send, Mic, Camera, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
export function ChatInput() {
    const { sendMessage, isTyping, stopGeneration, selectedAgent } = useChat();
    const [message, setMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const textareaRef = useRef(null);
    const handleSend = useCallback(async () => {
        if (!message.trim() || isTyping)
            return;
        await sendMessage(message);
        setMessage('');
    }, [message, isTyping, sendMessage]);
    const handleKeyDown = (e) => {
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
        }
        else {
            setIsRecording(true);
        }
    };
    return (_jsxs("div", { className: "glass border-t border-border p-4", children: [_jsxs("div", { className: "flex items-end gap-3", children: [_jsx(Button, { variant: "ghost", size: "icon", onClick: handleScreenshot, className: "text-text-muted hover:text-text-primary", title: "Take Screenshot", children: _jsx(Camera, { className: "w-5 h-5" }) }), _jsx(Button, { variant: isRecording ? 'danger' : 'ghost', size: "icon", onClick: toggleRecording, className: cn(isRecording && 'text-accent-orange'), title: isRecording ? 'Stop Recording' : 'Voice Input', children: _jsx(Mic, { className: cn('w-5 h-5', isRecording && 'animate-pulse') }) }), _jsx("div", { className: "flex-1", children: _jsx(Textarea, { ref: textareaRef, value: message, onChange: (e) => setMessage(e.target.value), onKeyDown: handleKeyDown, placeholder: "Ask anything... (Enter to send, Shift+Enter for new line)", className: "min-h-[48px] max-h-[200px]", rows: 1, style: {
                                height: 'auto',
                                resize: 'none',
                            }, onInput: (e) => {
                                e.target.style.height = 'auto';
                                e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                            } }) }), _jsxs("div", { className: "flex items-center gap-2", children: [selectedAgent && (_jsxs("div", { className: "px-3 py-2 rounded-lg bg-surface-elevated border border-border text-sm text-text-secondary", children: [_jsx("span", { className: "mr-2", children: "\uD83E\uDD16" }), selectedAgent.name] })), isTyping ? (_jsxs(Button, { variant: "danger", onClick: stopGeneration, children: [_jsx(Square, { className: "w-5 h-5 mr-2" }), "Stop"] })) : (_jsxs(Button, { onClick: handleSend, disabled: !message.trim(), children: [_jsx(Send, { className: "w-5 h-5 mr-2" }), "Send"] }))] })] }), _jsxs("div", { className: "flex items-center gap-2 mt-3", children: [_jsxs("button", { className: "flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-elevated border border-border/50 text-xs text-text-muted hover:text-text-secondary", children: [_jsx("span", { className: "text-accent-cyan font-bold", children: "/" }), _jsx("span", { children: "Commands" })] }), _jsxs("button", { className: "flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-elevated border border-border/50 text-xs text-text-muted hover:text-text-secondary", children: [_jsx("span", { className: "text-accent-cyan font-bold", children: "@" }), _jsx("span", { children: "Files" })] }), _jsxs("button", { className: "flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-elevated border border-border/50 text-xs text-text-muted hover:text-text-secondary", children: [_jsx("span", { className: "text-accent-cyan font-bold", children: "#" }), _jsx("span", { children: "Functions" })] }), _jsx("div", { className: "flex-1" }), _jsx("span", { className: "text-xs text-text-muted", children: "Enter to send" })] })] }));
}
