import { EventEmitter } from 'events'
import { logger } from '../../common/logger'

let createClient: any;
let LiveTranscriptionEvents: any;
try {
  const dg = require('@deepgram/sdk');
  createClient = dg.createClient;
  LiveTranscriptionEvents = dg.LiveTranscriptionEvents;
} catch {
  createClient = () => { throw new Error('Deepgram SDK not available') };
  LiveTranscriptionEvents = {};
}
import type {
  TranscriptionProvider,
  TranscriptionOptions,
  TranscriptionEvent,
  TranscriptSegment,
} from './types'

const DEEPGRAM_DEFAULT_MODEL = 'nova-2'
const DEEPGRAM_DEFAULT_LANGUAGE = 'en'
const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_BASE_DELAY = 1000

export class DeepgramProvider implements TranscriptionProvider {
  private connection: any = null
  private apiKey: string
  private events: EventEmitter
  private transcriptId: string
  private segments: TranscriptSegment[] = []
  private partialText: string = ''
  private streamActive: boolean = false
  private reconnectAttempts: number = 0
  private currentOptions: TranscriptionOptions | null = null
  private destroyRequested: boolean = false

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

    try {
      await this.createConnection(options)
    } catch (error) {
      this.streamActive = false
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.error({ err: error, transcriptId: this.transcriptId }, 'Failed to start Deepgram stream')
      this.emitError(message)
      throw error
    }
  }

  private async createConnection(options: TranscriptionOptions): Promise<void> {
    const client = createClient(this.apiKey)

    this.connection = client.listen.live({
      model: options.model ?? DEEPGRAM_DEFAULT_MODEL,
      language: options.language ?? DEEPGRAM_DEFAULT_LANGUAGE,
      punctuate: options.punctuate ?? true,
      interim_results: options.interimResults ?? true,
      diarize: options.diarize ?? true,
      encoding: options.encoding as 'linear16' | 'mulaw' | undefined ?? 'linear16',
      sample_rate: options.sampleRate ?? 16000,
      channels: options.channels ?? 1,
      smart_format: true,
    })

    this.connection.on(LiveTranscriptionEvents.Transcript, this.handleTranscript)
    this.connection.on(LiveTranscriptionEvents.Metadata, this.handleMetadata)
    this.connection.on(LiveTranscriptionEvents.Error, this.handleConnectionError)
    this.connection.on(LiveTranscriptionEvents.Close, this.handleConnectionClose)

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => {
        this.reconnectAttempts = 0
        logger.info({ transcriptId: this.transcriptId }, 'Deepgram connection established')
        resolve()
      }

      const onError = (err: Error) => {
        reject(err)
      }

      this.connection!.on(LiveTranscriptionEvents.Open, onOpen)
      this.connection!.on(LiveTranscriptionEvents.Error, onError)

      setTimeout(() => {
        reject(new Error('Deepgram connection timed out'))
      }, 10_000)
    })
  }

  async processAudioChunk(chunk: Buffer): Promise<void> {
    if (!this.connection || !this.streamActive) {
      return
    }

    try {
      this.connection.send(chunk)
    } catch (error) {
      logger.error({ err: error, transcriptId: this.transcriptId }, 'Failed to send audio chunk to Deepgram')
      this.emitError('Failed to process audio chunk')
    }
  }

  async stopStream(): Promise<TranscriptionEvent> {
    this.streamActive = false

    if (this.connection) {
      try {
        this.connection.finish()
      } catch {
        // ignore close errors
      }
    }

    return this.buildEvent('done')
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

  private handleTranscript = (data: any): void => {
    if (!data || !data.channel) return

    const alternatives = data.channel.alternatives?.[0]
    if (!alternatives) return

    const isFinal = data.is_final === true
    const content = alternatives.transcript ?? ''
    if (!content) return

    if (isFinal) {
      const words = alternatives.words ?? []
      const startTime = words.length > 0 ? words[0].start : 0
      const endTime = words.length > 0 ? words[words.length - 1].end : 0

      let speakerId: string | null = null
      let speakerName: string | null = null

      if (alternatives.speaker !== undefined && alternatives.speaker !== null) {
        speakerId = String(alternatives.speaker)
      }

      if (data.channel.speaker && data.channel.speaker !== undefined) {
        speakerName = `Speaker ${speakerId ?? 0}`
      }

      const segment: TranscriptSegment = {
        speakerId,
        speakerName,
        content,
        startTime,
        endTime,
        confidence: alternatives.confidence ?? 0,
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

  private handleMetadata = (data: any): void => {
    logger.debug({ metadata: data, transcriptId: this.transcriptId }, 'Deepgram metadata received')
  }

  private handleConnectionError = (error: Error): void => {
    logger.error({ err: error, transcriptId: this.transcriptId }, 'Deepgram connection error')
    this.emitError(error.message ?? 'Deepgram connection error')

    if (!this.destroyRequested && this.streamActive) {
      this.scheduleReconnect()
    }
  }

  private handleConnectionClose = (): void => {
    logger.info({ transcriptId: this.transcriptId }, 'Deepgram connection closed')

    if (!this.destroyRequested && this.streamActive) {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      logger.error(
        { transcriptId: this.transcriptId, attempts: this.reconnectAttempts },
        'Max Deepgram reconnect attempts reached'
      )
      this.emitError('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1)
    const jitter = Math.random() * 200

    logger.info(
      { transcriptId: this.transcriptId, attempt: this.reconnectAttempts, delay: delay + jitter },
      'Scheduling Deepgram reconnection'
    )

    setTimeout(async () => {
      if (this.destroyRequested || !this.streamActive) return

      try {
        this.cleanupConnection()
        await this.createConnection(this.currentOptions!)
      } catch (error) {
        logger.error(
          { err: error, transcriptId: this.transcriptId, attempt: this.reconnectAttempts },
          'Deepgram reconnection failed'
        )
      }
    }, delay + jitter)
  }

  private cleanupConnection(): void {
    if (!this.connection) return

    try {
      this.connection.removeListener(LiveTranscriptionEvents.Transcript, this.handleTranscript)
      this.connection.removeListener(LiveTranscriptionEvents.Metadata, this.handleMetadata)
      this.connection.removeListener(LiveTranscriptionEvents.Error, this.handleConnectionError)
      this.connection.removeListener(LiveTranscriptionEvents.Close, this.handleConnectionClose)
      this.connection.finish()
    } catch {
      // ignore cleanup errors
    }

    this.connection = null
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

  private buildEvent(type: TranscriptionEvent['type']): TranscriptionEvent {
    return {
      type,
      transcriptId: this.transcriptId,
    }
  }
}
