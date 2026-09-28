// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NetworkState } from '../services/NetworkMonitor';
const monitor = vi.hoisted(() => ({
  state: { status:'healthy', adGuardDetected:false, lastError:null, retryCount:0, consecutiveSuccesses:3, isFirebaseConnected:true } as NetworkState,
  listener: null as null | ((state:NetworkState)=>void),
  unsubscribe: vi.fn(),
}));
vi.mock('../services/NetworkMonitor', () => ({ networkMonitor: {
  getState:()=>monitor.state,
  subscribe:(listener:(state:NetworkState)=>void)=>{ monitor.listener=listener; listener(monitor.state); return monitor.unsubscribe; },
  triggerProbe:vi.fn(),
}}));
vi.mock('motion/react', () => ({
  AnimatePresence:({children}:{children:React.ReactNode})=>children,
  motion:{div:({children,className}:{children:React.ReactNode;className?:string})=><div className={className}>{children}</div>},
}));
import { NetworkToast } from './NetworkToast';
let container:HTMLDivElement;
let root:Root;
async function emit(status:NetworkState['status']) {
  monitor.state={...monitor.state,status};
  await act(()=>monitor.listener!(monitor.state));
}
beforeEach(async ()=>{
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  monitor.state={...monitor.state,status:'healthy'};
  monitor.unsubscribe.mockClear();
  container=document.createElement('div');
  document.body.append(container);
  root=createRoot(container);
  await act(()=>root.render(<NetworkToast/>));
});
afterEach(async ()=>{
  await act(()=>root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('NetworkToast recovery',()=>{
  it('shows recovery only once and does not extend it on healthy updates',async ()=>{
    expect(container.textContent).toBe('');
    await emit('unreliable');
    await emit('healthy');
    expect(container.textContent).toContain('クラウド接続が復旧しました');
    await act(()=>vi.advanceTimersByTime(8000));
    await emit('healthy');
    await act(()=>vi.advanceTimersByTime(1000));
    expect(container.textContent).toBe('');
    await emit('healthy');
    expect(container.textContent).toBe('');
  });
  it('does not reopen a dismissed recovery on further successful traffic',async ()=>{
    await emit('disconnected');
    await emit('healthy');
    await act(()=>(container.querySelector('[aria-label="復旧通知を閉じる"]') as HTMLButtonElement).click());
    await emit('healthy');
    expect(container.textContent).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('shows a new failure immediately and can recover again',async ()=>{
    await emit('unreliable');
    await emit('healthy');
    await emit('disconnected');
    expect(container.textContent).toContain('ネットワークが切断されました');
    expect(container.textContent).not.toContain('クラウド接続が復旧しました');
    await emit('healthy');
    expect(container.textContent).toContain('クラウド接続が復旧しました');
    await act(()=>root.unmount());
    expect(monitor.unsubscribe).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    root=createRoot(container);
  });
});
