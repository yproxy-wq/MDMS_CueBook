// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SyncWindowModal from './SyncWindowModal';
import { ImageResource, SyncConfig } from '../../types';

let root: Root;
let container: HTMLDivElement;

const syncConfig: SyncConfig = {
  timerEnabled: true,
  contentEnabled: true,
  timerSize: 'small',
  timerPosition: 'bottom',
  imageFit: 'cover',
  activeImageId: null,
};

const media: ImageResource[] = [
  { id: 'first', name: 'First image', url: 'https://example.test/first.jpg', updatedAt: 1 },
  { id: 'second', name: 'Second image', url: 'https://example.test/second.jpg', updatedAt: 2 },
];

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

const show = async (onApplySync = vi.fn(), onToggleTimer = vi.fn(), onResetTimer = vi.fn()) => {
  await act(() => root.render(
    <SyncWindowModal
      isOpen
      onClose={vi.fn()}
      onShareSync={() => 'https://example.test/share'}
      onApplySync={onApplySync}
      syncConfig={syncConfig}
      onToggleTimer={onToggleTimer}
      onResetTimer={onResetTimer}
      onResetSync={vi.fn()}
      availableMedia={media}
      scenarioId="scenario"
    />,
  ));
  return onApplySync;
};

describe('SyncWindowModal content picker', () => {
  it('projects the selected item immediately from the compact dropdown', async () => {
    const onApplySync = await show();
    const select = document.body.querySelector('[aria-label="投影する画像またはPDFを選択"]') as HTMLSelectElement;

    await act(() => {
      select.value = 'second';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onApplySync).toHaveBeenLastCalledWith(expect.objectContaining({
      activeImageId: 'second',
    }));
    expect(onApplySync).toHaveBeenCalledTimes(1);
  });

  it('keeps the conventional thumbnail picker available on demand', async () => {
    await show();
    expect(document.body.querySelector('#sync-media-gallery')).toBeNull();

    const openGallery = [...document.body.querySelectorAll('button')]
      .find((button) => button.textContent === 'サムネイルで選ぶ') as HTMLButtonElement;
    await act(() => openGallery.click());

    expect(document.body.querySelector('#sync-media-gallery')).not.toBeNull();
  });
});


describe('Sync Studio timer control argument boundaries', () => {
  it('calls timer operations without passing the browser event as a timer ID', async () => {
    const toggle = vi.fn();
    const reset = vi.fn();
    await show(vi.fn(), toggle, reset);
    await act(() => (document.querySelector('[aria-label="タイマーを開始"]') as HTMLButtonElement).click());
    await act(() => (document.querySelector('[aria-label="タイマーをリセット"]') as HTMLButtonElement).click());
    expect(toggle.mock.calls).toEqual([[]]);
    expect(reset.mock.calls).toEqual([[]]);
  });
});
