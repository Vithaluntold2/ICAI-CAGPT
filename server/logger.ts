/**
 * Simple logger utility for consistent logging across the application
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_COLORS = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  reset: '\x1b[0m',
};

function formatMessage(level: LogLevel, message: string, context?: string): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? `[${context}]` : '';
  return `${LOG_COLORS[level]}[${timestamp}] [${level.toUpperCase()}]${contextStr} ${message}${LOG_COLORS.reset}`;
}

export const logger = {
  debug: (message: string, context?: string) => {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(formatMessage('debug', message, context));
    }
  },
  
  info: (message: string, context?: string) => {
    console.log(formatMessage('info', message, context));
  },
  
  warn: (message: string, context?: string) => {
    console.warn(formatMessage('warn', message, context));
  },
  
  error: (message: string, error?: Error | unknown, context?: string) => {
    console.error(formatMessage('error', message, context));
    if (error) {
      if (error instanceof Error) {
        console.error(error.stack || error.message);
      } else {
        console.error(error);
      }
    }
  },
  
  // Create a child logger with a fixed context
  child: (context: string) => ({
    debug: (message: string) => logger.debug(message, context),
    info: (message: string) => logger.info(message, context),
    warn: (message: string) => logger.warn(message, context),
    error: (message: string, error?: Error | unknown) => logger.error(message, error, context),
  }),
};

export default logger;
