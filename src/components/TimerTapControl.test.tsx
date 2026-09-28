// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimerTapControl } from './TimerTapControl';

let container: HTMLDivElement;
let root: Root;
const toggle = vi.fn();
const trigger = () => container.querySelector('[aria-expanded]') as HTMLButtonElement;
const action = () => container.querySelector('[aria-label="タイマーを開始"], [aria-label="タイマーを停止"]') as HTMLButtonElement | null;
async function render(isRunning = false, key = 'timer-a', disabled = false) {
  await act(() => root.render(<TimerTapControl key={key} isRunning={isRunning} disabled={disabled} onToggle={toggle}>05:00</TimerTapControl>));
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  toggle.mockClear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
describe('TimerTapControl', () => {
  it('requires two separate activations, then closes and restores focus', async () => {
    await render();
    await act(() => trigger().click());
    expect(toggle).not.toHaveBeenCalled();
    expect(action()?.textContent).toBe('開始');
    expect(document.activeElement).toBe(action());
    await act(() => action()!.click());
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(action()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });
  it('uses the current running state after an external update', async () => {
    await render();
    await act(() => trigger().click());
    await render(true);
    expect(action()?.textContent).toBe('停止');
    await act(() => action()!.click());
    expect(toggle).toHaveBeenCalledTimes(1);
  });
  it('cancels with Escape or an outside touch without toggling', async () => {
    await render();
    await act(() => trigger().click());
    await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(action()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    await act(() => trigger().click());
    await act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(action()).toBeNull();
    expect(toggle).not.toHaveBeenCalled();
  });
  it('closes on focus departure and resets when the timer target changes', async () => {
    await render();
    await act(() => trigger().click());
    await act(() => document.body.dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
    expect(action()).toBeNull();
    await act(() => trigger().click());
    await render(false, 'timer-b');
    expect(action()).toBeNull();
    expect(toggle).not.toHaveBeenCalled();
  });
  it('keeps button activation keys away from global shortcuts', async () => {
    await render();
    const globalKey = vi.fn();
    document.addEventListener('keydown', globalKey);
    try {
      await act(() => trigger().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
      expect(toggle).not.toHaveBeenCalled();
      expect(action()).not.toBeNull();
      await act(() => action()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
      expect(globalKey).not.toHaveBeenCalled();
      expect(toggle).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('keydown', globalKey);
    }
  });
  it('disables activation when no timer exists', async () => {
    await render(false, 'none', true);
    await act(() => trigger().click());
    expect(action()).toBeNull();
    expect(toggle).not.toHaveBeenCalled();
  });
});