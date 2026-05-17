import type { WebSocket } from 'ws';
import { logger } from '../common/logger';

export interface TranscriptionStartPayload {
  sessionId?: string;
  workspaceId: string;
  provider: string;
  language?: string;
  encoding?: string;
  sampleRate?: number;
  channels?: number;
  model?: string;
  punctuate?: boolean;
  diarize?: boolean;
  interimResults?: boolean;
  keywords?: string[];
}

export interface TranscriptionAudioPayload {
  sessionId: string;
  audio: string;
}

export interface TranscriptionStopPayload {
  sessionId: string;
}

export interface TranscriptionSegmentPayload {
  sessionId?: string;
  segmentId: string;
  content: string;
  startTime: number;
  endTime: number;
  isFinal: boolean;
  speakerId?: string;
  speakerName?: string;
  confidence?: number;
}

export interface TranscriptionPartialPayload {
  sessionId?: string;
  content: string;
  startTime: number;
  endTime: number;
  isFinal: boolean;
}

export interface AiChatPayload {
  conversationId: string;
  workspaceId: string;
  message: string;
  provider?: string;
  model?: string;
  attachments?: string[];
}

export interface AiStreamPayload {
  conversationId: string;
  content?: string;
  done?: boolean;
  error?: string;
  finishReason?: string;
  tokens?: { prompt: number; completion: number; total: number };
}

export interface AiCompletePayload {
  conversationId: string;
  content: string;
  model: string;
  provider: string;
  tokens: { prompt: number; completion: number; total: number };
}

export interface AiCancelPayload {
  conversationId: string;
}

export interface NotificationPayload {
  notificationId: string;
  type: string;
  title: string;
  body: string;
  data?: unknown;
}

export interface WorkspaceUpdatePayload {
  workspaceId: string;
  action: string;
  entity: string;
  entityId: string;
  data?: unknown;
}

export interface HeartbeatPayload {
  timestamp: number;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export type WsEvent =
  | { type: 'transcription:start'; payload: TranscriptionStartPayload }
  | { type: 'transcription:audio'; payload: TranscriptionAudioPayload }
  | { type: 'transcription:stop'; payload: TranscriptionStopPayload }
  | { type: 'transcription:segment'; payload: TranscriptionSegmentPayload }
  | { type: 'transcription:partial'; payload: TranscriptionPartialPayload }
  | { type: 'ai:chat'; payload: AiChatPayload }
  | { type: 'ai:stream'; payload: AiStreamPayload }
  | { type: 'ai:cancel'; payload: AiCancelPayload }
  | { type: 'ai:complete'; payload: AiCompletePayload }
  | { type: 'notification'; payload: NotificationPayload }
  | { type: 'workspace:update'; payload: WorkspaceUpdatePayload }
  | { type: 'heartbeat'; payload: HeartbeatPayload }
  | { type: 'error'; payload: ErrorPayload };

export interface HandlerContext {
  userId: string;
  socket: WebSocket;
}

type EventHandler = (event: WsEvent, context: HandlerContext) => void | Promise<void>;

class EventRegistry {
  private handlers = new Map<string, Set<EventHandler>>();

  on(type: WsEvent['type'], handler: EventHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  off(type: WsEvent['type'], handler: EventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  async emit(event: WsEvent, context: HandlerContext): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        await handler(event, context);
      } catch (error) {
        logger.error({ err: error, eventType: event.type, userId: context.userId }, 'WebSocket event handler error');
      }
    }
  }
}

export const eventRegistry = new EventRegistry();
