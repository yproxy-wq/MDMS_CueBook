import { describe, expect, it, vi } from 'vitest';
import { dispatchEditorShortcut, dispatchGlobalShortcut, GlobalShortcutsOptions } from './useGlobalShortcuts';
import { MediaItem, SoundConfig, SoundType } from '../types';

const media: MediaItem[] = [
  { id: 'media-1', name: 'First', url: 'https://example.test/1', updatedAt: 1 },
  { id: 'media-2', name: 'Second', url: 'https://example.test/2', updatedAt: 1 },
];
const sounds: SoundConfig[] = [
  { id: 'bgm-1', name: 'BGM', url: 'https://example.test/bgm', type: SoundType.BGM },
  { id: 'se-1', name: 'SE', url: 'https://example.test/se', type: SoundType.SE },
];

function makeEvent(key: string, overrides: Partial<KeyboardEvent> = {}) {
  return {
    key,
    code: overrides.code || '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as KeyboardEvent;
}

function callbacks(): GlobalShortcutsOptions {
  return {
    sounds,
    combinedImages: media,
    activeImageId: 'media-1',
    onToggleSyncWindow: vi.fn(),
    onToggleTimer: vi.fn(),
    onResetTimer: vi.fn(),
    onToggleSound: vi.fn(),
    onPlaySound: vi.fn(),
    onControlVideo: vi.fn(),
    onNextPhase: vi.fn(),
    onPrevPhase: vi.fn(),
    onToggleQuickActions: vi.fn(),
    onTogglePhaseSearch: vi.fn(),
  };
}

describe('dispatchGlobalShortcut', () => {
  it('opens the sync window with Ctrl/Cmd + Alt + W', () => {
    const options = callbacks();
    const event = makeEvent('w', { code: 'KeyW', ctrlKey: true, altKey: true });

    expect(dispatchGlobalShortcut(event, options)).toBe(true);
    expect(options.onToggleSyncWindow).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it('controls the timer with Space and resets it with Ctrl/Cmd + Alt + R', () => {
    const options = callbacks();
    dispatchGlobalShortcut(makeEvent(' ', { code: 'Space' }), options);
    dispatchGlobalShortcut(makeEvent('r', { code: 'KeyR', metaKey: true, altKey: true }), options);

    expect(options.onToggleTimer).toHaveBeenCalledOnce();
    expect(options.onResetTimer).toHaveBeenCalledOnce();
  });

  it('controls BGM and SE with their configured audio shortcuts', () => {
    const options = callbacks();
    dispatchGlobalShortcut(makeEvent('m', { code: 'KeyM' }), options);
    dispatchGlobalShortcut(makeEvent('k', { code: 'KeyK' }), options);
    dispatchGlobalShortcut(makeEvent('b', { code: 'KeyB', ctrlKey: true, altKey: true }), options);
    dispatchGlobalShortcut(makeEvent('s', { code: 'KeyS', ctrlKey: true, altKey: true }), options);

    expect(options.onToggleSound).toHaveBeenCalledTimes(2);
    expect(options.onToggleSound).toHaveBeenCalledWith(sounds[0]);
    expect(options.onPlaySound).toHaveBeenCalledTimes(2);
    expect(options.onPlaySound).toHaveBeenCalledWith(sounds[1]);
  });

  it('selects and cycles synchronized media by direct number, next and previous shortcuts', () => {
    const options = callbacks();
    dispatchGlobalShortcut(makeEvent('2', { code: 'Digit2' }), options);
    dispatchGlobalShortcut(makeEvent(']', { code: 'BracketRight' }), options);
    dispatchGlobalShortcut(makeEvent('[', { code: 'BracketLeft' }), options);
    dispatchGlobalShortcut(makeEvent('i', { code: 'KeyI', ctrlKey: true, altKey: true, shiftKey: true }), options);

    expect(options.onControlVideo).toHaveBeenNthCalledWith(1, 'media-2', 'play');
    expect(options.onControlVideo).toHaveBeenNthCalledWith(2, 'media-2', 'play');
    expect(options.onControlVideo).toHaveBeenNthCalledWith(3, 'media-2', 'play');
    expect(options.onControlVideo).toHaveBeenNthCalledWith(4, 'media-2', 'play');
  });

  it('supports Ctrl/Cmd + Alt direct media selection and editor mode switching', () => {
    const options = { ...callbacks(), onToggleEditorMode: vi.fn(), isEditorMode: false };
    dispatchGlobalShortcut(makeEvent('2', { code: 'Numpad2', ctrlKey: true, altKey: true }), options);
    dispatchGlobalShortcut(makeEvent('e', { code: 'KeyE', ctrlKey: true, altKey: true }), options);
    dispatchGlobalShortcut(makeEvent('g', { code: 'KeyG', ctrlKey: true, altKey: true }), { ...options, isEditorMode: true });

    expect(options.onControlVideo).toHaveBeenCalledWith('media-2', 'play');
    expect(options.onToggleEditorMode).toHaveBeenCalledTimes(2);
  });

  it('routes phase, quick-action and command-palette shortcuts', () => {
    const options = callbacks();
    dispatchGlobalShortcut(makeEvent('n', { code: 'KeyN', ctrlKey: true, altKey: true }), options);
    dispatchGlobalShortcut(makeEvent('p', { code: 'KeyP', ctrlKey: true, altKey: true }), options);
    dispatchGlobalShortcut(makeEvent('q', { code: 'KeyQ', ctrlKey: true, altKey: true }), options);
    dispatchGlobalShortcut(makeEvent('p', { code: 'KeyP', ctrlKey: true, shiftKey: true }), options);

    expect(options.onNextPhase).toHaveBeenCalledOnce();
    expect(options.onPrevPhase).toHaveBeenCalledOnce();
    expect(options.onToggleQuickActions).toHaveBeenCalledOnce();
    expect(options.onTogglePhaseSearch).toHaveBeenCalledOnce();
  });

  it('switches scenario slots with Ctrl/Cmd + Shift + number', () => {
    const options = { ...callbacks(), onSwitchScenarioSlot: vi.fn() };
    const handled = dispatchGlobalShortcut(makeEvent('3', { code: 'Digit3', ctrlKey: true, shiftKey: true }), options);

    expect(handled).toBe(true);
    expect(options.onSwitchScenarioSlot).toHaveBeenCalledWith(2);
    expect(options.onControlVideo).not.toHaveBeenCalled();
  });

  it('honors user-defined single-key bindings', () => {
    const options = callbacks();
    options.keyboardShortcuts = { bgmPlayPause: 'x', sePlay: 'c', timerStartPause: 't', syncImageNext: 'l', syncImagePrev: 'h', syncItemNext: 'l', syncItemPrev: 'h' };
    dispatchGlobalShortcut(makeEvent('x', { code: 'KeyX' }), options);
    dispatchGlobalShortcut(makeEvent('c', { code: 'KeyC' }), options);
    dispatchGlobalShortcut(makeEvent('t', { code: 'KeyT' }), options);
    dispatchGlobalShortcut(makeEvent('l', { code: 'KeyL' }), options);
    dispatchGlobalShortcut(makeEvent('h', { code: 'KeyH' }), options);

    expect(options.onToggleSound).toHaveBeenCalledWith(sounds[0]);
    expect(options.onPlaySound).toHaveBeenCalledWith(sounds[1]);
    expect(options.onToggleTimer).toHaveBeenCalledOnce();
    expect(options.onControlVideo).toHaveBeenCalledTimes(2);
  });

  it('stops every sound when the SE key is used without an SE and never consumes unsupported bindings', () => {
    const onStopAllSounds = vi.fn();
    const options = { ...callbacks(), sounds: [sounds[0]], onStopAllSounds };
    const handled = dispatchGlobalShortcut(makeEvent('k', { code: 'KeyK' }), options);
    const unsupported = dispatchGlobalShortcut(makeEvent('u', { code: 'KeyU' }), options);

    expect(handled).toBe(true);
    expect(onStopAllSounds).toHaveBeenCalledOnce();
    expect(unsupported).toBe(false);
  });

  it('routes editor undo, redo and save shortcuts', () => {
    const options = { canUndo: true, canRedo: true, onUndo: vi.fn(), onRedo: vi.fn(), onSaveScenario: vi.fn() };
    dispatchEditorShortcut(makeEvent('z', { code: 'KeyZ', ctrlKey: true }), options);
    dispatchEditorShortcut(makeEvent('z', { code: 'KeyZ', ctrlKey: true, shiftKey: true }), options);
    dispatchEditorShortcut(makeEvent('y', { code: 'KeyY', metaKey: true }), options);
    dispatchEditorShortcut(makeEvent('s', { code: 'KeyS', ctrlKey: true }), options);

    expect(options.onUndo).toHaveBeenCalledOnce();
    expect(options.onRedo).toHaveBeenCalledTimes(2);
    expect(options.onSaveScenario).toHaveBeenCalledOnce();
  });
});
