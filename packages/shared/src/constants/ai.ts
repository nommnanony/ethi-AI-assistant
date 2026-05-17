export const AI_PROVIDERS = {
  OPENAI: { name: 'OpenAI', models: ['GPT_4O', 'GPT_4_TURBO', 'GPT_3_5_TURBO'] },
  ANTHROPIC: { name: 'Anthropic', models: ['CLAUDE_3_OPUS', 'CLAUDE_3_SONNET', 'CLAUDE_3_HAIKU'] },
  GEMINI: { name: 'Google Gemini', models: ['GEMINI_PRO', 'GEMINI_ULTRA'] },
  GROQ: { name: 'Groq', models: ['GROQ_LLAMA3', 'GROQ_MIXTRAL'] },
  OPENROUTER: { name: 'OpenRouter', models: ['OPENROUTER_AUTO'] },
  OLLAMA: { name: 'Ollama', models: ['OLLAMA_CUSTOM'] },
  CUSTOM: { name: 'Custom', models: [] },
} as const;

export const AI_PROVIDER_LIST = Object.entries(AI_PROVIDERS).map(([id, config]) => ({
  id,
  ...config,
}));

export const DEFAULT_SYSTEM_PROMPT = 'You are a helpful AI assistant integrated into a desktop productivity app. You help with transcription, meeting summaries, coding assistance, and general productivity tasks. Be concise, accurate, and professional.';

export const MEETING_SUMMARY_PROMPT = `Please provide a comprehensive summary of this meeting transcript including:
1. Key topics discussed
2. Decisions made
3. Action items and owners
4. Open questions
5. Next steps

Format the response in a clean, structured manner.`;
