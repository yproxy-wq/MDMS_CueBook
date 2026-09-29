// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HoldButton } from './HoldButton';
let container: HTMLDivElement;
let root: Root;
const complete = vi.fn();
const button = () => container.querySelector('button')!;
const key = (type: string, value: string, repeat = false) => button().dispatchEvent(new KeyboardEvent(type, {key: value, repeat, bubbles: true, cancelable: true}));
beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id));
  complete.mockClear();
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  await act(() => root.render(<HoldButton title="長押しで削除" requiredDuration={800} onHoldComplete={complete}>削除</HoldButton>));
});
afterEach(async () => { await act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('requires a sustained keyboard hold and ignores repeats and synthetic clicks', async () => {
  await act(() => { key('keydown', ' '); vi.advanceTimersByTime(400); key('keydown', ' ', true); });
  expect(complete).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTime(420));
  expect(complete).toHaveBeenCalledTimes(1);
  await act(() => { key('keyup', ' '); button().click(); vi.advanceTimersByTime(1000); });
  expect(complete).toHaveBeenCalledTimes(1);
});
it('cancels early release, Escape, and window blur without completion', async () => {
  for (const reason of ['keyup', 'escape', 'blur']) {
    await act(() => { key('keydown', 'Enter'); vi.advanceTimersByTime(400); });
    await act(() => {
      if (reason === 'keyup') key('keyup', 'Enter');
      else if (reason === 'escape') key('keydown', 'Escape');
      else window.dispatchEvent(new Event('blur'));
      vi.advanceTimersByTime(1000);
    });
  }
  expect(complete).not.toHaveBeenCalled();
});
it('cancels pointer cancellation and unmount', async () => {
  await act(() => { button().dispatchEvent(new MouseEvent('pointerdown', {button:0,bubbles:true})); vi.advanceTimersByTime(400); button().dispatchEvent(new Event('pointercancel', {bubbles:true})); vi.advanceTimersByTime(1000); });
  expect(complete).not.toHaveBeenCalled();
  await act(() => { key('keydown', 'Enter'); vi.advanceTimersByTime(400); root.unmount(); vi.advanceTimersByTime(1000); });
  expect(complete).not.toHaveBeenCalled();
  root = createRoot(container);
});
