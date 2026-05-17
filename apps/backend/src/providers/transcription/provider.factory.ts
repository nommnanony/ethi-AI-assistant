import { logger } from '../../common/logger'
import { DeepgramProvider } from './deepgram.provider'
import { AssemblyAIProvider } from './assemblyai.provider'
import { WhisperProvider } from './whisper.provider'
import type {
  TranscriptionProvider,
  TranscriptionConfig,
  TranscriptionEvent,
} from './types'

export type ProviderType = 'deepgram' | 'assemblyai' | 'whisper'

type ProviderConstructor = new (apiKey: string, transcriptId: string) => TranscriptionProvider

const providerRegistry: Record<ProviderType, ProviderConstructor> = {
  deepgram: DeepgramProvider,
  assemblyai: AssemblyAIProvider,
  whisper: WhisperProvider,
}

export function createTranscriptionProvider(config: TranscriptionConfig): TranscriptionProvider {
  const { provider, apiKey = '', options } = config
  const transcriptId = crypto.randomUUID()

  const Constructor = providerRegistry[provider]

  if (!Constructor) {
    const validProviders = Object.keys(providerRegistry).join(', ')
    throw new Error(
      `Unknown transcription provider: "${provider}". Valid providers: ${validProviders}`
    )
  }

  const instance = new Constructor(apiKey, transcriptId)

  logger.info(
    { provider, transcriptId, model: options?.model },
    'Transcription provider created'
  )

  return instance
}

export function registerProvider(
  type: ProviderType,
  constructor: ProviderConstructor
): void {
  if (providerRegistry[type]) {
    logger.warn({ provider: type }, 'Overwriting existing transcription provider registration')
  }

  providerRegistry[type] = constructor
  logger.info({ provider: type }, 'Transcription provider registered')
}

export function getAvailableProviders(): ProviderType[] {
  return Object.keys(providerRegistry) as ProviderType[]
}

export function createTranscriptionEventHandler(
  provider: TranscriptionProvider,
  handlers: {
    onSegment?: (event: TranscriptionEvent) => void
    onPartial?: (event: TranscriptionEvent) => void
    onError?: (event: TranscriptionEvent) => void
    onDone?: (event: TranscriptionEvent) => void
  }
): void {
  const emitter = provider.getEvents()

  emitter.on('transcription', (event: TranscriptionEvent) => {
    switch (event.type) {
      case 'segment':
        handlers.onSegment?.(event)
        break
      case 'partial':
        handlers.onPartial?.(event)
        break
      case 'error':
        handlers.onError?.(event)
        break
      case 'done':
        handlers.onDone?.(event)
        break
    }
  })
}
