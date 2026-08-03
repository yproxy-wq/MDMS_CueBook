import { describe, it, expect, beforeEach, vi } from 'vitest';

// 1. Mock localStorage first before importing errorLogger to guarantee complete initialization
const store: Record<string, string> = {};
if (typeof window === 'undefined') {
  global.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    length: 0,
    key: () => null
  };
}

// 2. Import services after localStorage mocking is guaranteed
import { errorLogger } from './ErrorLogger';
import { maskSensitiveData } from './NetworkMonitor';

describe('NetworkMonitor - maskSensitiveData', () => {
  it('should mask emails safely', () => {
    const raw = 'Please contact yproxy@gmail.com for help.';
    const masked = maskSensitiveData(raw);
    expect(masked).toBe('Please contact [EMAIL_MASKED] for help.');
  });

  it('should mask Firestore document paths securely', () => {
    const path = 'Fetching document at timerSessions/abc123XYZ_user/sessions/session999_sub...';
    const masked = maskSensitiveData(path);
    expect(masked).toContain('timerSessions/usr_***_masked/sessions/sess_***_masked');
  });

  it('should mask UUIDs completely', () => {
    const msg = 'Failed transaction with correlation id 123e4567-e89b-12d3-a456-426614174000.';
    const masked = maskSensitiveData(msg);
    expect(masked).toBe('Failed transaction with correlation id [UUID_MASKED].');
  });

  it('should mask Firestore token IDs securely while keeping ordinary words untouched', () => {
    const raw = 'Loaded token rR789GhjkL0123456789 from context.';
    const masked = maskSensitiveData(raw);
    expect(masked).toContain('[FIRESTORE_ID_MASKED]');
  });

  it('should mask absolute non-whitelisted URLs and secure other links', () => {
    const secretUrl = 'Connecting to https://some-sensitive-server.net/secrets?key=xyz';
    const firestoreUrl = 'Calling https://firestore.googleapis.com/v1/projects/my-proj...';
    
    expect(maskSensitiveData(secretUrl)).toBe('Connecting to https://[MASKED_HOST]/[MASKED_PATH]');
    expect(maskSensitiveData(firestoreUrl)).toBe('Calling https://firestore.googleapis.com/[MASKED_FIRESTORE_SUBPATH]');
  });

  it('should mask structured JSON values easily', () => {
    const jsonStr = '{"scenarioTitle": "My Secret Murder Mystery Scenario", "userId": "12345"}';
    const masked = maskSensitiveData(jsonStr);
    expect(masked).toContain('"scenarioTitle": "[MASKED_VALUE]"');
    expect(masked).toContain('"userId": "[MASKED_VALUE]"');
  });
});

describe('ErrorLogger Service', () => {
  beforeEach(() => {
    errorLogger.clearErrors();
  });

  it('should log an error and append it to local tracking state', () => {
    const err = new Error('Database connection timed out');
    const logged = errorLogger.logError(err, 'DatabaseModule');

    expect(logged.errorMessage).toBe('Database connection timed out');
    expect(logged.context).toBe('DatabaseModule');
    expect(logged.count).toBe(1);
    expect(logged.resolved).toBe(false);

    const errors = errorLogger.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].id).toBe(logged.id);
  });

  it('should de-duplicate identical recurring errors and increment their counts', () => {
    const err1 = new Error('Disk quota exceeded');
    const err2 = new Error('Disk quota exceeded');

    const first = errorLogger.logError(err1, 'IOStorage');
    const second = errorLogger.logError(err2, 'IOStorage');

    expect(first.id).toBe(second.id);
    expect(second.count).toBe(2);

    const errors = errorLogger.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].count).toBe(2);
  });

  it('should support marking an error as resolved', () => {
    const err = new Error('Out of bounds error');
    const logged = errorLogger.logError(err, 'ArrayUtils');

    errorLogger.resolveError(logged.id);

    const errors = errorLogger.getErrors();
    expect(errors[0].resolved).toBe(true);
  });

  it('should notify subscribers when errors list changes', () => {
    const callback = vi.fn();
    const unsubscribe = errorLogger.subscribe(callback);

    // Initial emit on subscription
    expect(callback).toHaveBeenCalledTimes(1);

    errorLogger.logError(new Error('Syntax error'), 'Parser');
    expect(callback).toHaveBeenCalledTimes(2);

    unsubscribe();
    errorLogger.logError(new Error('Another syntax error'), 'Parser');
    expect(callback).toHaveBeenCalledTimes(2); // Should not emit after unsubscribe
  });
});
