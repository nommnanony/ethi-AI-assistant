class RAGService {
    async getStatus() {
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
    async setConfig(config) {
        if (window.electronAPI?.ragSetConfig) {
            return window.electronAPI.ragSetConfig(config);
        }
        return { success: false };
    }
    async indexProject(projectPath) {
        const response = await fetch('/api/rag/index', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath }),
        });
        if (!response.ok) {
            throw new Error('Failed to index project');
        }
    }
    async query(query, topK = 5) {
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
