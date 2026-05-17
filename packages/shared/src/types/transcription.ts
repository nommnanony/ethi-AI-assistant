export type TranscriptionProviderType = 'DEEPGRAM' | 'ASSEMBLYAI' | 'WHISPER' | 'CUSTOM';

export interface TranscriptInfo {
  id: string;
  title: string | null;
  duration: number | null;
  provider: TranscriptionProviderType;
  language: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELED';
  isStreaming: boolean;
  aiSummary: string | null;
  segmentCount: number;
  createdAt: string;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName: string | null;
  content: string;
  startTime: number;
  endTime: number;
  confidence: number | null;
  isFinal: boolean;
  createdAt: string;
}

export interface TranscriptionStreamEvent {
  type: 'segment' | 'partial' | 'summary' | 'error' | 'done';
  transcriptId: string;
  segment?: TranscriptSegment;
  summary?: string;
  error?: string;
}
