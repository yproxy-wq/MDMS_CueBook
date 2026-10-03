// @vitest-environment jsdom
import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { useFloatingTimer } from './useFloatingTimer';

let root: Root;
let host: HTMLDivElement;
let timer: ReturnType<typeof useFloatingTimer>;
let measure: () => void;
function Harness({ width, height }: { width: number; height: number }) {
  const controls = useFloatingTimer({ width, height }, false, false, false, '2-column');
  useEffect(() => { timer = controls; });
  // Passing the DOM ref through to JSX does not read its current value.
  // eslint-disable-next-line react-hooks/refs
  return <div ref={controls.timerRef} />;
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { measure = callback; } observe() {} disconnect() {} });
  localStorage.clear(); localStorage.setItem('cuebook_timer_x', '9999'); localStorage.setItem('cuebook_timer_y', '9999');
  localStorage.setItem('cuebook_timer_has_dragged', 'true');
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
it('keeps restored coordinates and the full measured controls inside rotated viewports', async () => {
  await act(() => root.render(<Harness width={1024} height={768} />));
  expect(timer.timerX).toBeLessThanOrEqual(1024 - 280 - 10);
  timer.timerRef.current!.getBoundingClientRect = () => ({ width: 310, height: 260 }) as DOMRect;
  await act(() => measure());
  expect(timer.timerX + 310).toBeLessThanOrEqual(1014);
  expect(timer.timerY + 260).toBeLessThanOrEqual(758);
  await act(() => root.render(<Harness width={820} height={1180} />));
  expect(timer.timerX + 310).toBeLessThanOrEqual(810);
  await act(() => { timer.handleTimerDragEnd(new MouseEvent('mouseup'), { offset: { x: 9999, y: 9999 }, point: { x: 9999, y: 9999 } }); });
  expect(timer.timerX + 310).toBeLessThanOrEqual(810);
  expect(timer.timerY + 260).toBeLessThanOrEqual(1170);
});
