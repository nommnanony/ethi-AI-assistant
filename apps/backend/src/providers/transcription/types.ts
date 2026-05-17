import type { EventEmitter } from 'events'

export interface TranscriptSegment {
  speakerId: string | null
  speakerName: string | null
  content: string
  startTime: number
  endTime: number
  confidence: number
  isFinal: boolean
}

export type TranscriptionEventType = 'segment' | 'partial' | 'summary' | 'error' | 'done'

export interface TranscriptionEvent {
  type: TranscriptionEventType
  transcriptId: string
  segment?: TranscriptSegment
  summary?: string
  error?: string
}

export interface TranscriptionOptions {
  language?: string
  encoding?: string
  sampleRate?: number
  channels?: number
  model?: string
  punctuate?: boolean
  diarize?: boolean
  interimResults?: boolean
  keywords?: string[]
}

export interface TranscriptionConfig {
  provider: 'deepgram' | 'assemblyai' | 'whisper'
  apiKey?: string
  apiUrl?: string
  options?: TranscriptionOptions
}

export interface TranscriptionProvider {
  startStream(options: TranscriptionOptions): Promise<void>
  processAudioChunk(chunk: Buffer): Promise<void>
  stopStream(): Promise<TranscriptionEvent>
  getTranscript(): Promise<string>
  getEvents(): EventEmitter
  destroy(): Promise<void>
}
