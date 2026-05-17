import { aiService } from '../../modules/ai/ai.service';
import { eventRegistry, type WsEvent, type HandlerContext } from '../events';
import { logger } from '../../common/logger';
import type { AIMessage, StreamChunk } from '../../providers/ai/types';

interface ActiveStream {
  controller: AbortController;
  userId: string;
}

const activeStreams = new Map<string, ActiveStream>();

export function registerAiHandlers(): void {
  eventRegistry.on('ai:chat', async (event: WsEvent, context: HandlerContext) => {
    const payload = event.payload as {
      conversationId: string;
      workspaceId: string;
      message: string;
      provider?: string;
      model?: string;
      attachments?: string[];
    };

    try {
      const messages: AIMessage[] = [
        { role: 'user', content: payload.message },
      ];

      const controller = new AbortController();
      activeStreams.set(payload.conversationId, { controller, userId: context.userId });

      const selectedProvider = payload.provider || 'openai';
      const selectedModel = payload.model;

      let fullContent = '';

      await aiService.chatStream(
        messages,
        async (chunk: StreamChunk) => {
          if (controller.signal.aborted) return;

          if (chunk.type === 'content' && chunk.content) {
            fullContent += chunk.content;
            context.socket.send(
              JSON.stringify({
                type: 'ai:stream',
                payload: {
                  conversationId: payload.conversationId,
                  content: chunk.content,
                  done: false,
                },
              }),
            );
          }

          if (chunk.type === 'done' || chunk.type === 'error') {
            activeStreams.delete(payload.conversationId);

            if (chunk.type === 'error') {
              context.socket.send(
                JSON.stringify({
                  type: 'ai:stream',
                  payload: {
                    conversationId: payload.conversationId,
                    error: chunk.error,
                    done: true,
                  },
                }),
              );
              return;
            }

            context.socket.send(
              JSON.stringify({
                type: 'ai:complete',
                payload: {
                  conversationId: payload.conversationId,
                  content: fullContent,
                  model: selectedModel || 'gpt-4o',
                  provider: selectedProvider,
                  tokens: chunk.tokens || { prompt: 0, completion: 0, total: 0 },
                },
              }),
            );
          }
        },
        selectedProvider,
        selectedModel,
        context.userId,
      );
    } catch (error) {
      activeStreams.delete(payload.conversationId);
      logger.error({ err: error, userId: context.userId, conversationId: payload.conversationId }, 'AI chat stream failed');
      context.socket.send(
        JSON.stringify({
          type: 'error',
          payload: { code: 'AI_STREAM_FAILED', message: 'Failed to start AI response stream' },
        }),
      );
    }
  });

  eventRegistry.on('ai:cancel', async (event: WsEvent, context: HandlerContext) => {
    const payload = event.payload as { conversationId: string };
    const stream = activeStreams.get(payload.conversationId);

    if (!stream) {
      context.socket.send(
        JSON.stringify({
          type: 'error',
          payload: { code: 'STREAM_NOT_FOUND', message: 'No active stream found for this conversation' },
        }),
      );
      return;
    }

    if (stream.userId !== context.userId) {
      context.socket.send(
        JSON.stringify({
          type: 'error',
          payload: { code: 'FORBIDDEN', message: 'Cannot cancel another user\'s stream' },
        }),
      );
      return;
    }

    stream.controller.abort();
    activeStreams.delete(payload.conversationId);

    context.socket.send(
      JSON.stringify({
        type: 'ai:cancelled',
        payload: { conversationId: payload.conversationId },
      }),
    );
  });
}
