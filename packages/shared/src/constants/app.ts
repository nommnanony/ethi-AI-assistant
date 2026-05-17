export const APP_NAME = 'Natively AI';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Premium AI desktop assistant for transcription, meetings, and productivity';

export const ROUTES = {
  AUTH: {
    REGISTER: '/api/auth/register',
    LOGIN: '/api/auth/login',
    REFRESH: '/api/auth/refresh',
    LOGOUT: '/api/auth/logout',
    SESSIONS: '/api/auth/sessions',
    ME: '/api/auth/me',
  },
  AI: {
    CHAT: '/api/ai/chat',
    STREAM: '/api/ai/chat/stream',
    COMPLETION: '/api/ai/completion',
    PROVIDERS: '/api/ai/providers',
    CONFIG: '/api/ai/config',
  },
  TRANSCRIPTION: {
    START: '/api/transcription/start',
    STOP: '/api/transcription/stop',
    LIST: '/api/transcription',
    DETAILS: '/api/transcription/:id',
  },
  WORKSPACE: {
    LIST: '/api/workspaces',
    CREATE: '/api/workspaces',
    DETAILS: '/api/workspaces/:id',
    MEMBERS: '/api/workspaces/:id/members',
    FOLDERS: '/api/workspaces/:id/folders',
    PROMPTS: '/api/workspaces/:id/prompts',
    CHATS: '/api/workspaces/:id/chats',
  },
  SUBSCRIPTION: {
    CURRENT: '/api/subscriptions/current',
    PORTAL: '/api/subscriptions/portal',
    INVOICES: '/api/subscriptions/invoices',
    COUPON: '/api/subscriptions/coupon',
  },
  PAYMENTS: {
    CHECKOUT: '/api/payments/checkout',
    WEBHOOK: '/api/payments/webhook',
  },
  ANALYTICS: {
    USAGE: '/api/analytics/usage',
    SUMMARY: '/api/analytics/summary',
  },
  USERS: {
    PROFILE: '/api/users/profile',
    SETTINGS: '/api/users/settings',
  },
} as const;

export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
  CONFLICT: 'CONFLICT',
} as const;
