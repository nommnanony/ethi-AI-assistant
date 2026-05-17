import { logger } from '../../common/logger';
import { z } from 'zod';

interface Chunk {
  id: string;
  content: string;
  filePath: string;
  language: string;
  chunkIndex: number;
  projectName: string;
}

interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
}

// RAG Configuration Schema
const RagConfigSchema = z.object({
  mode: z.enum(['local', 'cloud', 'custom']).default('local'),
  ollamaUrl: z.string().optional(),
  customEndpoint: z.string().optional(),
  apiKey: z.string().optional(),
  embeddingModel: z.string().default('nomic-embed-text'),
  chatModel: z.string().default('qwen2.5-coder:3b'),
  // Cloud provider settings
  cloudProvider: z.enum(['openai', 'anthropic', 'groq', 'google', 'custom']).default('custom'),
});

type RagConfig = z.infer<typeof RagConfigSchema>;

// Global RAG state
let vectorStore: Map<string, { content: string; embedding: number[]; metadata: Record<string, any> }> = new Map();
let conversations: Map<string, { id: string; projectName: string; messages: Array<{ role: string; content: string }> }> = new Map();
let currentConfig: RagConfig = { mode: 'local', embeddingModel: 'nomic-embed-text', chatModel: 'qwen2.5-coder:3b', cloudProvider: 'custom' };

// Constants
const CODE_DELIMITERS: Record<string, string[]> = {
  python: ['\nclass ', '\ndef ', '\nasync def ', '\n    def ', '\n\n'],
  javascript: ['\nfunction ', '\nconst ', '\nlet ', '\nvar ', '\nclass ', '\nexport ', '\nimport '],
  typescript: ['\nfunction ', '\nconst ', '\nlet ', '\nvar ', '\nclass ', '\nexport ', '\nimport ', '\ninterface '],
};

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'venv', '__pycache__', '.next', '.nuxt', 'target', '.cache', 'vendor', 'bin', 'obj']);
const ALLOWED_EXTENSIONS = new Set(['.py', '.ts', '.tsx', '.jsx', '.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.html', '.css', '.sql', '.sh', '.bash']);

function chunkContent(content: string, filePath: string, projectName: string): Chunk[] {
  const chunks: Chunk[] = [];
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const language: Record<string, string> = { py: 'python', js: 'javascript', ts: 'typescript', tsx: 'typescript', jsx: 'javascript', md: 'markdown', txt: 'text', json: 'json' };
  const lang = language[ext] || 'text';
  
  const chunkSize = 800;
  const overlap = 100;
  
  for (let i = 0; i < content.length; i += chunkSize - overlap) {
    const chunk = content.slice(i, i + chunkSize).trim();
    if (chunk) {
      chunks.push({
        id: `${filePath}_${Math.floor(i / chunkSize)}`,
        content: chunk,
        filePath,
        language: lang,
        chunkIndex: Math.floor(i / chunkSize),
        projectName,
      });
    }
  }
  
  return chunks;
}

function scanProject(projectPath: string): string[] {
  const files: string[] = [];
  const fs = require('fs');
  const path = require('path');
  
  function scan(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name)) scan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ALLOWED_EXTENSIONS.has(ext)) {
            try {
              const stat = fs.statSync(fullPath);
              if (stat.size < 10 * 1024 * 1024) files.push(fullPath);
            } catch {}
          }
        }
      }
    } catch {}
  }
  
  scan(projectPath);
  return files;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

// Get base URL based on config
function getBaseUrl(): string {
  if (currentConfig.mode === 'custom' && currentConfig.customEndpoint) {
    return currentConfig.customEndpoint;
  }
  if (currentConfig.mode === 'local' && currentConfig.ollamaUrl) {
    return currentConfig.ollamaUrl;
  }
  return 'http://localhost:11434';
}

function getEmbeddingModel(): string {
  return currentConfig.embeddingModel || 'nomic-embed-text';
}

function getChatModel(): string {
  return currentConfig.chatModel || 'qwen2.5-coder:3b';
}

async function generateEmbedding(text: string): Promise<number[]> {
  const baseUrl = getBaseUrl();
  
  try {
    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: getEmbeddingModel(), prompt: text }),
    });
    
    if (!response.ok) {
      logger.warn({ status: response.status }, 'Embedding API unavailable');
      return Array(768).fill(0);
    }
    
    const data = await response.json() as { embedding?: number[] };
    return data.embedding || Array(768).fill(0);
  } catch (err) {
    logger.warn({ err }, 'Failed to generate embedding');
    return Array(768).fill(0);
  }
}

async function callChatAPI(messages: Array<{ role: string; content: string }>): Promise<string> {
  const baseUrl = getBaseUrl();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  
  if (currentConfig.mode === 'custom' && currentConfig.apiKey) {
    headers['Authorization'] = `Bearer ${currentConfig.apiKey}`;
  }
  
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: getChatModel(), messages, stream: false }),
  });
  
  if (!response.ok) {
    throw new Error(`Chat API failed: ${response.status}`);
  }
  
  const data = await response.json() as { message?: { content?: string } };
  return data.message?.content || '';
}

export const ragService = {
  // Configure RAG
  configure(config: Partial<RagConfig>) {
    currentConfig = { ...currentConfig, ...config };
    logger.info({ config: currentConfig }, 'RAG configuration updated');
    return { success: true, config: currentConfig };
  },
  
  // Get current config
  getConfig() {
    return { ...currentConfig };
  },
  
  // Check RAG status
  async getStatus() {
    const baseUrl = getBaseUrl();
    let ollamaConnected = false;
    
    try {
      const response = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
      ollamaConnected = response.ok;
    } catch {}
    
    const projects = new Set<string>();
    const files = new Set<string>();
    
    for (const entry of vectorStore.values()) {
      if (entry.metadata.project_name) projects.add(entry.metadata.project_name);
      if (entry.metadata.file_path) files.add(entry.metadata.file_path);
    }
    
    return {
      mode: currentConfig.mode,
      ollamaConnected,
      baseUrl: getBaseUrl(),
      embeddingModel: getEmbeddingModel(),
      chatModel: getChatModel(),
      vectors: vectorStore.size,
      projects: Array.from(projects),
      files: files.size,
      conversations: conversations.size,
    };
  },
  
  // Index project
  async indexProject(projectPath: string, projectName?: string) {
    const project = projectName || require('path').basename(projectPath);
    logger.info({ project }, 'Starting project indexing');
    
    const files = scanProject(projectPath);
    logger.info({ files: files.length }, 'Files found');
    
    // Clear existing chunks for this project
    for (const [id] of vectorStore) {
      const entry = vectorStore.get(id);
      if (entry?.metadata.project_name === project) {
        vectorStore.delete(id);
      }
    }
    
    const fs = require('fs');
    let totalChunks = 0;
    
    for (let i = 0; i < files.length; i++) {
      try {
        const content = fs.readFileSync(files[i], 'utf-8');
        const chunks = chunkContent(content, files[i], project);
        
        for (const chunk of chunks) {
          const embedding = await generateEmbedding(chunk.content);
          vectorStore.set(chunk.id, {
            content: chunk.content,
            embedding,
            metadata: { file_path: chunk.filePath, language: chunk.language, project_name: chunk.projectName },
          });
          totalChunks++;
        }
      } catch (err) {
        logger.warn({ file: files[i] }, 'Failed to process file');
      }
      
      if (i % 10 === 0) {
        logger.info({ progress: Math.floor((i / files.length) * 100), chunks: totalChunks }, 'Indexing progress');
      }
    }
    
    logger.info({ project, files: files.length, chunks: totalChunks }, 'Indexing complete');
    return { status: 'complete', files: files.length, chunks: totalChunks };
  },
  
  // Search
  async search(query: string, projectName?: string, topK = 5) {
    const queryEmbedding = await generateEmbedding(query);
    
    const results: Array<{ id: string; score: number }> = [];
    
    for (const [id, entry] of vectorStore) {
      if (projectName && entry.metadata.project_name !== projectName) continue;
      const score = cosineSimilarity(queryEmbedding, entry.embedding);
      results.push({ id, score });
    }
    
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, topK).map(r => {
      const entry = vectorStore.get(r.id)!;
      return { id: r.id, content: entry.content, metadata: entry.metadata, score: r.score };
    });
  },
  
  // Chat
  async chat(message: string, projectName?: string, conversationId?: string) {
    // For cloud mode, use external API
    if (currentConfig.mode === 'cloud') {
      return this.chatWithCloud(message, projectName, conversationId);
    }
    
    // For local/custom mode, use local vector store
    const searchResults = await this.search(message, projectName, 5);
    
    const contextText = searchResults.slice(0, 5).map(r => `File: ${r.metadata.file_path}\n${r.content}`).join('\n\n');
    
    const systemPrompt = `You are an AI coding assistant. Use this context:\n${contextText}\n\nAnswer accurately.`;
    
    let convId = conversationId;
    if (!convId) {
      convId = this.createConversation(projectName);
    }
    
    const conv = this.getConversation(convId);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conv?.messages.slice(-10) || []),
      { role: 'user', content: message },
    ];
    
    try {
      const reply = await callChatAPI(messages);
      
      this.addMessage(convId, 'user', message);
      this.addMessage(convId, 'assistant', reply);
      
      return { response: reply, conversationId: convId };
    } catch (err: any) {
      return { response: `Error: ${err.message}. Make sure Ollama is running at ${getBaseUrl()}`, conversationId: convId };
    }
  },
  
  // Cloud chat (uses external API)
  async chatWithCloud(message: string, projectName?: string, conversationId?: string) {
    let convId = conversationId;
    if (!convId) {
      convId = this.createConversation(projectName);
    }
    
    const conv = this.getConversation(convId);
    
    // Determine which provider to use based on config
    const messages = [
      { role: 'system', content: 'You are a helpful AI coding assistant. Provide clear, accurate answers.' },
      ...(conv?.messages.slice(-10) || []),
      { role: 'user', content: message },
    ];
    
    try {
      let reply = '';
      
      // If using custom endpoint (OpenAI-compatible)
      if (currentConfig.customEndpoint) {
        reply = await this.callOpenAICompatAPI(messages);
      } else if (currentConfig.mode === 'cloud' && currentConfig.cloudProvider) {
        // Use cloud provider
        reply = await this.callCloudProviderAPI(messages, currentConfig.cloudProvider);
      } else {
        return { response: 'Please configure a cloud provider or custom endpoint in Settings > RAG tab.', conversationId: convId };
      }
      
      this.addMessage(convId, 'user', message);
      this.addMessage(convId, 'assistant', reply);
      return { response: reply, conversationId: convId };
    } catch (err: any) {
      return { response: `Error: ${err.message}`, conversationId: convId };
    }
  },
  
  // Call OpenAI-compatible API
  async callOpenAICompatAPI(messages: Array<{ role: string; content: string }>): Promise<string> {
    const baseUrl = currentConfig.customEndpoint || 'https://api.openai.com/v1';
    const model = currentConfig.chatModel || 'gpt-4o';
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (currentConfig.apiKey) {
      headers['Authorization'] = `Bearer ${currentConfig.apiKey}`;
    }
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error (${response.status}): ${error}`);
    }
    
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || '';
  },
  
  // Call cloud provider APIs
  async callCloudProviderAPI(messages: Array<{ role: string; content: string }>, provider: string): Promise<string> {
    const apiKey = currentConfig.apiKey;
    
    if (!apiKey) {
      throw new Error(`API key required for ${provider}. Please add it in Settings.`);
    }
    
    let endpoint = '';
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    let body: any = { messages };
    
    switch (provider) {
      case 'openai':
        endpoint = 'https://api.openai.com/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        body.model = 'gpt-4o';
        break;
        
      case 'anthropic':
        endpoint = 'https://api.anthropic.com/v1/messages';
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        body.model = 'claude-sonnet-4-20250514';
        break;
        
      case 'groq':
        endpoint = 'https://api.groq.com/openai/v1/chat/completions';
        headers['Authorization'] = `Bearer ${apiKey}`;
        body.model = 'llama-3.3-70b-versatile';
        break;
        
      case 'google':
        endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        body.contents = [{ parts: [{ text: messages.map(m => `${m.role}: ${m.content}`).join('\n') }] }];
        break;
        
      default:
        throw new Error('Unknown cloud provider');
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error (${response.status}): ${error}`);
    }
    
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; content?: Array<{ text?: string }>; candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    
    // Parse response based on provider
    if (provider === 'openai' || provider === 'groq') {
      return data.choices?.[0]?.message?.content || '';
    } else if (provider === 'anthropic') {
      return data.content?.[0]?.text || '';
    } else if (provider === 'google') {
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
    
    return '';
  },
  
  // Conversation management
  createConversation(projectName?: string) {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    conversations.set(id, { id, projectName: projectName || 'default', messages: [] });
    return id;
  },
  
  addMessage(conversationId: string, role: string, content: string) {
    const conv = conversations.get(conversationId);
    if (conv) {
      conv.messages.push({ role, content });
    }
  },
  
  getConversation(conversationId: string) {
    return conversations.get(conversationId);
  },
  
  listConversations(projectName?: string) {
    return Array.from(conversations.values()).filter(c => !projectName || c.projectName === projectName);
  },
  
  deleteConversation(conversationId: string) {
    return conversations.delete(conversationId);
  },
  
  // Clear all data
  clearAll() {
    vectorStore.clear();
    conversations.clear();
    return { cleared: true };
  },
};
