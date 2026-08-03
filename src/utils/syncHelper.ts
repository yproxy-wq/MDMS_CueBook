import { SyncConfig } from '../types';

export interface SyncConflict {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  suggestion: string;
}

const SHARE_ID_PATTERN = /^[a-f0-9]{64}$/;

export interface ParsedSessionId {
  userId: string;
  subSessionId: string;
  isSecure: boolean;
}

export interface ParsedHandoutId extends ParsedSessionId {
  characterId: string;
}

/** Generates a 256-bit opaque capability token. Math.random must never be used for shared URLs. */
export function createSecureShareId(): string {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('ERR_RUNTIME: Secure random generation is unavailable.');
  }
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function isSecureShareId(value: string | null | undefined): value is string {
  return typeof value === 'string' && SHARE_ID_PATTERN.test(value);
}

export function createTimerSessionId(userId: string, shareId: string): string {
  if (!userId || !isSecureShareId(shareId)) throw new Error('ERR_RUNTIME: Invalid timer share session.');
  return `timer~${userId}~${shareId}`;
}

export function createHandoutSessionId(userId: string, shareId: string): string {
  if (!userId || !isSecureShareId(shareId)) throw new Error('ERR_RUNTIME: Invalid handout share session.');
  return `handout~${userId}~${shareId}`;
}

export function isSecureHandoutSessionId(sessionId: string): boolean {
  return parseHandoutId(sessionId).isSecure;
}

/**
 * Compares two SyncConfig objects to verify if there are unsaved (dirty) changes.
 */
export function isConfigDirty(draft: SyncConfig, current: SyncConfig): boolean {
  if (!draft || !current) return false;
  return (
    draft.timerEnabled !== current.timerEnabled ||
    draft.timerSize !== current.timerSize ||
    draft.timerPosition !== current.timerPosition ||
    draft.imageFit !== current.imageFit ||
    draft.contentEnabled !== current.contentEnabled ||
    draft.timerForceHidden !== current.timerForceHidden ||
    (draft.lapDisplayMode || 'overlay') !== (current.lapDisplayMode || 'overlay') ||
    (draft.lapDisplayPosition || 'top') !== (current.lapDisplayPosition || 'top') ||
    (draft.lapNotificationText || '') !== (current.lapNotificationText || '') ||
    String(draft.activeImageId || '') !== String(current.activeImageId || '') ||
    (draft.overlayType || 'none') !== (current.overlayType || 'none') ||
    (draft.overlayIntensity ?? 0.5) !== (current.overlayIntensity ?? 0.5) ||
    (draft.timerColor || 'white') !== (current.timerColor || 'white') ||
    (draft.lapBandSize || 'medium') !== (current.lapBandSize || 'medium') ||
    (draft.lapFontSize || 'medium') !== (current.lapFontSize || 'medium') ||
    (draft.timerLabelText || '') !== (current.timerLabelText || '')
  );
}

/**
 * Dynamically detects operational states that could confuse developers or users
 * (such as selecting images but having display content toggles toggled OFF).
 */
export function detectSyncConflicts(
  config: SyncConfig,
  quotaExceeded: boolean,
  isTimerRunning: boolean
): SyncConflict[] {
  const conflicts: SyncConflict[] = [];

  if (quotaExceeded) {
    conflicts.push({
      id: 'quota_exceeded',
      type: 'error',
      message: 'Firestoreの送信枠（Quota）上限に達しています。',
      suggestion: '同期機能が一時休止されています。ローカル側のタイマー操作自体は問題なく機能します。明日自動的に解消されます。'
    });
    return conflicts; // Quota gets highest priority
  }

  // Rule 1: Content is selected but contentEnabled is OFF
  if (config.activeImageId && !config.contentEnabled) {
    conflicts.push({
      id: 'image_hidden_conflict',
      type: 'warning',
      message: '画像が選択されていますが、表示が「HIDDEN」に設定されています。',
      suggestion: '画像を表示させるには、Content Selection横のボタンを「VISIBLE」に切り替えて「構成を同期」を押してください。'
    });
  }

  // Rule 2: Timer is running in GM console, but timerEnabled is OFF
  if (isTimerRunning && !config.timerEnabled) {
    conflicts.push({
      id: 'timer_hidden_conflict',
      type: 'info',
      message: 'タイマーは動作していますが、同期ウィンドウ上では「HIDDEN」に設定されています。',
      suggestion: '閲覧側にも時間の経過を共有したい場合は、Timer Control横の表示を「VISIBLE」に切り替えて適用してください。'
    });
  }

  // Rule 3: Visual output fully muted
  if (!config.timerEnabled && !config.contentEnabled) {
    conflicts.push({
      id: 'mirror_empty_conflict',
      type: 'warning',
      message: 'すべての表示要素（時間・コンテンツ）が「HIDDEN」です。',
      suggestion: 'この状態のままだと、同期ウィンドウ（閲覧側ブラウザ）の画面全体が真っ暗になります。どちらかをONにすることをお勧めします。'
    });
  }

  return conflicts;
}

/**
 * Follows UNIX philosophy (single responsibility, pure function).
 * Parses a full sessionId (e.g. "userId_scenarioId") into separate userId and subSessionId components.
 */
export function parseSessionId(sessionId: string): ParsedSessionId {
  if (!sessionId) {
    return { userId: 'anonymous', subSessionId: 'default', isSecure: false };
  }
  const secureParts = sessionId.match(/^timer~([^~]+)~([a-f0-9]{64})$/);
  if (secureParts) {
    return { userId: secureParts[1], subSessionId: secureParts[2], isSecure: true };
  }
  const index = sessionId.indexOf('_');
  if (index === -1) {
    return { userId: sessionId, subSessionId: 'default', isSecure: false };
  }
  const userId = sessionId.substring(0, index);
  const subSessionId = sessionId.substring(index + 1);
  return { userId, subSessionId, isSecure: false };
}

/**
 * Follows UNIX philosophy (single responsibility, pure function).
 * Parses a full handout sessionId (e.g. "userId_scenarioId_characterId") 
 * into userId, subSessionId, and characterId.
 */
export function parseHandoutId(fullSessionId: string): ParsedHandoutId {
  if (!fullSessionId) {
    return { userId: 'anonymous', subSessionId: 'default', characterId: 'default', isSecure: false };
  }
  const secureParts = fullSessionId.match(/^handout~([^~]+)~([a-f0-9]{64})$/);
  if (secureParts) {
    return { userId: secureParts[1], subSessionId: secureParts[2], characterId: secureParts[2], isSecure: true };
  }
  
  // First, split by the first underscore to extract user ID
  const firstIndex = fullSessionId.indexOf('_');
  if (firstIndex === -1) {
    return { userId: fullSessionId, subSessionId: 'default', characterId: 'default', isSecure: false };
  }
  const userId = fullSessionId.substring(0, firstIndex);
  const remainder = fullSessionId.substring(firstIndex + 1);

  // The characterId is always the last part (separated by underscore)
  const lastIndex = remainder.lastIndexOf('_');
  if (lastIndex === -1) {
    return { userId, subSessionId: remainder, characterId: 'default', isSecure: false };
  }
  const subSessionId = remainder.substring(0, lastIndex);
  const characterId = remainder.substring(lastIndex + 1);

  return { userId, subSessionId, characterId, isSecure: false };
}

export function getHandoutDocumentId(fullSessionId: string): string {
  const parsed = parseHandoutId(fullSessionId);
  return parsed.isSecure ? parsed.subSessionId : `${parsed.subSessionId}_${parsed.characterId}`;
}
