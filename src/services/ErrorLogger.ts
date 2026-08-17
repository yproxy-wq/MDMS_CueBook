import { maskSensitiveData, networkMonitor } from './NetworkMonitor';

export interface LoggedError {
  id: string;
  timestamp: string;
  errorMessage: string;
  errorStack?: string;
  context: string;
  count: number;
  lastOccurrence: string;
  resolved: boolean;
  code?: string;
  operation?: string;
  recoverable?: boolean;
  retryCount?: number;
  scenarioId?: string;
}

export interface OperationErrorDetails {
  code: string;
  operation: string;
  recoverable: boolean;
  retryCount?: number;
  scenarioId?: string;
}

const STORAGE_KEY = 'cuebook_error_diagnostics_v1';
const MAX_PERSISTED_ERRORS = 50;

/** Safely restores only the diagnostic records the current version understands. */
export function normalizeLoggedErrors(value: unknown): LoggedError[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry): LoggedError[] => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Partial<LoggedError>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.timestamp !== 'string' ||
      typeof candidate.errorMessage !== 'string' ||
      typeof candidate.context !== 'string' ||
      typeof candidate.lastOccurrence !== 'string'
    ) {
      return [];
    }

    return [{
      id: candidate.id,
      timestamp: candidate.timestamp,
      errorMessage: candidate.errorMessage,
      ...(typeof candidate.errorStack === 'string' ? { errorStack: candidate.errorStack } : {}),
      context: candidate.context,
      count: typeof candidate.count === 'number' && Number.isFinite(candidate.count)
        ? Math.max(1, Math.floor(candidate.count))
        : 1,
      lastOccurrence: candidate.lastOccurrence,
      resolved: typeof candidate.resolved === 'boolean' ? candidate.resolved : false,
      ...(typeof candidate.code === 'string' ? { code: candidate.code } : {}),
      ...(typeof candidate.operation === 'string' ? { operation: candidate.operation } : {}),
      ...(typeof candidate.recoverable === 'boolean' ? { recoverable: candidate.recoverable } : {}),
      ...(typeof candidate.retryCount === 'number' && Number.isFinite(candidate.retryCount)
        ? { retryCount: Math.max(0, Math.floor(candidate.retryCount)) }
        : {}),
      ...(typeof candidate.scenarioId === 'string' ? { scenarioId: candidate.scenarioId } : {}),
    }];
  }).slice(0, MAX_PERSISTED_ERRORS);
}

class ErrorLoggerService {
  private errors: LoggedError[] = [];
  private listeners = new Set<(errors: LoggedError[]) => void>();

  constructor() {
    this.loadFromStorage();
    this.initializeGlobalHandlers();
  }

  private loadFromStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.errors = normalizeLoggedErrors(parsed);
        // Repair malformed, legacy, or oversized records immediately so a
        // later error cannot be blocked by corrupt persisted diagnostics.
        if (JSON.stringify(parsed) !== JSON.stringify(this.errors)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.errors));
        }
      }
    } catch (e) {
      console.error('[ErrorLogger] Failed to load persisted logs from localStorage:', e);
      this.errors = [];
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Diagnostics must never fail the application while attempting recovery.
      }
    }
  }

  private saveToStorage() {
    try {
      if (typeof localStorage === 'undefined') return;
      // Keep only up to MAX_PERSISTED_ERRORS
      if (this.errors.length > MAX_PERSISTED_ERRORS) {
        this.errors = this.errors.slice(0, MAX_PERSISTED_ERRORS);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.errors));
    } catch (e) {
      console.error('[ErrorLogger] Failed to write logs to localStorage:', e);
    }
  }

  private initializeGlobalHandlers() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      // Avoid circular logging of our own diagnostics or harmless iframe websocket notifications
      if (event.message?.includes('vite') || event.filename?.includes('vite')) return;
      
      // Filter out empty messages, or generic browser cross-origin "Script error."
      // Since "Script error." contains 0 actionable information, modern loggers ignore it to prevent clutter.
      if (!event.message || event.message === 'Script error.' || event.message.includes('Script error')) {
        console.warn('[ErrorLogger] Ignored cross-origin or extension "Script error." message.');
        return;
      }
      
      this.logError(
        event.error || new Error(event.message || 'Global runtime error'),
        `window_error_handler::${event.filename || 'unknown_file'}:${event.lineno || 0}`
      );
    });

    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      
      this.logError(
        reason instanceof Error ? reason : new Error(message || 'Unhandled Promise rejection'),
        'unhandled_promise_rejection',
        stack
      );
    });
  }

  /**
   * Main error recording entry. Automatically scrubs secrets and de-duplicates identical errors.
   */
  public logError(error: unknown, context: string, overrideStack?: string, details?: OperationErrorDetails): LoggedError {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const rawStack = overrideStack || (error instanceof Error ? error.stack : undefined);

    const errorMessage = maskSensitiveData(rawMessage);
    const errorStack = rawStack ? maskSensitiveData(rawStack) : undefined;
    const cleanContext = maskSensitiveData(context);
    const safeDetails = details ? {
      code: details.code,
      operation: details.operation,
      recoverable: details.recoverable,
      ...(typeof details.retryCount === 'number' ? { retryCount: Math.max(0, Math.floor(details.retryCount)) } : {}),
      ...(details.scenarioId ? { scenarioId: maskSensitiveData(details.scenarioId) } : {}),
    } : {};

    // Compute simple signature for de-duplication
    // We group by the cleaned message and the context to know if it's recurring
    const signature = `${cleanContext}::${errorMessage}`;

    // Look for existing error with this signature
    const existingIndex = this.errors.findIndex(
      (err) => `${err.context}::${err.errorMessage}` === signature && !err.resolved
    );

    const now = new Date().toISOString();
    let updatedError: LoggedError;

    if (existingIndex !== -1) {
      // Increment count and update timestamp of the existing error
      const existing = this.errors[existingIndex];
      updatedError = {
        ...existing,
        count: existing.count + 1,
        lastOccurrence: now,
        // Keep the stack updated if it was previously undefined
        errorStack: existing.errorStack || errorStack,
        ...safeDetails,
      };
      // Move to top of list as the most recent activity
      this.errors.splice(existingIndex, 1);
      this.errors.unshift(updatedError);
    } else {
      // Create new error entry
      updatedError = {
        id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timestamp: now,
        errorMessage,
        errorStack,
        context: cleanContext,
        count: 1,
        lastOccurrence: now,
        resolved: false,
        ...safeDetails,
      };
      this.errors.unshift(updatedError);
    }

    this.saveToStorage();
    this.notify();

    // Also push into NetworkMonitor's event logs so diagnostics download will include it
    networkMonitor.recordGeneralError('RUNTIME_CRASH_ERR', errorMessage, cleanContext);

    return updatedError;
  }

  public logOperationError(error: unknown, details: OperationErrorDetails, overrideStack?: string): LoggedError {
    return this.logError(error, details.operation, overrideStack, details);
  }

  public getErrors(): LoggedError[] {
    return [...this.errors];
  }

  public clearErrors() {
    this.errors = [];
    this.saveToStorage();
    this.notify();
  }

  public resolveError(id: string) {
    const index = this.errors.findIndex((e) => e.id === id);
    if (index !== -1) {
      this.errors[index] = { ...this.errors[index], resolved: true };
      this.saveToStorage();
      this.notify();
    }
  }

  public subscribe(listener: (errors: LoggedError[]) => void) {
    this.listeners.add(listener);
    // Emit initial
    listener([...this.errors]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const current = [...this.errors];
    this.listeners.forEach((l) => l(current));
  }
}

export const errorLogger = new ErrorLoggerService();
