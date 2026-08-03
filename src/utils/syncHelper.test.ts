import { describe, it, expect } from 'vitest';
import { createHandoutSessionId, createSecureShareId, createTimerSessionId, getHandoutDocumentId, isSecureShareId, parseHandoutId, parseSessionId, isConfigDirty, detectSyncConflicts } from './syncHelper';
import { SyncConfig } from '../types';

describe('syncHelper - isConfigDirty', () => {
  const baseConfig: SyncConfig = {
    timerEnabled: true,
    timerSize: 'medium',
    timerPosition: 'top',
    imageFit: 'cover',
    contentEnabled: true,
    activeImageId: 'image-1',
  };

  it('should return false if configs are identical', () => {
    const draft = { ...baseConfig };
    expect(isConfigDirty(draft, baseConfig)).toBe(false);
  });

  it('should return true if timerEnabled differs', () => {
    const draft = { ...baseConfig, timerEnabled: false };
    expect(isConfigDirty(draft, baseConfig)).toBe(true);
  });

  it('should return true if activeImageId changes from string to null', () => {
    const draft = { ...baseConfig, activeImageId: null };
    expect(isConfigDirty(draft, baseConfig)).toBe(true);
  });

  it('should work with undefined activeImageId matching null', () => {
    const current = { ...baseConfig, activeImageId: undefined } as unknown as SyncConfig;
    const draft = { ...baseConfig, activeImageId: null };
    expect(isConfigDirty(draft, current)).toBe(false);
  });
});

describe('syncHelper - detectSyncConflicts', () => {
  const healthyConfig: SyncConfig = {
    timerEnabled: true,
    timerSize: 'medium',
    timerPosition: 'top',
    imageFit: 'cover',
    contentEnabled: true,
    activeImageId: 'img-789',
  };

  it('should return no conflicts under a healthy structure', () => {
    const result = detectSyncConflicts(healthyConfig, false, true);
    expect(result.length).toBe(0);
  });

  it('should prioritize quota exceptions above other configurations', () => {
    const result = detectSyncConflicts(healthyConfig, true, true);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('quota_exceeded');
  });

  it('should warning if activeImageId is set but content sync is toggled off', () => {
    const misconfigured = { ...healthyConfig, contentEnabled: false };
    const result = detectSyncConflicts(misconfigured, false, true);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('image_hidden_conflict');
  });

  it('should warn if both timer and image sync scopes are configured off', () => {
    const deadConfig: SyncConfig = {
      ...healthyConfig,
      timerEnabled: false,
      contentEnabled: false,
      activeImageId: null,
    };
    const result = detectSyncConflicts(deadConfig, false, false);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe('mirror_empty_conflict');
  });
});

describe('syncHelper - secure share identifiers', () => {
  it('creates 256-bit opaque capability IDs', () => {
    const shareId = createSecureShareId();
    expect(isSecureShareId(shareId)).toBe(true);
    expect(createSecureShareId()).not.toBe(shareId);
  });

  it('round-trips secure timer session IDs without treating legacy IDs as secure', () => {
    const shareId = 'a'.repeat(64);
    expect(parseSessionId(createTimerSessionId('owner-uid', shareId))).toEqual({ userId: 'owner-uid', subSessionId: shareId, isSecure: true });
    expect(parseSessionId('owner-uid_old-scenario').isSecure).toBe(false);
  });

  it('uses an independent opaque document ID for secure handouts', () => {
    const shareId = 'b'.repeat(64);
    const sessionId = createHandoutSessionId('owner-uid', shareId);
    expect(parseHandoutId(sessionId).isSecure).toBe(true);
    expect(getHandoutDocumentId(sessionId)).toBe(shareId);
  });
});
