import 'dotenv/config';

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/heimdall',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),

  ai: {
    // 'auto' tries gemini → openai-compat → devin; set to force a single provider
    provider: process.env.AI_PROVIDER ?? 'auto',
    interpretMaxTokens: Math.max(128, Number(process.env.AI_INTERPRET_MAX_TOKENS ?? 320)),
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    apiBase: process.env.GEMINI_API_BASE ?? 'https://generativelanguage.googleapis.com',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    tokenLimit: Math.max(1000, Number(process.env.GEMINI_TOKEN_LIMIT ?? 60000)),
    maxOutputTokens: Math.max(128, Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 512)),
  },

  // Any OpenAI-compatible endpoint: Groq, OpenRouter, Cerebras, Ollama, LM Studio…
  openaiCompat: {
    apiKey: process.env.OPENAI_COMPAT_API_KEY ?? '',
    apiBase: process.env.OPENAI_COMPAT_API_BASE ?? 'https://api.groq.com/openai/v1',
    model: process.env.OPENAI_COMPAT_MODEL ?? 'openai/gpt-oss-120b',
    tokenLimit: Math.max(1000, Number(process.env.OPENAI_COMPAT_TOKEN_LIMIT ?? 60000)),
    maxOutputTokens: Math.max(128, Number(process.env.OPENAI_COMPAT_MAX_OUTPUT_TOKENS ?? 512)),
    // Reasoning models (gpt-oss, qwen3) burn output tokens on hidden thinking —
    // 'low' keeps answers inside tight caps. '' disables the parameter.
    reasoningEffort: process.env.OPENAI_COMPAT_REASONING_EFFORT ?? 'low',
  },

  devin: {
    apiKey: process.env.DEVIN_API_KEY ?? '',
    apiBase: process.env.DEVIN_API_BASE ?? 'https://api.devin.ai',
    model: process.env.DEVIN_MODEL ?? 'swe-2-medium',
  },

  analytics: {
    baseUrl: process.env.ANALYTICS_API_URL ?? 'http://localhost:8000',
  },
};

export default env;
