import { EventEmitter } from 'events'
import { spawn } from 'child_process'
import { createRequire } from 'module'
import { logger } from '../../common/logger'
import type {
  TranscriptionProvider,
  TranscriptionOptions,
  TranscriptionEvent,
  TranscriptSegment,
} from './types'

const WHISPER_DEFAULT_MODEL = 'base'
const WHISPER_DEFAULT_LANGUAGE = 'en'
const CHUNK_DURATION_MS = 30_000
const BYTES_PER_SAMPLE = 2
const SAMPLE_RATE = 16000
const CHANNELS = 1

const require = createRequire(import.meta.url)

interface WhisperWord {
  word: string
  start: number
  end: number
  probability: number
}

interface WhisperSegment {
  id: number
  start: number
  end: number
  text: string
  words: WhisperWord[]
  avg_logprob: number
  no_speech_prob: number
  speaker?: string | null
}

interface WhisperResult {
  text: string
  segments: WhisperSegment[]
  language: string
}

export class WhisperProvider implements TranscriptionProvider {
  private events: EventEmitter
  private transcriptId: string
  private segments: TranscriptSegment[] = []
  private partialText: string = ''
  private audioBuffer: Buffer[] = []
  private streamActive: boolean = false
  private currentOptions: TranscriptionOptions | null = null
  private chunkTimer: NodeJS.Timeout | null = null
  private runningChunk: Promise<void> | null = null
  private nextChunkId: number = 0
  private cumulativeOffset: number = 0

  constructor(transcriptId: string) {
    this.transcriptId = transcriptId
    this.events = new EventEmitter()
    this.events.setMaxListeners(50)
  }

  async startStream(options: TranscriptionOptions): Promise<void> {
    this.currentOptions = options
    this.streamActive = true
    this.audioBuffer = []
    this.segments = []
    this.partialText = ''
    this.cumulativeOffset = 0
    this.nextChunkId = 0

    this.startChunkTimer()

    logger.info({ transcriptId: this.transcriptId }, 'Whisper stream started')
  }

  async processAudioChunk(chunk: Buffer): Promise<void> {
    if (!this.streamActive) return

    this.audioBuffer.push(chunk)
  }

  async stopStream(): Promise<TranscriptionEvent> {
    this.streamActive = false
    this.clearChunkTimer()

    if (this.runningChunk) {
      try {
        await this.runningChunk
      } catch {
        // ignore
      }
    }

    try {
      await this.processBuffer(true)
    } catch (error) {
      logger.error({ err: error, transcriptId: this.transcriptId }, 'Error processing final Whisper buffer')
    }

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
    this.streamActive = false
    this.clearChunkTimer()

    if (this.runningChunk) {
      try {
        await this.runningChunk
      } catch {
        // ignore
      }
    }

    this.events.removeAllListeners()
    this.segments = []
    this.partialText = ''
    this.audioBuffer = []
    this.currentOptions = null
  }

  private startChunkTimer(): void {
    this.chunkTimer = setInterval(() => {
      this.processBuffer(false).catch((err) => {
        logger.error({ err, transcriptId: this.transcriptId }, 'Error in Whisper chunk processing')
      })
    }, CHUNK_DURATION_MS)
  }

  private clearChunkTimer(): void {
    if (this.chunkTimer) {
      clearInterval(this.chunkTimer)
      this.chunkTimer = null
    }
  }

  private async processBuffer(isFinal: boolean): Promise<void> {
    if (this.audioBuffer.length === 0) return

    const combined = Buffer.concat(this.audioBuffer)

    if (!isFinal && this.shouldSkipBuffer(combined)) return

    this.audioBuffer = []

    try {
      const result = await this.transcribeBuffer(combined)
      this.handleTranscriptionResult(result, isFinal)
    } catch (error) {
      logger.error({ err: error, transcriptId: this.transcriptId }, 'Whisper transcription failed')
      this.emitError('Whisper transcription error')
    }
  }

  private shouldSkipBuffer(buffer: Buffer): boolean {
    if (buffer.length < BYTES_PER_SAMPLE * SAMPLE_RATE * 0.5) return true

    let energy = 0
    let samples = 0

    for (let i = 0; i < buffer.length - 1; i += BYTES_PER_SAMPLE) {
      const sample = buffer.readInt16LE(i)
      energy += Math.abs(sample)
      samples++
    }

    const avgEnergy = energy / samples
    return avgEnergy < 50
  }

  private async transcribeBuffer(audioBuffer: Buffer): Promise<WhisperResult> {
    const model = this.currentOptions?.model ?? WHISPER_DEFAULT_MODEL
    const language = this.currentOptions?.language ?? WHISPER_DEFAULT_LANGUAGE

    try {
      const modelPath = this.resolveModelPath(model)
      const tempFile = this.writeTempFile(audioBuffer)

      try {
        return await this.runWhisperProcess(modelPath, tempFile, language)
      } finally {
        this.cleanupTempFile(tempFile)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger.warn({ err: error, transcriptId: this.transcriptId }, 'Local whisper failed, trying offline fallback')

      return this.fallbackTranscribe(audioBuffer, language)
    }
  }

  private async runWhisperProcess(
    modelPath: string,
    inputFile: string,
    language: string
  ): Promise<WhisperResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn('whisper', [
        '--model', modelPath,
        '--language', language,
        '--output-json',
        '--fp16', 'False',
        '--file', inputFile,
      ])

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const result: WhisperResult = JSON.parse(stdout)
            resolve(result)
          } catch {
            reject(new Error('Failed to parse whisper output'))
          }
        } else {
          reject(new Error(`Whisper process exited with code ${code}: ${stderr}`))
        }
      })

      proc.on('error', reject)

      const timeout = setTimeout(() => {
        proc.kill()
        reject(new Error('Whisper process timed out'))
      }, 60_000)

      proc.on('close', () => clearTimeout(timeout))
    })
  }

  private async fallbackTranscribe(
    audioBuffer: Buffer,
    language: string
  ): Promise<WhisperResult> {
    const openai = require('openai')
    const client = new openai.OpenAI()

    const blob = new Blob([audioBuffer], { type: 'audio/wav' })
    const file = new File([blob], `audio-${this.transcriptId}.wav`, { type: 'audio/wav' })

    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language,
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    })

    return {
      text: transcription.text,
      language: transcription.language ?? language,
      segments: (transcription.segments ?? []).map((seg: any, idx: number) => ({
        id: idx,
        start: seg.start ?? 0,
        end: seg.end ?? 0,
        text: seg.text ?? '',
        words: (seg.words ?? []).map((w: any) => ({
          word: w.word ?? '',
          start: w.start ?? 0,
          end: w.end ?? 0,
          probability: w.probability ?? 0,
        })),
        avg_logprob: 0,
        no_speech_prob: 0,
        speaker: null,
      })),
    }
  }

  private handleTranscriptionResult(result: WhisperResult, isFinal: boolean): void {
    for (const seg of result.segments) {
      const startTime = this.cumulativeOffset + seg.start
      const endTime = this.cumulativeOffset + seg.end
      const content = seg.text.trim()

      if (!content) continue

      if (isFinal) {
        const segment: TranscriptSegment = {
          speakerId: seg.speaker ?? null,
          speakerName: seg.speaker ? `Speaker ${seg.speaker}` : null,
          content,
          startTime,
          endTime,
          confidence: Math.exp(seg.avg_logprob),
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
          startTime,
          endTime,
          confidence: 0,
          isFinal: false,
        }

        this.emitEvent({ type: 'partial', segment })
      }
    }

    if (!isFinal) {
      this.cumulativeOffset += result.segments.length > 0
        ? result.segments[result.segments.length - 1].end
        : 0
    }
  }

  private resolveModelPath(model: string): string {
    return model
  }

  private writeTempFile(audioBuffer: Buffer): string {
    const fs = require('fs')
    const path = require('path')
    const os = require('os')

    const header = this.createWavHeader(
      audioBuffer.length,
      this.currentOptions?.sampleRate ?? SAMPLE_RATE,
      this.currentOptions?.channels ?? CHANNELS
    )

    const wavBuffer = Buffer.concat([header, audioBuffer])
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-'))
    const tempFile = path.join(tempDir, `audio-${this.nextChunkId++}.wav`)

    fs.writeFileSync(tempFile, wavBuffer)
    return tempFile
  }

  private createWavHeader(dataLength: number, sampleRate: number, channels: number): Buffer {
    const header = Buffer.alloc(44)
    const byteRate = sampleRate * channels * BYTES_PER_SAMPLE
    const blockAlign = channels * BYTES_PER_SAMPLE
    const dataSize = dataLength
    const fileSize = 36 + dataSize

    header.write('RIFF', 0)
    header.writeUInt32LE(fileSize, 4)
    header.write('WAVE', 8)
    header.write('fmt ', 12)
    header.writeUInt32LE(16, 16)
    header.writeUInt16LE(1, 20)
    header.writeUInt16LE(channels, 22)
    header.writeUInt32LE(sampleRate, 24)
    header.writeUInt32LE(byteRate, 28)
    header.writeUInt16LE(blockAlign, 32)
    header.writeUInt16LE(16, 34)
    header.write('data', 36)
    header.writeUInt32LE(dataSize, 40)

    return header
  }

  private cleanupTempFile(tempFile: string): void {
    try {
      const fs = require('fs')
      const path = require('path')
      fs.rmSync(path.dirname(tempFile), { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
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
