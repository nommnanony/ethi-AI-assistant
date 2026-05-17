export { DeepgramProvider } from './deepgram.provider'
export { AssemblyAIProvider } from './assemblyai.provider'
export { WhisperProvider } from './whisper.provider'
export type {
  TranscriptSegment,
  TranscriptionEventType,
  TranscriptionEvent,
  TranscriptionOptions,
  TranscriptionConfig,
  TranscriptionProvider,
} from './types'
export {
  createTranscriptionProvider,
  registerProvider,
  getAvailableProviders,
  createTranscriptionEventHandler,
} from './provider.factory'
export type { ProviderType } from './provider.factory'
