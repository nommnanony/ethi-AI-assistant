import { EventEmitter } from 'events'
import { WebSocket } from 'ws'
import { logger } from '../../common/logger'
import type {
  TranscriptionProvider,
  TranscriptionOptions,
  TranscriptionEvent,
  TranscriptSegment,
} from './types'

const ASSEMBLYAI_BASE_URL = 'wss://api.assemblyai.com/v2/realtime/ws'
const ASSEMBLYAI_REST_URL = 'https://api.assemblyai.com/v2'
const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_BASE_DELAY = 1000
const TERMINATE_MSG = JSON.stringify({ terminate_session: true })

type AssemblyAIMessage = {
  message_type?: string
  audio_start?: number
  audio_end?: number
  error?: string
  created?: string
  words?: Array<{
    start: number
    end: number
    confidence: number
    word: string
    speaker?: string | null
  }>
  text?: string
  confidence?: number
}

export class AssemblyAIProvider implements TranscriptionProvider {
  private ws: WebSocket | null = null
  private apiKey: string
  private events: EventEmitter
  private transcriptId: string
  private segments: TranscriptSegment[] = []
  private partialText: string = ''
  private streamActive: boolean = false
  private reconnectAttempts: number = 0
  private currentOptions: TranscriptionOptions | null = null
  private destroyRequested: boolean = false
  private startTimeOffset: number = 0

  constructor(apiKey: string, transcriptId: string) {
    this.apiKey = apiKey
    this.transcriptId = transcriptId
    this.events = new EventEmitter()
    this.events.setMaxListeners(50)
  }

  async startStream(options: TranscriptionOptions): Promise<void> {
    this.destroyRequested = false
    this.currentOptions = options
    this.streamActive = true
    this.startTimeOffset = 0

    try {
      await this.createConnection(options)
    } catch (error) {
      this.streamActive = false
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error, transcriptId: this.transcriptId }, 'Failed to start AssemblyAI stream')
      this.emitError(message)
      throw error
    }
  }

  private async createConnection(options: TranscriptionOptions): Promise<void> {
    const params = new URLSearchParams({
      sample_rate: String(options.sampleRate ?? 16000),
      token: this.apiKey,
    })

    if (options.language) {
      params.set('language', options.language)
    }

    if (options.diarize) {
      params.set('speaker_labels', 'true')
    }

    if (options.encoding) {
      params.set('encoding', options.encoding)
    }

    const url = `${ASSEMBLYAI_BASE_URL}?${params.toString()}`

    this.ws = new WebSocket(url)

    this.ws.on('open', this.handleOpen)
    this.ws.on('message', this.handleMessage)
    this.ws.on('error', this.handleError)
    this.ws.on('close', this.handleClose)

    await new Promise<void>((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'))
        return
      }

      this.ws.once('open', () => {
        this.reconnectAttempts = 0
        logger.info({ transcriptId: this.transcriptId }, 'AssemblyAI connection established')
        resolve()
      })

      this.ws.once('error', (err) => {
        reject(err instanceof Error ? err : new Error(String(err)))
      })

      setTimeout(() => {
        reject(new Error('AssemblyAI connection timed out'))
      }, 10_000)
    })
  }

  async processAudioChunk(chunk: Buffer): Promise<void> {
    if (!this.ws || !this.streamActive) {
      return
    }

    try {
      this.ws.send(chunk)
    } catch (error) {
      logger.error({ err: error, transcriptId: this.transcriptId }, 'Failed to send audio chunk to AssemblyAI')
      this.emitError('Failed to process audio chunk')
    }
  }

  async stopStream(): Promise<TranscriptionEvent> {
    this.streamActive = false

    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(TERMINATE_MSG)
      } catch {
        // ignore close errors
      }
    }

    this.cleanupConnection()

    return {
      type: 'done',
      transcriptId: this.transcriptId,
    }
  }

  async getTranscript(): Promise<string> {
    const segments = this.segments

    if (!this.currentOptions?.diarize) {
      return segments.map((s) => s.content).join(' ')
    }

    const speakerMap = new Map<string, string[]>()
    for (const seg of segments) {
      const id = seg.speakerId ?? 'unknown'
      if (!speakerMap.has(id)) {
        speakerMap.set(id, [])
      }
      speakerMap.get(id)!.push(seg.content)
    }

    return Array.from(speakerMap.entries())
      .map(([speaker, lines]) => `Speaker ${speaker}:\n${lines.join(' ')}`)
      .join('\n\n')
  }

  getEvents(): EventEmitter {
    return this.events
  }

  async destroy(): Promise<void> {
    this.destroyRequested = true
    this.streamActive = false
    this.currentOptions = null
    this.reconnectAttempts = 0

    this.cleanupConnection()
    this.events.removeAllListeners()
    this.segments = []
    this.partialText = ''
  }

  private handleOpen = (): void => {
    logger.info({ transcriptId: this.transcriptId }, 'AssemblyAI WebSocket opened')
  }

  private handleMessage = (data: WebSocket.Data): void => {
    try {
      const message: AssemblyAIMessage = JSON.parse(data.toString())

      if (message.error) {
        logger.error({ error: message.error, transcriptId: this.transcriptId }, 'AssemblyAI error message')
        this.emitError(message.error)
        return
      }

      if (message.message_type === 'SessionBegins') {
        this.startTimeOffset = message.audio_start ?? 0
        logger.info(
          { transcriptId: this.transcriptId, audioStart: this.startTimeOffset },
          'AssemblyAI session started'
        )
        return
      }

      if (message.message_type === 'FinalTranscript' || message.message_type === 'PartialTranscript') {
        const isFinal = message.message_type === 'FinalTranscript'
        const content = message.text ?? ''

        if (!content) return

        if (isFinal) {
          const words = message.words ?? []
          const startTime = words.length > 0 ? words[0].start : 0
          const endTime = words.length > 0 ? words[words.length - 1].end : 0

          let speakerId: string | null = null
          let speakerName: string | null = null

          if (words.length > 0 && words[0].speaker) {
            speakerId = words[0].speaker
          }

          if (speakerId) {
            speakerName = `Speaker ${speakerId}`
          }

          const segment: TranscriptSegment = {
            speakerId,
            speakerName,
            content,
            startTime,
            endTime,
            confidence: message.confidence ?? 0,
            isFinal: true,
          }

          this.segments.push(segment)
          this.emitEvent({ type: 'segment', segment })
        } else {
          this.partialText = content
          const segment: TranscriptSegment = {
            speakerId: null,
            speakerName: null,
            content,
            startTime: 0,
            endTime: 0,
            confidence: 0,
            isFinal: false,
          }

          this.emitEvent({ type: 'partial', segment })
        }
      }

      if (message.message_type === 'SessionTerminated') {
        logger.info({ transcriptId: this.transcriptId }, 'AssemblyAI session terminated')
      }
    } catch (error) {
      logger.error({ err: error, transcriptId: this.transcriptId }, 'Failed to parse AssemblyAI message')
    }
  }

  private handleError = (error: Error): void => {
    logger.error({ err: error, transcriptId: this.transcriptId }, 'AssemblyAI WebSocket error')
    this.emitError(error.message ?? 'AssemblyAI WebSocket error')

    if (!this.destroyRequested && this.streamActive) {
      this.scheduleReconnect()
    }
  }

  private handleClose = (code: number, reason: Buffer): void => {
    const reasonStr = reason?.toString() ?? 'unknown'
    logger.info(
      { transcriptId: this.transcriptId, code, reason: reasonStr },
      'AssemblyAI connection closed'
    )

    if (!this.destroyRequested && this.streamActive) {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error(
        { transcriptId: this.transcriptId, attempts: this.reconnectAttempts },
        'Max AssemblyAI reconnect attempts reached'
      )
      this.emitError('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1)
    const jitter = Math.random() * 200

    logger.info(
      { transcriptId: this.transcriptId, attempt: this.reconnectAttempts, delay: delay + jitter },
      'Scheduling AssemblyAI reconnection'
    )

    setTimeout(async () => {
      if (this.destroyRequested || !this.streamActive) return

      try {
        this.cleanupConnection()
        await this.createConnection(this.currentOptions!)
      } catch (error) {
        logger.error(
          { err: error, transcriptId: this.transcriptId, attempt: this.reconnectAttempts },
          'AssemblyAI reconnection failed'
        )
      }
    }, delay + jitter)
  }

  private cleanupConnection(): void {
    if (!this.ws) return

    try {
      this.ws.removeListener('open', this.handleOpen)
      this.ws.removeListener('message', this.handleMessage)
      this.ws.removeListener('error', this.handleError)
      this.ws.removeListener('close', this.handleClose)

      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close()
      }
    } catch {
      // ignore cleanup errors
    }

    this.ws = null
  }

  private emitEvent(partial: Pick<TranscriptionEvent, 'type' | 'segment'>): void {
    const event: TranscriptionEvent = {
      type: partial.type,
      transcriptId: this.transcriptId,
      segment: partial.segment,
    }
    this.events.emit('transcription', event)
  }

  private emitError(message: string): void {
    const event: TranscriptionEvent = {
      type: 'error',
      transcriptId: this.transcriptId,
      error: message,
    }
    this.events.emit('transcription', event)
  }
}
