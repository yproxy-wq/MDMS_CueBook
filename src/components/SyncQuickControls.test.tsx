// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSyncConfig } from '../utils/syncConfig';
import { SyncQuickControls } from './SyncQuickControls';

let container: HTMLDivElement;
let root: Root;
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

describe('SyncQuickControls', () => {
  it('controls timer visibility without exposing the removed projection selector', async () => {
    const onSetTimerVisible = vi.fn();
    await act(() => root.render(
      <SyncQuickControls syncConfig={createDefaultSyncConfig()}
        onSetTimerVisible={onSetTimerVisible} onOpenSyncStudio={vi.fn()} />,
    ));
    await act(() => (container.querySelector('[aria-label="同期タイマーを非表示"]') as HTMLButtonElement).click());
    expect(onSetTimerVisible).toHaveBeenCalledWith(false);
    expect(container.querySelector('select')).toBeNull();
  });
});
