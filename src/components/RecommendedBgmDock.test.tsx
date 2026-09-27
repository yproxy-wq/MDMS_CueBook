// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_SCENARIO } from '../constants';
import { Phase, SoundConfig, SoundType } from '../types';
import { RecommendedBgmDock } from './RecommendedBgmDock';

let container: HTMLDivElement;
let root: Root;

const sounds: SoundConfig[] = [
  { id: 'bgm-a', name: 'Night', url: '', type: SoundType.BGM },
  { id: 'bgm-b', name: 'Dawn', url: '', type: SoundType.BGM },
  { id: 'se-a', name: 'Door', url: '', type: SoundType.SE },
];
const phase: Phase = { ...INITIAL_SCENARIO.phases[0], id: 'phase-a', name: '第一幕', recommendedSounds: ['bgm-a', 'se-a'] };

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('RecommendedBgmDock', () => {
  it('shows one primary BGM action and toggles the selected BGM', async () => {
    const onToggleSound = vi.fn();
    await act(() => root.render(
      <RecommendedBgmDock phase={phase} sounds={sounds} isPlaying={{}} themeColor="#22c55e"
        onToggleSound={onToggleSound} onUpdateRecommendedSounds={vi.fn()} />,
    ));
    expect(container.textContent).toContain('Night');
    expect(container.textContent).not.toContain('Dawn');
    expect(container.textContent).not.toContain('Door');
    await act(() => (container.querySelector('[aria-label="Nightを再生"]') as HTMLButtonElement).click());
    expect(onToggleSound).toHaveBeenCalledWith(sounds[0]);
  });

  it('promotes the playing recommendation and exposes its stop action', async () => {
    const multiBgmPhase = { ...phase, recommendedSounds: ['bgm-a', 'bgm-b'] };
    await act(() => root.render(
      <RecommendedBgmDock phase={multiBgmPhase} sounds={sounds} isPlaying={{ 'bgm-b': true }} themeColor="#22c55e"
        onToggleSound={vi.fn()} onUpdateRecommendedSounds={vi.fn()} />,
    ));
    expect(container.textContent).toContain('停止');
    expect(container.querySelector('[aria-label="Dawnを停止"]')).not.toBeNull();
  });

  it('renders only the BGM control when placed in the phase top bar', async () => {
    await act(() => root.render(
      <RecommendedBgmDock placement="topbar" phase={phase} sounds={sounds} isPlaying={{}} themeColor="#22c55e"
        onToggleSound={vi.fn()} onUpdateRecommendedSounds={vi.fn()} />,
    ));
    expect(container.querySelector('[aria-label="ライブ操作"]')).toBeNull();
    expect(container.querySelector('[aria-label="Nightを再生"]')).not.toBeNull();
  });

  it('makes BGM selection discoverable and preserves existing non-BGM recommendations', async () => {
    const onUpdateRecommendedSounds = vi.fn();
    await act(() => root.render(
      <RecommendedBgmDock phase={phase} sounds={sounds} isPlaying={{}} themeColor="#22c55e"
        onToggleSound={vi.fn()} onUpdateRecommendedSounds={onUpdateRecommendedSounds} />,
    ));
    await act(() => (container.querySelector('[aria-label="推奨BGMを変更"]') as HTMLButtonElement).click());
    const checkboxes = [...document.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    await act(() => checkboxes.find((checkbox) => checkbox.parentElement?.textContent?.includes('Dawn'))?.click());
    expect(onUpdateRecommendedSounds).toHaveBeenLastCalledWith('phase-a', ['se-a', 'bgm-a', 'bgm-b']);
  });
});
