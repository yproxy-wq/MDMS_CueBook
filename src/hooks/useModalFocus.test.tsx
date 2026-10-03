// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { useModalFocus } from './useModalFocus';
let root: Root;
let host: HTMLDivElement;
let trigger: HTMLButtonElement;
function Harness({ open, close }: { open: boolean; close: () => void }) {
  const ref = useModalFocus(open, close);
  return open ? <div ref={ref} role="dialog" tabIndex={-1}><button>First</button><button>Last</button></div> : null;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
  trigger = document.createElement('button'); host = document.createElement('div'); document.body.append(trigger, host);
  trigger.focus(); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); trigger.remove(); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('confines Tab and Shift+Tab, closes on Escape and restores the initiating button', async () => {
  const close = vi.fn();
  await act(() => root.render(<Harness open close={close} />));
  const panel = host.querySelector('[role="dialog"]') as HTMLElement;
  const [first, last] = Array.from(panel.querySelectorAll('button'));
  expect(document.activeElement).toBe(panel);
  last.focus(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(first);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(last);
  trigger.focus(); expect(document.activeElement).toBe(panel);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(close).toHaveBeenCalledTimes(1);
  await act(() => root.render(<Harness open={false} close={close} />));
  expect(document.activeElement).toBe(trigger);
});
