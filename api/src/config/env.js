import 'dotenv/config';

const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/heimdall',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),

  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    apiBase: process.env.GEMINI_API_BASE ?? 'https://generativelanguage.googleapis.com',
    model: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    tokenLimit: Math.max(1000, Number(process.env.GEMINI_TOKEN_LIMIT ?? 120000)),
    maxOutputTokens: Math.max(128, Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 1024)),
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
