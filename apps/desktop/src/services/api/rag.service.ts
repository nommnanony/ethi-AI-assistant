import type { RAGStatus, RAGConfig } from '../../types';

class RAGService {
  async getStatus(): Promise<RAGStatus> {
    if (window.electronAPI?.ragStatus) {
      const status = await window.electronAPI.ragStatus();
      return {
        ollamaConnected: status.ollamaConnected ?? false,
        vectors: status.vectors ?? 0,
        projects: status.projects ?? [],
        conversations: status.conversations ?? 0,
      };
    }

    return {
      ollamaConnected: false,
      vectors: 0,
      projects: [],
      conversations: 0,
    };
  }

  async setConfig(config: Partial<RAGConfig>): Promise<{ success: boolean; config?: RAGConfig }> {
    if (window.electronAPI?.ragSetConfig) {
      return window.electronAPI.ragSetConfig(config);
    }

    return { success: false };
  }

  async indexProject(projectPath: string): Promise<void> {
    const response = await fetch('/api/rag/index', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath }),
    });

    if (!response.ok) {
      throw new Error('Failed to index project');
    }
  }

  async query(query: string, topK = 5): Promise<string[]> {
    const response = await fetch('/api/rag/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, topK }),
    });

    if (!response.ok) {
      throw new Error('Failed to query RAG');
    }

    return response.json();
  }
}

export const ragService = new RAGService();
