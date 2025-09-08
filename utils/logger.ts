/**
 * Production-safe logger utility
 * Only logs in development mode, strips all logs from production
 */

type LogLevel = 'log' | 'warn' | 'error' | 'info';

class Logger {
  private isDev = __DEV__;

  log(...args: any[]) {
    if (this.isDev) {
      console.log(...args);
    }
  }

  warn(...args: any[]) {
    if (this.isDev) {
      console.warn(...args);
    }
  }

  error(...args: any[]) {
    if (this.isDev) {
      console.error(...args);
    }
  }

  info(...args: any[]) {
    if (this.isDev) {
      console.info(...args);
    }
  }

  // Performance logging with timing
  time(label: string) {
    if (this.isDev) {
      console.time(label);
    }
  }

  timeEnd(label: string) {
    if (this.isDev) {
      console.timeEnd(label);
    }
  }

  // Grouped logging for better organization
  group(label: string) {
    if (this.isDev) {
      console.group(label);
    }
  }

  groupEnd() {
    if (this.isDev) {
      console.groupEnd();
    }
  }
}

export const logger = new Logger();

// Legacy console replacement - gradually migrate to logger
export const devLog = (...args: any[]) => {
  if (__DEV__) {
    console.log(...args);
  }
};

export const devWarn = (...args: any[]) => {
  if (__DEV__) {
    console.warn(...args);
  }
};

export const devError = (...args: any[]) => {
  if (__DEV__) {
    console.error(...args);
  }
};