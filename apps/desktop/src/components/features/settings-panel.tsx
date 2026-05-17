import { useState, useEffect } from 'react';
import { Button, Input, Select, Card, Tabs } from '../ui';
import { useSettingsStore } from '../../store';
import { useToast } from '../../hooks/useToast';
import { ragService } from '../../services/api';
import { validateCurl } from '../../lib/curl-validator';
import type { RAGStatus } from '../../types';

interface CustomProvider {
    id: string;
    name: string;
    curlCommand: string;
    responsePath: string;
}

const AI_PROVIDERS = [
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'groq', label: 'Groq' },
  { value: 'openrouter', label: 'OpenRouter' },
];

const AI_MODELS: Record<string, { value: string; label: string }[]> = {
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
  const {
    transparency,
    autoScreenCapture,
    customOllamaUrl,
    ragMode,
    ragOllamaUrl,
    ragEmbeddingModel,
    ragChatModel,
    aiProvider,
    aiModel,
    sttProvider,
    ttsProvider,
    ollamaModels,
    setTransparency,
    setAutoScreenCapture,
    setCustomOllamaUrl,
    setRagConfig,
    setAIProvider,
    setAIModel,
    setSttProvider,
    setTtsProvider,
    setOllamaModels,
  } = useSettingsStore();

  const { success, error: showError } = useToast();
  const [activeTab, setActiveTab] = useState('ai');
  const [ragStatus, setRagStatus] = useState<RAGStatus | null>(null);

  const [customProviders, setCustomProviders] = useState<CustomProvider[]>(() => {
    const stored = localStorage.getItem('customProviders');
    return stored ? JSON.parse(stored) : [];
  });
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [editingProvider, setEditingProvider] = useState<CustomProvider | null>(null);
  const [customName, setCustomName] = useState('');
  const [customCurl, setCustomCurl] = useState('');
  const [customResponsePath, setCustomResponsePath] = useState('');
  const [curlError, setCurlError] = useState<string | null>(null);

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
      useSettingsStore.getState().setRagStatus(status);
    } catch (err) {
      console.error('Failed to load RAG status');
    }
  };

  const loadOllamaModels = async () => {
    try {
      const response = await fetch(`${customOllamaUrl}/api/tags`);
      const data = await response.json();
      if (data.models) {
        setOllamaModels(data.models.map((m: any) => m.name));
      }
    } catch (err) {
      console.log('Could not load Ollama models');
    }
  };

  const handleTransparencyChange = (value: number) => {
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
        mode: ragMode as any,
        ollamaUrl: ragOllamaUrl,
        embeddingModel: ragEmbeddingModel,
        chatModel: ragChatModel,
      });
      await loadRagStatus();
      success('RAG configuration saved!');
    } catch (err: any) {
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

  const handleEditProvider = (provider: CustomProvider) => {
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

    const newProvider: CustomProvider = {
      id: editingProvider ? editingProvider.id : crypto.randomUUID(),
      name: customName,
      curlCommand: customCurl,
      responsePath: customResponsePath
    };

    let updated: CustomProvider[];
    if (editingProvider) {
      updated = customProviders.map(p => p.id === editingProvider!.id ? newProvider : p);
    } else {
      updated = [...customProviders, newProvider];
    }

    setCustomProviders(updated);
    localStorage.setItem('customProviders', JSON.stringify(updated));
    setIsEditingCustom(false);
    success(editingProvider ? 'Provider updated!' : 'Provider added!');
  };

  const handleDeleteCustom = (id: string) => {
    if (!confirm("Delete this provider?")) return;
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

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Settings</h1>

        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="mt-6">
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <Card>
                <h3 className="text-lg font-semibold text-text-primary mb-4">AI Chat Model</h3>
                <div className="space-y-4">
                  <Select
                    label="AI Provider"
                    value={aiProvider}
                    onChange={(value) => {
                      setAIProvider(value);
                      const models = AI_MODELS[value];
                      if (models && models.length > 0) {
                        setAIModel(models[0]!.value);
                      }
                    }}
                    options={AI_PROVIDERS}
                  />
                  
                  {AI_MODELS[aiProvider] && (
                    <Select
                      label="Model"
                      value={aiModel}
                      onChange={(value) => setAIModel(value)}
                      options={AI_MODELS[aiProvider]}
                    />
                  )}
                </div>
              </Card>

              <Card>
                <h3 className="text-lg font-semibold text-text-primary mb-4">Ollama Models (Local)</h3>
                <p className="text-sm text-text-muted mb-4">
                  Available models on your local Ollama instance
                </p>
                {ollamaModels.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {ollamaModels.map((model) => (
                      <span
                        key={model}
                        className={`px-3 py-1 rounded-full text-sm ${
                          ragChatModel === model
                            ? 'bg-accent-cyan text-white'
                            : 'bg-surface-elevated text-text-secondary'
                        }`}
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-muted">No models found. Make sure Ollama is running.</p>
                )}
                <Button variant="ghost" size="sm" onClick={loadOllamaModels} className="mt-3">
                  Refresh Models
                </Button>
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">Custom Providers</h3>
                    <p className="text-sm text-text-muted mt-1">Add your own AI endpoints via cURL</p>
                  </div>
                  {!isEditingCustom && (
                    <Button variant="outline" size="sm" onClick={handleNewProvider}>
                      + Add Provider
                    </Button>
                  )}
                </div>

                {isEditingCustom ? (
                  <div className="space-y-4 p-4 bg-surface-elevated rounded-lg border border-border">
                    <h4 className="text-sm font-semibold text-text-primary">
                      {editingProvider ? 'Edit Provider' : 'New Provider'}
                    </h4>

                    <Input
                      label="Provider Name"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="My Custom LLM"
                    />

                    <div>
                      <label className="text-sm font-medium text-text-secondary block mb-2">
                        cURL Command
                      </label>
                      <textarea
                        value={customCurl}
                        onChange={(e) => setCustomCurl(e.target.value)}
                        placeholder={`curl https://api.openai.com/v1/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_KEY" -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "{{TEXT}}"}]}'`}
                        className="w-full h-32 bg-background border border-border rounded-lg px-4 py-2.5 text-xs text-text-primary font-mono focus:outline-none focus:border-accent-primary resize-none"
                      />
                      <p className="text-xs text-text-muted mt-1">
                        Use <code className="bg-surface-elevated px-1 rounded">{"{{TEXT}}"}</code> for the user message
                      </p>
                    </div>

                    <Input
                      label="Response JSON Path (Optional)"
                      value={customResponsePath}
                      onChange={(e) => setCustomResponsePath(e.target.value)}
                      placeholder="choices[0].message.content"
                    />

                    {curlError && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                        {curlError}
                      </div>
                    )}

                    <div className="flex justify-end gap-3">
                      <Button variant="ghost" onClick={() => setIsEditingCustom(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveCustom}>
                        Save Provider
                      </Button>
                    </div>
                  </div>
                ) : customProviders.length > 0 ? (
                  <div className="space-y-3">
                    {customProviders.map((provider) => (
                      <div key={provider.id} className="flex items-center justify-between p-3 bg-surface-elevated rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center text-accent-primary font-bold text-xs">
                            {provider.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary">{provider.name}</p>
                            <p className="text-xs text-text-muted font-mono truncate max-w-[250px]">
                              {provider.curlCommand.substring(0, 50)}...
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleEditProvider(provider)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteCustom(provider.id)} className="text-red-400">
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-muted text-center py-4">No custom providers added yet.</p>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'stt' && (
            <div className="space-y-6">
              <Card>
                <h3 className="text-lg font-semibold text-text-primary mb-4">Speech to Text (STT)</h3>
                <div className="space-y-4">
                  <Select
                    label="STT Provider"
                    value={sttProvider}
                    onChange={(value) => setSttProvider(value)}
                    options={STT_PROVIDERS}
                  />
                  
                  {sttProvider === 'whisper' && (
                    <Input
                      label="Whisper URL (Optional)"
                      value={localStorage.getItem('whisperUrl') || ''}
                      onChange={(e) => localStorage.setItem('whisperUrl', e.target.value)}
                      placeholder="http://localhost:8000"
                    />
                  )}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'tts' && (
            <div className="space-y-6">
              <Card>
                <h3 className="text-lg font-semibold text-text-primary mb-4">Text to Speech (TTS)</h3>
                <div className="space-y-4">
                  <Select
                    label="TTS Provider"
                    value={ttsProvider}
                    onChange={(value) => setTtsProvider(value)}
                    options={TTS_PROVIDERS}
                  />
                  
                  {ttsProvider === 'coqui' && (
                    <Input
                      label="Coqui URL"
                      value={localStorage.getItem('coquiUrl') || ''}
                      onChange={(e) => localStorage.setItem('coquiUrl', e.target.value)}
                      placeholder="http://localhost:5002"
                    />
                  )}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'rag' && (
            <div className="space-y-6">
              <Card>
                <h3 className="text-lg font-semibold text-text-primary mb-4">RAG Status</h3>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      ragStatus?.ollamaConnected ? 'bg-accent-green' : 'bg-accent-orange'
                    }`}
                  />
                  <span className="text-sm text-text-secondary">
                    {ragStatus?.ollamaConnected ? 'Ollama Connected' : 'Ollama Not Connected'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={loadRagStatus} className="ml-auto">
                    Refresh
                  </Button>
                </div>
                {ragStatus && (
                  <div className="mt-3 grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-accent-cyan">{ragStatus.vectors}</p>
                      <p className="text-xs text-text-muted">Vectors</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-accent-purple">{ragStatus.projects.length}</p>
                      <p className="text-xs text-text-muted">Projects</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-accent-green">{ragStatus.conversations}</p>
                      <p className="text-xs text-text-muted">Chats</p>
                    </div>
                  </div>
                )}
              </Card>

              <Card>
                <h3 className="text-lg font-semibold text-text-primary mb-4">RAG Configuration</h3>
                <div className="space-y-4">
                  <Select
                    label="RAG Mode"
                    value={ragMode}
                    onChange={(value) => setRagConfig({ mode: value as any })}
                    options={[
                      { value: 'local', label: 'Local (Ollama)' },
                      { value: 'cloud', label: 'Cloud API' },
                      { value: 'custom', label: 'Custom Endpoint' },
                    ]}
                  />

                  {(ragMode === 'local' || ragMode === 'custom') && (
                    <>
                      <Input
                        label="Ollama URL"
                        value={ragOllamaUrl}
                        onChange={(e) => setRagConfig({ ollamaUrl: e.target.value })}
                        placeholder="http://localhost:11434"
                      />
                      {ragMode === 'local' && (
                        <div>
                          <label className="text-sm font-medium text-text-secondary block mb-2">
                            Embedding Model
                          </label>
                          <select
                            value={ragEmbeddingModel}
                            onChange={(e) => setRagConfig({ embeddingModel: e.target.value })}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary"
                          >
                            {ollamaModels.filter(m => !m.includes(':')).map((model) => (
                              <option key={model} value={model}>{model}</option>
                            ))}
                            <option value="nomic-embed-text">nomic-embed-text</option>
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="text-sm font-medium text-text-secondary block mb-2">
                          Chat Model
                        </label>
                        <select
                          value={ragChatModel}
                          onChange={(e) => setRagConfig({ chatModel: e.target.value })}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-text-primary"
                        >
                          {ollamaModels.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <Button onClick={saveRagConfig}>Save RAG Configuration</Button>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'keys' && (
            <div className="space-y-6">
              <Card>
                <h3 className="text-lg font-semibold text-text-primary mb-4">API Keys</h3>
                <div className="space-y-4">
                  <Input
                    label="OpenAI API Key"
                    type="password"
                    value={apiKeys.openai}
                    onChange={(e) => setApiKeys({ ...apiKeys, openai: e.target.value })}
                    placeholder="sk-..."
                  />
                  <Input
                    label="Anthropic API Key"
                    type="password"
                    value={apiKeys.anthropic}
                    onChange={(e) => setApiKeys({ ...apiKeys, anthropic: e.target.value })}
                    placeholder="sk-ant-..."
                  />
                  <Input
                    label="Google Gemini API Key"
                    type="password"
                    value={apiKeys.gemini}
                    onChange={(e) => setApiKeys({ ...apiKeys, gemini: e.target.value })}
                    placeholder="AIza..."
                  />
                  <Input
                    label="Groq API Key"
                    type="password"
                    value={apiKeys.groq}
                    onChange={(e) => setApiKeys({ ...apiKeys, groq: e.target.value })}
                    placeholder="gsk_..."
                  />
                  <Input
                    label="OpenRouter API Key"
                    type="password"
                    value={apiKeys.openrouter}
                    onChange={(e) => setApiKeys({ ...apiKeys, openrouter: e.target.value })}
                    placeholder="sk-or-v1-..."
                  />
                  <Input
                    label="Deepgram API Key (STT)"
                    type="password"
                    value={apiKeys.deepgram}
                    onChange={(e) => setApiKeys({ ...apiKeys, deepgram: e.target.value })}
                    placeholder="Your Deepgram key"
                  />
                  <Input
                    label="AssemblyAI API Key (STT)"
                    type="password"
                    value={apiKeys.assemblyai}
                    onChange={(e) => setApiKeys({ ...apiKeys, assemblyai: e.target.value })}
                    placeholder="Your AssemblyAI key"
                  />
                  <Input
                    label="ElevenLabs API Key (TTS)"
                    type="password"
                    value={apiKeys.elevenlabs}
                    onChange={(e) => setApiKeys({ ...apiKeys, elevenlabs: e.target.value })}
                    placeholder="Your ElevenLabs key"
                  />
                  <Button onClick={saveApiKeys}>Save API Keys</Button>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-6">
              <Card>
                <h3 className="text-lg font-semibold text-text-primary mb-4">UI Settings</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-text-secondary block mb-2">
                      UI Transparency
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="30"
                        max="100"
                        value={transparency}
                        onChange={(e) => handleTransparencyChange(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm text-text-muted w-12">{transparency}%</span>
                    </div>
                    <p className="text-xs text-text-muted mt-1">Adjusts overlay window transparency</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-text-secondary">Auto Screen Capture</p>
                      <p className="text-xs text-text-muted">Automatically capture screen context</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoScreenCapture}
                      onChange={(e) => setAutoScreenCapture(e.target.checked)}
                      className="w-5 h-5 rounded border-border bg-background text-accent-cyan focus:ring-accent-cyan"
                    />
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="text-lg font-semibold text-text-primary mb-4">Ollama Connection</h3>
                <Input
                  label="Ollama URL"
                  value={customOllamaUrl}
                  onChange={(e) => setCustomOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                />
                <Button variant="ghost" size="sm" onClick={loadOllamaModels} className="mt-3">
                  Test Connection
                </Button>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}