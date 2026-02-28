/**
 * Error Handling and Logging Utilities
 */

import { logger } from './logger'

export enum ErrorType {
  FILE_ERROR = "FILE_ERROR",
  API_ERROR = "API_ERROR",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface ErrorLog {
  id: string;
  timestamp: string;
  type: ErrorType;
  message: string;
  stack?: string;
  context?: Record<string, any>;
}

class ErrorHandler {
  private errorLogs: ErrorLog[] = [];
  private maxLogs: number = 100;

  /**
   * Log an error
   */
  logError(
    type: ErrorType,
    message: string,
    error?: Error,
    context?: Record<string, any>
  ): ErrorLog {
    const errorLog: ErrorLog = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type,
      message,
      stack: error?.stack,
      context,
    };

    this.errorLogs.push(errorLog);

    // Keep only recent logs
    if (this.errorLogs.length > this.maxLogs) {
      this.errorLogs = this.errorLogs.slice(-this.maxLogs);
    }

    logger.error(type, message, error || "");

    return errorLog;
  }

  /**
   * Handle file errors
   */
  handleFileError(message: string, error?: Error): ErrorLog {
    return this.logError(ErrorType.FILE_ERROR, message, error);
  }

  /**
   * Handle API errors
   */
  handleAPIError(message: string, error?: Error, context?: Record<string, any>): ErrorLog {
    return this.logError(ErrorType.API_ERROR, message, error, context);
  }

  /**
   * Handle validation errors
   */
  handleValidationError(message: string, context?: Record<string, any>): ErrorLog {
    return this.logError(ErrorType.VALIDATION_ERROR, message, undefined, context);
  }

  /**
   * Handle network errors
   */
  handleNetworkError(message: string, error?: Error): ErrorLog {
    return this.logError(ErrorType.NETWORK_ERROR, message, error);
  }

  /**
   * Get recent errors
   */
  getRecentErrors(count: number = 10): ErrorLog[] {
    return this.errorLogs.slice(-count);
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type: ErrorType): ErrorLog[] {
    return this.errorLogs.filter((log) => log.type === type);
  }

  /**
   * Clear all error logs
   */
  clearLogs(): void {
    this.errorLogs = [];
  }

  /**
   * Export error logs for debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.errorLogs, null, 2);
  }

  private generateId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const errorHandler = new ErrorHandler();

/**
 * Safe async wrapper
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  errorHandler: (error: Error) => void = () => {},
  errorType: ErrorType = ErrorType.UNKNOWN_ERROR
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    import("./error").then((module) => {
      module.errorHandler.logError(errorType, err.message, err);
    });
    errorHandler(err);
    return null;
  }
}

/**
 * Safe sync wrapper
 */
export function safeSync<T>(
  fn: () => T,
  errorHandler: (error: Error) => void = () => {},
  errorType: ErrorType = ErrorType.UNKNOWN_ERROR
): T | null {
  try {
    return fn();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    import("./error").then((module) => {
      module.errorHandler.logError(errorType, err.message, err);
    });
    errorHandler(err);
    return null;
  }
}
