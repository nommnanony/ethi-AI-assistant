import { FastifyInstance } from 'fastify';
import { ragService } from './rag.service';

export async function ragRoutes(fastify: FastifyInstance) {
  
  // Get RAG configuration
  fastify.get('/api/rag/config', async () => {
    return ragService.getConfig();
  });
  
  // Configure RAG (local/cloud/custom)
  fastify.post<{ Body: { mode?: string; ollamaUrl?: string; customEndpoint?: string; apiKey?: string; embeddingModel?: string; chatModel?: string } }>('/api/rag/config', async (request, reply) => {
    const { mode, ollamaUrl, customEndpoint, apiKey, embeddingModel, chatModel } = request.body;
    
    const config: any = {};
    if (mode) config.mode = mode;
    if (ollamaUrl) config.ollamaUrl = ollamaUrl;
    if (customEndpoint) config.customEndpoint = customEndpoint;
    if (apiKey) config.apiKey = apiKey;
    if (embeddingModel) config.embeddingModel = embeddingModel;
    if (chatModel) config.chatModel = chatModel;
    
    return ragService.configure(config);
  });
  
  // Index a project
  fastify.post<{ Body: { project_path: string; project_name?: string } }>('/api/rag/index', async (request, reply) => {
    const { project_path, project_name } = request.body;
    
    if (!project_path) {
      return reply.status(400).send({ error: 'project_path is required' });
    }
    
    try {
      const result = await ragService.indexProject(project_path, project_name);
      return result;
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
  
  // Get RAG status
  fastify.get('/api/rag/status', async () => {
    return ragService.getStatus();
  });
  
  // Search
  fastify.post<{ Body: { query: string; project_name?: string; top_k?: number } }>('/api/rag/search', async (request, reply) => {
    const { query, project_name, top_k } = request.body;
    
    if (!query) {
      return reply.status(400).send({ error: 'query is required' });
    }
    
    try {
      const results = await ragService.search(query, project_name, top_k || 5);
      return { results };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
  
  // Chat with RAG
  fastify.post<{ Body: { message: string; project_name?: string; conversation_id?: string } }>('/api/rag/chat', async (request, reply) => {
    const { message, project_name, conversation_id } = request.body;
    
    if (!message) {
      return reply.status(400).send({ error: 'message is required' });
    }
    
    try {
      const result = await ragService.chat(message, project_name, conversation_id);
      return result;
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
  
  // List conversations
  fastify.get<{ Querystring: { project_name?: string } }>('/api/rag/conversations', async (request, reply) => {
    const projectName = request.query.project_name;
    return ragService.listConversations(projectName);
  });
  
  // Create conversation
  fastify.post<{ Body: { project_name?: string } }>('/api/rag/conversations', async (request, reply) => {
    const { project_name } = request.body;
    const conversationId = ragService.createConversation(project_name);
    return { conversation_id: conversationId };
  });
  
  // Delete conversation
  fastify.delete('/api/rag/conversations/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = ragService.deleteConversation(id);
    return { deleted };
  });
  
  // Clear all data
  fastify.delete('/api/rag/clear', async () => {
    return ragService.clearAll();
  });
}
