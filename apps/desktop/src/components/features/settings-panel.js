import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Button, Input, Select, Card, Tabs } from '../ui';
import { useSettingsStore } from '../../store';
import { useToast } from '../../hooks/useToast';
import { ragService } from '../../services/api';
import { validateCurl } from '../../lib/curl-validator';
const AI_PROVIDERS = [
    { value: 'gemini', label: 'Google Gemini' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'anthropic', label: 'Anthropic Claude' },
    { value: 'ollama', label: 'Ollama (Local)' },
    { value: 'groq', label: 'Groq' },
    { value: 'openrouter', label: 'OpenRouter' },
];
const AI_MODELS = {
    gemini: [
        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recommended)' },
        { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
    openai: [
        { value: 'gpt-4o', label: 'GPT-4o' },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    ],
    anthropic: [
        { value: 'claude-sonnet-4', label: 'Claude Sonnet 4 (Recommended)' },
        { value: 'claude-opus-4', label: 'Claude Opus 4' },
        { value: 'claude-haiku-3.5', label: 'Claude Haiku 3.5' },
    ],
    ollama: [
        { value: 'qwen2.5-coder:3b', label: 'Qwen 2.5 Coder 3B' },
        { value: 'llama3', label: 'Llama 3' },
        { value: 'llama3.1', label: 'Llama 3.1' },
        { value: 'mistral', label: 'Mistral' },
        { value: 'phi3', label: 'Phi-3' },
        { value: 'codellama', label: 'CodeLlama' },
    ],
    groq: [
        { value: 'llama-3.3-70b', label: 'Llama 3.3 70B (Recommended)' },
        { value: 'mixtral-8x7b', label: 'Mixtral 8x7B' },
    ],
    openrouter: [
        { value: 'openrouter/auto', label: 'Auto Select Best' },
        { value: 'inclusionai/ring-2.6-1t:free', label: 'Ring 2.6 Vision (Free)' },
        { value: 'google/gemini-pro-vision', label: 'Gemini Pro Vision' },
        { value: 'openai/gpt-4-vision-preview', label: 'GPT-4 Vision' },
    ],
};
const STT_PROVIDERS = [
    { value: 'deepgram', label: 'Deepgram (Recommended)' },
    { value: 'assemblyai', label: 'AssemblyAI' },
    { value: 'whisper', label: 'Whisper (Local)' },
];
const TTS_PROVIDERS = [
    { value: 'openai', label: 'OpenAI TTS' },
    { value: 'elevenlabs', label: 'ElevenLabs' },
    { value: 'coqui', label: 'Coqui TTS (Local)' },
];
export function SettingsPanel() {
    const { transparency, autoScreenCapture, customOllamaUrl, ragMode, ragOllamaUrl, ragEmbeddingModel, ragChatModel, aiProvider, aiModel, sttProvider, ttsProvider, ollamaModels, setTransparency, setAutoScreenCapture, setCustomOllamaUrl, setRagConfig, setAIProvider, setAIModel, setSttProvider, setTtsProvider, setOllamaModels, } = useSettingsStore();
    const { success, error: showError } = useToast();
    const [activeTab, setActiveTab] = useState('ai');
    const [ragStatus, setRagStatus] = useState(null);
    const [customProviders, setCustomProviders] = useState(() => {
        const stored = localStorage.getItem('customProviders');
        return stored ? JSON.parse(stored) : [];
    });
    const [isEditingCustom, setIsEditingCustom] = useState(false);
    const [editingProvider, setEditingProvider] = useState(null);
    const [customName, setCustomName] = useState('');
    const [customCurl, setCustomCurl] = useState('');
    const [customResponsePath, setCustomResponsePath] = useState('');
    const [curlError, setCurlError] = useState(null);
    const [apiKeys, setApiKeys] = useState({
        openrouter: localStorage.getItem('apiKey_openrouter') || '',
        openai: localStorage.getItem('apiKey_openai') || '',
        anthropic: localStorage.getItem('apiKey_anthropic') || '',
        deepgram: localStorage.getItem('apiKey_deepgram') || '',
        assemblyai: localStorage.getItem('apiKey_assemblyai') || '',
        elevenlabs: localStorage.getItem('apiKey_elevenlabs') || '',
        gemini: localStorage.getItem('apiKey_gemini') || '',
        groq: localStorage.getItem('apiKey_groq') || '',
    });
    useEffect(() => {
        loadRagStatus();
        loadOllamaModels();
    }, []);
    const loadRagStatus = async () => {
        try {
            const status = await ragService.getStatus();
            setRagStatus(status);
        }
        catch (err) {
            console.error('Failed to load RAG status');
        }
    };
    const loadOllamaModels = async () => {
        try {
            const response = await fetch(`${customOllamaUrl}/api/tags`);
            const data = await response.json();
            if (data.models) {
                setOllamaModels(data.models.map((m) => m.name));
            }
        }
        catch (err) {
            console.log('Could not load Ollama models');
        }
    };
    const handleTransparencyChange = (value) => {
        setTransparency(value);
        if (window.electronAPI?.setOverlayOpacity) {
            window.electronAPI.setOverlayOpacity(value / 100);
        }
    };
    const saveApiKeys = () => {
        Object.entries(apiKeys).forEach(([key, value]) => {
            localStorage.setItem(`apiKey_${key}`, value);
        });
        success('API settings saved!');
    };
    const saveRagConfig = async () => {
        try {
            await ragService.setConfig({
                mode: ragMode,
                ollamaUrl: ragOllamaUrl,
                embeddingModel: ragEmbeddingModel,
                chatModel: ragChatModel,
            });
            await loadRagStatus();
            success('RAG configuration saved!');
        }
        catch (err) {
            showError(err.message || 'Failed to save RAG config');
        }
    };
    const handleNewProvider = () => {
        setEditingProvider(null);
        setCustomName('');
        setCustomCurl('');
        setCustomResponsePath('');
        setIsEditingCustom(true);
        setCurlError(null);
    };
    const handleEditProvider = (provider) => {
        setEditingProvider(provider);
        setCustomName(provider.name);
        setCustomCurl(provider.curlCommand);
        setCustomResponsePath(provider.responsePath || '');
        setIsEditingCustom(true);
        setCurlError(null);
    };
    const handleSaveCustom = () => {
        setCurlError(null);
        if (!customName.trim()) {
            setCurlError("Provider Name is required.");
            return;
        }
        const validation = validateCurl(customCurl);
        if (!validation.isValid) {
            setCurlError(validation.message || "Invalid cURL command.");
            return;
        }
        const newProvider = {
            id: editingProvider ? editingProvider.id : crypto.randomUUID(),
            name: customName,
            curlCommand: customCurl,
            responsePath: customResponsePath
        };
        let updated;
        if (editingProvider) {
            updated = customProviders.map(p => p.id === editingProvider.id ? newProvider : p);
        }
        else {
            updated = [...customProviders, newProvider];
        }
        setCustomProviders(updated);
        localStorage.setItem('customProviders', JSON.stringify(updated));
        setIsEditingCustom(false);
        success(editingProvider ? 'Provider updated!' : 'Provider added!');
    };
    const handleDeleteCustom = (id) => {
        if (!confirm("Delete this provider?"))
            return;
        const updated = customProviders.filter(p => p.id !== id);
        setCustomProviders(updated);
        localStorage.setItem('customProviders', JSON.stringify(updated));
        success('Provider deleted');
    };
    const tabs = [
        { id: 'ai', label: 'AI' },
        { id: 'stt', label: 'Speech' },
        { id: 'tts', label: 'Voice' },
        { id: 'rag', label: 'RAG' },
        { id: 'keys', label: 'API Keys' },
        { id: 'general', label: 'General' },
    ];
    return (_jsx("div", { className: "flex-1 overflow-y-auto p-6", children: _jsxs("div", { className: "max-w-2xl mx-auto", children: [_jsx("h1", { className: "text-2xl font-bold text-text-primary mb-6", children: "Settings" }), _jsx(Tabs, { tabs: tabs, activeTab: activeTab, onChange: setActiveTab }), _jsxs("div", { className: "mt-6", children: [activeTab === 'ai' && (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { children: [_jsx("h3", { className: "text-lg font-semibold text-text-primary mb-4", children: "AI Chat Model" }), _jsxs("div", { className: "space-y-4", children: [_jsx(Select, { label: "AI Provider", value: aiProvider, onChange: (value) => {
                                                        setAIProvider(value);
                                                        const models = AI_MODELS[value];
                                                        if (models && models.length > 0) {
                                                            setAIModel(models[0].value);
                                                        }
                                                    }, options: AI_PROVIDERS }), AI_MODELS[aiProvider] && (_jsx(Select, { label: "Model", value: aiModel, onChange: (value) => setAIModel(value), options: AI_MODELS[aiProvider] }))] })] }), _jsxs(Card, { children: [_jsx("h3", { className: "text-lg font-semibold text-text-primary mb-4", children: "Ollama Models (Local)" }), _jsx("p", { className: "text-sm text-text-muted mb-4", children: "Available models on your local Ollama instance" }), ollamaModels.length > 0 ? (_jsx("div", { className: "flex flex-wrap gap-2", children: ollamaModels.map((model) => (_jsx("span", { className: `px-3 py-1 rounded-full text-sm ${ragChatModel === model
                                                    ? 'bg-accent-cyan text-white'
                                                    : 'bg-surface-elevated text-text-secondary'}`, children: model }, model))) })) : (_jsx("p", { className: "text-text-muted", children: "No models found. Make sure Ollama is running." })), _jsx(Button, { variant: "ghost", size: "sm", onClick: loadOllamaModels, className: "mt-3", children: "Refresh Models" })] }), _jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold text-text-primary", children: "Custom Providers" }), _jsx("p", { className: "text-sm text-text-muted mt-1", children: "Add your own AI endpoints via cURL" })] }), !isEditingCustom && (_jsx(Button, { variant: "outline", size: "sm", onClick: handleNewProvider, children: "+ Add Provider" }))] }), isEditingCustom ? (_jsxs("div", { className: "space-y-4 p-4 bg-surface-elevated rounded-lg border border-border", children: [_jsx("h4", { className: "text-sm font-semibold text-text-primary", children: editingProvider ? 'Edit Provider' : 'New Provider' }), _jsx(Input, { label: "Provider Name", value: customName, onChange: (e) => setCustomName(e.target.value), placeholder: "My Custom LLM" }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-text-secondary block mb-2", children: "cURL Command" }), _jsx("textarea", { value: customCurl, onChange: (e) => setCustomCurl(e.target.value), placeholder: `curl https://api.openai.com/v1/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_KEY" -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "{{TEXT}}"}]}'`, className: "w-full h-32 bg-background border border-border rounded-lg px-4 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-primary resize-none" }), _jsxs("p", { className: "text-xs text-text-muted mt-1", children: ["Use ", _jsx("code", { className: "bg-surface-elevated px-1 rounded", children: "{{TEXT}}" }), " for the user message"] })] }), _jsx(Input, { label: "Response JSON Path (Optional)", value: customResponsePath, onChange: (e) => setCustomResponsePath(e.target.value), placeholder: "choices[0].message.content" }), curlError && (_jsx("div", { className: "p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs", children: curlError })), _jsxs("div", { className: "flex justify-end gap-3", children: [_jsx(Button, { variant: "ghost", onClick: () => setIsEditingCustom(false), children: "Cancel" }), _jsx(Button, { onClick: handleSaveCustom, children: "Save Provider" })] })] })) : customProviders.length > 0 ? (_jsx("div", { className: "space-y-3", children: customProviders.map((provider) => (_jsxs("div", { className: "flex items-center justify-between p-3 bg-surface-elevated rounded-lg border border-border", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center text-accent-primary font-bold text-xs", children: provider.name.substring(0, 2).toUpperCase() }), _jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-text-primary", children: provider.name }), _jsxs("p", { className: "text-xs text-text-muted font-mono truncate max-w-[250px]", children: [provider.curlCommand.substring(0, 50), "..."] })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleEditProvider(provider), children: "Edit" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleDeleteCustom(provider.id), className: "text-red-400", children: "Delete" })] })] }, provider.id))) })) : (_jsx("p", { className: "text-sm text-text-muted text-center py-4", children: "No custom providers added yet." }))] })] })), activeTab === 'stt' && (_jsx("div", { className: "space-y-6", children: _jsxs(Card, { children: [_jsx("h3", { className: "text-lg font-semibold text-text-primary mb-4", children: "Speech to Text (STT)" }), _jsxs("div", { className: "space-y-4", children: [_jsx(Select, { label: "STT Provider", value: sttProvider, onChange: (value) => setSttProvider(value), options: STT_PROVIDERS }), sttProvider === 'whisper' && (_jsx(Input, { label: "Whisper URL (Optional)", value: localStorage.getItem('whisperUrl') || '', onChange: (e) => localStorage.setItem('whisperUrl', e.target.value), placeholder: "http://localhost:8000" }))] })] }) })), activeTab === 'tts' && (_jsx("div", { className: "space-y-6", children: _jsxs(Card, { children: [_jsx("h3", { className: "text-lg font-semibold text-text-primary mb-4", children: "Text to Speech (TTS)" }), _jsxs("div", { className: "space-y-4", children: [_jsx(Select, { label: "TTS Provider", value: ttsProvider, onChange: (value) => setTtsProvider(value), options: TTS_PROVIDERS }), ttsProvider === 'coqui' && (_jsx(Input, { label: "Coqui URL", value: localStorage.getItem('coquiUrl') || '', onChange: (e) => localStorage.setItem('coquiUrl', e.target.value), placeholder: "http://localhost:5002" }))] })] }) })), activeTab === 'rag' && (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { children: [_jsx("h3", { className: "text-lg font-semibold text-text-primary mb-4", children: "RAG Status" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("div", { className: `w-3 h-3 rounded-full ${ragStatus?.ollamaConnected ? 'bg-accent-green' : 'bg-accent-orange'}` }), _jsx("span", { className: "text-sm text-text-secondary", children: ragStatus?.ollamaConnected ? 'Ollama Connected' : 'Ollama Not Connected' }), _jsx(Button, { variant: "ghost", size: "sm", onClick: loadRagStatus, className: "ml-auto", children: "Refresh" })] }), ragStatus && (_jsxs("div", { className: "mt-3 grid grid-cols-3 gap-4 text-center", children: [_jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-accent-cyan", children: ragStatus.vectors }), _jsx("p", { className: "text-xs text-text-muted", children: "Vectors" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-accent-purple", children: ragStatus.projects.length }), _jsx("p", { className: "text-xs text-text-muted", children: "Projects" })] }), _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-accent-green", children: ragStatus.conversations }), _jsx("p", { className: "text-xs text-text-muted", children: "Chats" })] })] }))] }), _jsxs(Card, { children: [_jsx("h3", { className: "text-lg font-semibold text-text-primary mb-4", children: "RAG Configuration" }), _jsxs("div", { className: "space-y-4", children: [_jsx(Select, { label: "RAG Mode", value: ragMode, onChange: (value) => setRagConfig({ mode: value }), options: [
                                                        { value: 'local', label: 'Local (Ollama)' },
                                                        { value: 'cloud', label: 'Cloud API' },
                                                        { value: 'custom', label: 'Custom Endpoint' },
                                                    ] }), (ragMode === 'local' || ragMode === 'custom') && (_jsxs(_Fragment, { children: [_jsx(Input, { label: "Ollama URL", value: ragOllamaUrl, onChange: (e) => setRagConfig({ ollamaUrl: e.target.value }), placeholder: "http://localhost:11434" }), ragMode === 'local' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-text-secondary block mb-2", children: "Embedding Model" }), _jsxs("select", { value: ragEmbeddingModel, onChange: (e) => setRagConfig({ embeddingModel: e.target.value }), className: "w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary", children: [ollamaModels.filter(m => !m.includes(':')).map((model) => (_jsx("option", { value: model, children: model }, model))), _jsx("option", { value: "nomic-embed-text", children: "nomic-embed-text" })] })] })), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-text-secondary block mb-2", children: "Chat Model" }), _jsx("select", { value: ragChatModel, onChange: (e) => setRagConfig({ chatModel: e.target.value }), className: "w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary", children: ollamaModels.map((model) => (_jsx("option", { value: model, children: model }, model))) })] })] })), _jsx(Button, { onClick: saveRagConfig, children: "Save RAG Configuration" })] })] })] })), activeTab === 'keys' && (_jsx("div", { className: "space-y-6", children: _jsxs(Card, { children: [_jsx("h3", { className: "text-lg font-semibold text-text-primary mb-4", children: "API Keys" }), _jsxs("div", { className: "space-y-4", children: [_jsx(Input, { label: "OpenAI API Key", type: "password", value: apiKeys.openai, onChange: (e) => setApiKeys({ ...apiKeys, openai: e.target.value }), placeholder: "sk-..." }), _jsx(Input, { label: "Anthropic API Key", type: "password", value: apiKeys.anthropic, onChange: (e) => setApiKeys({ ...apiKeys, anthropic: e.target.value }), placeholder: "sk-ant-..." }), _jsx(Input, { label: "Google Gemini API Key", type: "password", value: apiKeys.gemini, onChange: (e) => setApiKeys({ ...apiKeys, gemini: e.target.value }), placeholder: "AIza..." }), _jsx(Input, { label: "Groq API Key", type: "password", value: apiKeys.groq, onChange: (e) => setApiKeys({ ...apiKeys, groq: e.target.value }), placeholder: "gsk_..." }), _jsx(Input, { label: "OpenRouter API Key", type: "password", value: apiKeys.openrouter, onChange: (e) => setApiKeys({ ...apiKeys, openrouter: e.target.value }), placeholder: "sk-or-v1-..." }), _jsx(Input, { label: "Deepgram API Key (STT)", type: "password", value: apiKeys.deepgram, onChange: (e) => setApiKeys({ ...apiKeys, deepgram: e.target.value }), placeholder: "Your Deepgram key" }), _jsx(Input, { label: "AssemblyAI API Key (STT)", type: "password", value: apiKeys.assemblyai, onChange: (e) => setApiKeys({ ...apiKeys, assemblyai: e.target.value }), placeholder: "Your AssemblyAI key" }), _jsx(Input, { label: "ElevenLabs API Key (TTS)", type: "password", value: apiKeys.elevenlabs, onChange: (e) => setApiKeys({ ...apiKeys, elevenlabs: e.target.value }), placeholder: "Your ElevenLabs key" }), _jsx(Button, { onClick: saveApiKeys, children: "Save API Keys" })] })] }) })), activeTab === 'general' && (_jsxs("div", { className: "space-y-6", children: [_jsxs(Card, { children: [_jsx("h3", { className: "text-lg font-semibold text-text-primary mb-4", children: "UI Settings" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-text-secondary block mb-2", children: "UI Transparency" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "range", min: "30", max: "100", value: transparency, onChange: (e) => handleTransparencyChange(Number(e.target.value)), className: "flex-1" }), _jsxs("span", { className: "text-sm text-text-muted w-12", children: [transparency, "%"] })] }), _jsx("p", { className: "text-xs text-text-muted mt-1", children: "Adjusts overlay window transparency" })] }), _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-text-secondary", children: "Auto Screen Capture" }), _jsx("p", { className: "text-xs text-text-muted", children: "Automatically capture screen context" })] }), _jsx("input", { type: "checkbox", checked: autoScreenCapture, onChange: (e) => setAutoScreenCapture(e.target.checked), className: "w-5 h-5 rounded border-border bg-background text-accent-cyan focus:ring-accent-cyan" })] })] })] }), _jsxs(Card, { children: [_jsx("h3", { className: "text-lg font-semibold text-text-primary mb-4", children: "Ollama Connection" }), _jsx(Input, { label: "Ollama URL", value: customOllamaUrl, onChange: (e) => setCustomOllamaUrl(e.target.value), placeholder: "http://localhost:11434" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: loadOllamaModels, className: "mt-3", children: "Test Connection" })] })] }))] })] }) }));
}
