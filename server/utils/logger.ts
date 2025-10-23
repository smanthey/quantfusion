import pino from 'pino';

// Sensitive keys that should be redacted in logs
const SENSITIVE_KEYS = [
  'apiKey',
  'apiSecret',
  'api_key',
  'api_secret',
  'password',
  'secret',
  'token',
  'authorization',
  'BINANCE_API_KEY',
  'BINANCE_SECRET_KEY',
  'ALPACA_API_KEY',
  'ALPACA_SECRET_KEY',
  'SESSION_SECRET',
];

// Redact sensitive information from objects
function redactSensitive(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    // Check if string looks like an API key and mask it
    if (obj.length > 20 && /^[A-Za-z0-9+/=]+$/.test(obj)) {
      return maskString(obj);
    }
    return obj;
  }
  
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitive(item));
  }
  
  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_KEYS.some(sk => lowerKey.includes(sk.toLowerCase()));
    
    if (isSensitive && typeof value === 'string') {
      redacted[key] = maskString(value);
    } else if (typeof value === 'object') {
      redacted[key] = redactSensitive(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

// Mask string to show only first and last 4 characters
function maskString(str: string): string {
  if (str.length <= 8) return '***';
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

// Create logger instance
const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname',
    }
  } : undefined,
  serializers: {
    // Redact sensitive data from error objects
    err: pino.stdSerializers.err,
    // Redact sensitive data from request objects
    req: (req: any) => {
      const redacted = pino.stdSerializers.req(req);
      if (redacted.headers) {
        redacted.headers = redactSensitive(redacted.headers);
      }
      return redacted;
    },
    // Redact sensitive data from response objects
    res: pino.stdSerializers.res,
  },
  // Redact function for all logged objects
  redact: {
    paths: SENSITIVE_KEYS.map(key => `*.${key}`),
    censor: '[REDACTED]'
  }
});

// Helper function to log with automatic redaction
export function safeLog(level: 'info' | 'warn' | 'error' | 'debug', message: string, data?: any) {
  const redactedData = data ? redactSensitive(data) : undefined;
  
  if (redactedData) {
    logger[level]({ data: redactedData }, message);
  } else {
    logger[level](message);
  }
}

// Export convenience methods
export const log = {
  info: (message: string, data?: any) => safeLog('info', message, data),
  warn: (message: string, data?: any) => safeLog('warn', message, data),
  error: (message: string, data?: any) => safeLog('error', message, data),
  debug: (message: string, data?: any) => safeLog('debug', message, data),
};

// Export for compatibility with existing code
export default logger;
