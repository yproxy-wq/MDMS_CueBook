import { useEffect } from 'react';
import { Scenario, SoundConfig, SoundType, MediaItem, KeyboardShortcuts } from '../types';

export interface GlobalShortcutsOptions {
  scenario?: Scenario;
  keyboardShortcuts?: KeyboardShortcuts;
  sounds?: SoundConfig[];
  combinedImages?: MediaItem[];
  activeImageId?: string | null;
  isEditorMode?: boolean;
  onSetEditorMode?: (isEditor: boolean) => void;
  onToggleEditorMode?: () => void;
  onToggleTimer?: (id?: string) => void;
  onResetTimer?: () => void;
  onToggleSound?: (sound: SoundConfig) => void;
  onPlaySound?: (sound: SoundConfig) => void;
  onStopAllSounds?: () => void;
  onControlVideo?: (id: string, action: 'play' | 'pause' | 'stop') => void;
  onToggleSyncWindow?: () => void;
  onNextPhase?: () => void;
  onPrevPhase?: () => void;
  onToggleQuickActions?: () => void;
  onTogglePhaseSearch?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onSaveScenario?: () => void;
  onSwitchScenarioSlot?: (slot: number) => void;
}

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'preventDefault'>;

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
}

function matchesLetter(event: ShortcutEvent, letter: string): boolean {
  return event.key.toLowerCase() === letter || event.code.toLowerCase() === `key${letter}`;
}

function matchesKey(event: ShortcutEvent, targetKey?: string): boolean {
  if (!targetKey) return false;
  if (targetKey === ' ') return event.key === ' ' || event.code === 'Space';
  if (targetKey === ']') return event.key === ']' || event.code === 'BracketRight';
  if (targetKey === '[') return event.key === '[' || event.code === 'BracketLeft';
  const lowerTarget = targetKey.toLowerCase();
  return event.key === targetKey || event.key.toLowerCase() === lowerTarget || event.code.toLowerCase() === `key${lowerTarget}` || event.code.toLowerCase() === lowerTarget;
}

function mediaIndexFor(activeImageId: string | null | undefined, media: MediaItem[]): number {
  const target = activeImageId ? String(activeImageId).trim().toLowerCase() : '';
  if (!target) return -1;
  return media.findIndex((item) => {
    if (!item) return false;
    return [item.id, item.name, item.url].some((value) => value && String(value).trim().toLowerCase() === target);
  });
}

/**
 * Dispatches a non-editor global shortcut.  It is kept pure apart from supplied
 * callbacks so the complete control surface can be regression-tested without a browser.
 */
export function dispatchGlobalShortcut(event: ShortcutEvent, options: GlobalShortcutsOptions): boolean {
  const keyboardShortcuts = options.keyboardShortcuts || options.scenario?.keyboardShortcuts;
  const sounds = options.sounds || options.scenario?.sounds || [];
  const media = options.combinedImages || [];
  const consume = (callback?: () => void) => {
    event.preventDefault();
    callback?.();
    return true;
  };
  const playMedia = (item?: MediaItem) => {
    const id = item?.id || item?.url || item?.name;
    if (!id || !options.onControlVideo) return false;
    event.preventDefault();
    options.onControlVideo(id, 'play');
    return true;
  };
  const directMediaIndex = () => {
    const digit = event.code.match(/^(?:Digit|Numpad)([1-9])$/) || event.key.match(/^([1-9])$/);
    return digit ? Number.parseInt(digit[1], 10) - 1 : -1;
  };
  const currentIndex = mediaIndexFor(options.activeImageId, media);
  const nextMedia = () => media[(currentIndex >= 0 && currentIndex < media.length - 1) ? currentIndex + 1 : 0];
  const previousMedia = () => media[currentIndex > 0 ? currentIndex - 1 : media.length - 1];
  const isModified = (event.ctrlKey || event.metaKey) && event.altKey;

  if (isModified) {
    const index = directMediaIndex();
    if (index >= 0 && media[index]) return playMedia(media[index]);
    if (matchesLetter(event, 'w') || event.key === '∑' || event.key === 'Σ') return consume(options.onToggleSyncWindow);
    if (matchesLetter(event, 'i') || event.key === 'ˆ' || event.key === 'Dead') {
      event.preventDefault();
      if (media.length > 0) playMedia(event.shiftKey ? previousMedia() : nextMedia());
      return true;
    }
    if (matchesLetter(event, 'e') && !options.isEditorMode) return consume(options.onToggleEditorMode || (() => options.onSetEditorMode?.(true)));
    if (matchesLetter(event, 'g') && options.isEditorMode) return consume(options.onToggleEditorMode || (() => options.onSetEditorMode?.(false)));
    if (matchesLetter(event, 'b')) return consume(() => {
      const bgm = sounds.find((sound) => sound.type === SoundType.BGM);
      if (bgm) options.onToggleSound?.(bgm);
    });
    if (matchesLetter(event, 's')) return consume(() => {
      const se = sounds.find((sound) => sound.type === SoundType.SE);
      if (se) options.onPlaySound?.(se);
    });
    if (matchesLetter(event, 'r')) return consume(options.onResetTimer);
    if (matchesLetter(event, 'n')) return consume(options.onNextPhase);
    if (matchesLetter(event, 'p')) return consume(options.onPrevPhase);
    if (matchesLetter(event, 'q')) return consume(options.onToggleQuickActions);
    return false;
  }

  if ((event.ctrlKey || event.metaKey) && event.shiftKey && matchesLetter(event, 'p')) return consume(options.onTogglePhaseSearch);
  if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
    const slot = directMediaIndex();
    if (slot >= 0) return consume(() => options.onSwitchScenarioSlot?.(slot));
  }
  if (event.ctrlKey || event.altKey || event.metaKey) return false;

  const index = directMediaIndex();
  if (index >= 0 && media[index]) return playMedia(media[index]);

  const bgmKey = keyboardShortcuts?.bgmPlayPause || 'm';
  const seKey = keyboardShortcuts?.sePlay || 'k';
  const timerKey = keyboardShortcuts?.timerStartPause || ' ';
  const nextKey = keyboardShortcuts?.syncItemNext || keyboardShortcuts?.syncImageNext || ']';
  const previousKey = keyboardShortcuts?.syncItemPrev || keyboardShortcuts?.syncImagePrev || '[';

  if (matchesKey(event, bgmKey)) return consume(() => {
    const bgm = sounds.find((sound) => sound.type === SoundType.BGM);
    if (bgm) options.onToggleSound?.(bgm);
  });
  if (matchesKey(event, seKey)) return consume(() => {
    const se = sounds.find((sound) => sound.type === SoundType.SE);
    if (se) options.onPlaySound?.(se);
    else options.onStopAllSounds?.();
  });
  if (matchesKey(event, timerKey)) return consume(options.onToggleTimer);
  if (matchesKey(event, nextKey)) {
    event.preventDefault();
    if (media.length > 0) playMedia(nextMedia());
    return true;
  }
  if (matchesKey(event, previousKey)) {
    event.preventDefault();
    if (media.length > 0) playMedia(previousMedia());
    return true;
  }
  return false;
}

/** Dispatches editor-only undo, redo and save bindings without depending on the DOM. */
export function dispatchEditorShortcut(event: ShortcutEvent, options: Pick<GlobalShortcutsOptions, 'canUndo' | 'canRedo' | 'onUndo' | 'onRedo' | 'onSaveScenario'>): boolean {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
  if (matchesLetter(event, 'z')) {
    if (event.shiftKey && options.canRedo) {
      event.preventDefault();
      options.onRedo?.();
      return true;
    }
    if (!event.shiftKey && options.canUndo) {
      event.preventDefault();
      options.onUndo?.();
      return true;
    }
    return false;
  }
  if (matchesLetter(event, 'y') && options.canRedo) {
    event.preventDefault();
    options.onRedo?.();
    return true;
  }
  if (matchesLetter(event, 's')) {
    event.preventDefault();
    options.onSaveScenario?.();
    return true;
  }
  return false;
}

export function useGlobalShortcuts(options: GlobalShortcutsOptions) {
  const {
    isEditorMode = false,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onSaveScenario,
  } = options;

  useEffect(() => {
    const handleGlobalShortcuts = (event: KeyboardEvent) => {
      if (!isEditableShortcutTarget(event.target)) dispatchGlobalShortcut(event, options);
    };

    window.addEventListener('keydown', handleGlobalShortcuts, true);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts, true);
  }, [options]);

  useEffect(() => {
    if (!isEditorMode) return;
    const handleUndoRedo = (event: KeyboardEvent) => {
      if (!isEditableShortcutTarget(event.target)) dispatchEditorShortcut(event, { canUndo, canRedo, onUndo, onRedo, onSaveScenario });
    };
    window.addEventListener('keydown', handleUndoRedo, true);
    return () => window.removeEventListener('keydown', handleUndoRedo, true);
  }, [isEditorMode, canUndo, canRedo, onUndo, onRedo, onSaveScenario]);
}
