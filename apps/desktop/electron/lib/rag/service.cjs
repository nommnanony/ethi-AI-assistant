const fs = require('fs');
const path = require('path');

class Chunker {
  constructor(chunkSize = 800, overlap = 100) {
    this.chunkSize = chunkSize;
    this.overlap = overlap;
  }

  chunk(content, filePath, projectName) {
    const language = this.detectLanguage(filePath);
    if (this.isCodeFile(language)) {
      return this.chunkCode(content, filePath, language, projectName);
    }
    return this.chunkText(content, filePath, language, projectName);
  }

  detectLanguage(filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const map = { py: 'python', js: 'javascript', ts: 'typescript', tsx: 'typescript', jsx: 'javascript', md: 'markdown', txt: 'text', json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml', html: 'html', css: 'css', sql: 'sql', sh: 'bash', bash: 'bash' };
    return map[ext] || 'text';
  }

  isCodeFile(language) {
    return ['python', 'javascript', 'typescript', 'sql', 'html', 'css'].includes(language);
  }

  chunkCode(content, filePath, language, projectName) {
    const chunks = [];
    const delimiters = { python: ['\nclass ', '\ndef ', '\n    def ', '\n\n'], javascript: ['\nfunction ', '\nconst ', '\nlet ', '\nclass ', '\nexport ', '\nimport '], typescript: ['\nfunction ', '\nconst ', '\nlet ', '\nclass ', '\nexport ', '\nimport ', '\ninterface '] }[language] || ['\n\n'];
    
    const parts = content.split(new RegExp(`(${delimiters.join('|')})`, 'g'));
    let currentChunk = '';
    let chunkIdx = 0;

    for (const part of parts) {
      if ((currentChunk + part).length > this.chunkSize && currentChunk) {
        if (currentChunk.trim()) chunks.push({ id: `${filePath}_${chunkIdx}`, content: currentChunk.trim(), filePath, language, chunkIndex: chunkIdx, projectName });
        chunkIdx++;
        currentChunk = currentChunk.slice(-this.overlap) + part;
      } else {
        currentChunk += part;
      }
    }
    if (currentChunk.trim()) chunks.push({ id: `${filePath}_${chunkIdx}`, content: currentChunk.trim(), filePath, language, chunkIndex: chunkIdx, projectName });
    return chunks;
  }

  chunkText(content, filePath, language, projectName) {
    const chunks = [];
    for (let i = 0; i < content.length; i += this.chunkSize - this.overlap) {
      const chunk = content.slice(i, i + this.chunkSize).trim();
      if (chunk) chunks.push({ id: `${filePath}_${Math.floor(i / this.chunkSize)}`, content: chunk, filePath, language, chunkIndex: Math.floor(i / this.chunkSize), projectName });
    }
    return chunks;
  }

  static isAllowedFile(filePath) {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    return ['.py', '.js', '.ts', '.tsx', '.jsx', '.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.html', '.css', '.sql', '.sh', '.bash'].includes(ext);
  }

  static shouldIgnoreDir(dirName) {
    return ['node_modules', '.git', 'dist', 'build', 'venv', '__pycache__', '.next', '.nuxt', 'target', '.cache', 'vendor', 'bin', 'obj'].includes(dirName);
  }
}

class OllamaClient {
  constructor(baseUrl = 'http://localhost:11434', embeddingModel = 'nomic-embed-text', chatModel = 'qwen2.5-coder:3b') {
    this.baseUrl = baseUrl;
    this.embeddingModel = embeddingModel;
    this.chatModel = chatModel;
  }

  async healthCheck() {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch { return false; }
  }

  async generateEmbedding(text) {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.embeddingModel, prompt: text }) });
    if (!res.ok) throw new Error(`Embedding failed: ${res.status}`);
    const data = await res.json();
    return data.embedding || [];
  }

  async generateEmbeddingsBatch(texts, batchSize = 32) {
    const all = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const promises = batch.map(t => this.generateEmbedding(t).catch(() => Array(768).fill(0)));
      const embeddings = await Promise.all(promises);
      all.push(...embeddings);
    }
    return all;
  }

  async *chat(messages) {
    const res = await fetch(`${this.baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.chatModel, messages, stream: true }) });
    if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line);
          if (data.message?.content) yield data.message.content;
          if (data.done) return;
        } catch {}
      }
    }
  }

  async chatComplete(messages) {
    const res = await fetch(`${this.baseUrl}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.chatModel, messages }) });
    if (!res.ok) throw new Error(`Chat failed: ${res.status}`);
    const data = await res.json();
    return data.message?.content || '';
  }
}

class VectorStore {
  constructor(persistPath = './rag-data/vectors.json') {
    this.persistPath = persistPath;
    this.vectors = new Map();
  }

  async initialize() {
    try {
      const data = fs.readFileSync(this.persistPath, 'utf-8');
      const entries = JSON.parse(data);
      for (const entry of entries) this.vectors.set(entry.id, entry);
    } catch { this.vectors = new Map(); }
  }

  async save() {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.persistPath, JSON.stringify(Array.from(this.vectors.values())));
    } catch (err) { console.error('Failed to save vectors:', err); }
  }

  async addChunks(chunks, embeddings) {
    if (chunks.length !== embeddings.length) throw new Error(`Chunk count (${chunks.length}) != embedding count (${embeddings.length})`);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      this.vectors.set(chunk.id, { id: chunk.id, content: chunk.content, embedding: embeddings[i], metadata: { file_path: chunk.filePath, language: chunk.language, chunk_index: chunk.chunkIndex, project_name: chunk.projectName } });
    }
    await this.save();
  }

  async search(queryEmbedding, topK = 5, projectName, minScore = 0.0) {
    const results = [];
    for (const [id, entry] of this.vectors) {
      if (projectName && entry.metadata.project_name !== projectName) continue;
      const score = this.cosineSimilarity(queryEmbedding, entry.embedding);
      if (score >= minScore) results.push({ id, score });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK).map(r => ({ id: r.id, content: this.vectors.get(r.id).content, metadata: this.vectors.get(r.id).metadata, score: r.score }));
  }

  cosineSimilarity(a, b) {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
  }

  async deleteByProject(projectName) {
    for (const [id, entry] of this.vectors) {
      if (entry.metadata.project_name === projectName) this.vectors.delete(id);
    }
    await this.save();
  }

  async getStats() {
    const projects = new Set(), files = new Set();
    for (const entry of this.vectors.values()) {
      if (entry.metadata.project_name) projects.add(entry.metadata.project_name);
      if (entry.metadata.file_path) files.add(entry.metadata.file_path);
    }
    return { totalChunks: this.vectors.size, projects: Array.from(projects), fileCount: files.size };
  }
}

class MemoryStore {
  constructor(persistPath = './rag-data/memory.json') {
    this.persistPath = persistPath;
    this.conversations = new Map();
  }

  async initialize() {
    try {
      const data = fs.readFileSync(this.persistPath, 'utf-8');
      const convos = JSON.parse(data);
      for (const c of convos) this.conversations.set(c.id, c);
    } catch { this.conversations = new Map(); }
  }

  async save() {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.persistPath, JSON.stringify(Array.from(this.conversations.values())));
    } catch (err) { console.error('Failed to save memory:', err); }
  }

  createConversation(projectName) {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    this.conversations.set(id, { id, projectName: projectName || 'default', title: 'New Conversation', messages: [], createdAt: now, updatedAt: now });
    this.save();
    return id;
  }

  addMessage(conversationId, message) {
    const conv = this.conversations.get(conversationId);
    if (!conv) return false;
    conv.messages.push({ ...message, timestamp: new Date().toISOString() });
    conv.updatedAt = new Date().toISOString();
    this.save();
    return true;
  }

  getConversation(conversationId) { return this.conversations.get(conversationId); }

  listConversations(projectName, limit = 20) {
    const all = Array.from(this.conversations.values());
    let filtered = projectName ? all.filter(c => c.projectName === projectName) : all;
    return filtered.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, limit);
  }

  getRecentContext(limit = 3) {
    const all = Array.from(this.conversations.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const messages = [];
    for (const conv of all) {
      messages.push(...conv.messages.slice(-2));
      if (messages.length >= limit) break;
    }
    return messages.slice(0, limit);
  }

  deleteConversation(conversationId) {
    const deleted = this.conversations.delete(conversationId);
    if (deleted) this.save();
    return deleted;
  }

  getStats() {
    let count = 0;
    for (const c of this.conversations.values()) count += c.messages.length;
    return { conversations: this.conversations.size, messages: count };
  }
}

class RAGService {
  constructor() {
    this.chunker = new Chunker(800, 100);
    this.ollama = new OllamaClient();
    this.vectorStore = new VectorStore();
    this.memoryStore = new MemoryStore();
    this.indexingProgress = new Map();
  }

  async initialize() {
    await this.vectorStore.initialize();
    await this.memoryStore.initialize();
  }

  async healthCheck() {
    const ollamaConnected = await this.ollama.healthCheck();
    const vectorStats = await this.vectorStore.getStats();
    const memoryStats = this.memoryStore.getStats();
    return { ollama: ollamaConnected, vectors: vectorStats.totalChunks, conversations: memoryStats.conversations };
  }

  async *indexProject(projectPath, projectName, onProgress) {
    const project = projectName || path.basename(projectPath);
    if (onProgress) onProgress({ status: 'scanning', progress: 0 });
    
    try {
      const files = this.scanProject(projectPath);
      if (onProgress) onProgress({ status: 'scanning', progress: 10, files: files.length });
      
      await this.vectorStore.deleteByProject(project);
      
      const allChunks = [];
      for (let i = 0; i < files.length; i++) {
        try {
          const content = fs.readFileSync(files[i], 'utf-8');
          const chunks = this.chunker.chunk(content, files[i], project);
          allChunks.push(...chunks);
        } catch (err) { console.warn(`Failed to process ${files[i]}:`, err); }
        
        const progress = 10 + Math.floor((i + 1) / files.length * 80);
        if (onProgress) onProgress({ status: 'indexing', progress, chunks: allChunks.length, currentFile: files[i] });
      }

      if (allChunks.length > 0) {
        const texts = allChunks.map(c => c.content);
        const embeddings = await this.ollama.generateEmbeddingsBatch(texts);
        await this.vectorStore.addChunks(allChunks, embeddings);
      }

      const final = { status: 'complete', progress: 100, files: files.length, chunks: allChunks.length };
      if (onProgress) onProgress(final);
    } catch (err) {
      if (onProgress) onProgress({ status: 'error', progress: 0, error: err.message });
    }
  }

  scanProject(projectPath) {
    const files = [];
    const scan = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!Chunker.shouldIgnoreDir(entry.name)) scan(fullPath);
          } else if (entry.isFile() && Chunker.isAllowedFile(entry.name)) {
            try {
              const stat = fs.statSync(fullPath);
              if (stat.size < 10 * 1024 * 1024) files.push(fullPath);
            } catch {}
          }
        }
      } catch {}
    };
    scan(projectPath);
    return files;
  }

  async search(query, projectName, topK = 5) {
    const queryEmbedding = await this.ollama.generateEmbedding(query);
    return this.vectorStore.search(queryEmbedding, topK, projectName);
  }

  async *chat(message, projectName, conversationId, stream = true) {
    const searchResults = await this.search(message, projectName, 5);
    const conversation = conversationId ? this.memoryStore.getConversation(conversationId) : null;
    const recentMessages = conversation?.messages.slice(-10) || [];
    const memoryContext = this.memoryStore.getRecentContext(3);

    const contextText = this.buildContextPrompt(searchResults, memoryContext);
    const systemPrompt = `You are an AI coding assistant helping with a project.

Available context from the project:
${contextText}

Instructions:
- Use the provided context to answer questions accurately
- If the context doesn't contain relevant information, say so
- Reference specific files when possible
- Be concise and helpful`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ];

    if (stream) {
      for await (const chunk of this.ollama.chat(messages)) {
        yield chunk;
      }
    } else {
      yield await this.ollama.chatComplete(messages);
    }
  }

  async chatComplete(message, projectName, conversationId) {
    let fullResponse = '';
    for await (const chunk of this.chat(message, projectName, conversationId, true)) {
      fullResponse += chunk;
    }
    if (conversationId) {
      this.memoryStore.addMessage(conversationId, { role: 'user', content: message });
      this.memoryStore.addMessage(conversationId, { role: 'assistant', content: fullResponse });
    }
    return fullResponse;
  }

  buildContextPrompt(results, memoryContext) {
    const parts = [];
    for (const result of results.slice(0, 5)) {
      parts.push(`File: ${result.metadata.file_path}\nContent:\n${result.content}\n`);
    }
    for (const mem of memoryContext) {
      parts.push(`Previous: ${mem.content}`);
    }
    return parts.slice(0, 10).join('\n\n');
  }

  getIndexingProgress(projectName) { return this.indexingProgress.get(projectName) || { status: 'idle', progress: 0 }; }
  createConversation(projectName) { return this.memoryStore.createConversation(projectName); }
  getConversation(conversationId) { return this.memoryStore.getConversation(conversationId); }
  listConversations(projectName) { return this.memoryStore.listConversations(projectName); }
  deleteConversation(conversationId) { return this.memoryStore.deleteConversation(conversationId); }

  async getStats() {
    const vectorStats = await this.vectorStore.getStats();
    const memoryStats = this.memoryStore.getStats();
    const ollamaConnected = await this.ollama.healthCheck();
    return { vectorStore: vectorStats, memory: memoryStats, ollamaConnected };
  }
}

module.exports = { RAGService };