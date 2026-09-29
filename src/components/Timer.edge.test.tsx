// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../services/AudioService',()=>({audioService:{playLapChime:vi.fn()}}));
vi.mock('../hooks/useOwnerMediaUrl',()=>({useOwnerMediaUrl:()=>''}));
vi.mock('motion/react',()=>({AnimatePresence:({children}:{children:React.ReactNode})=>children,motion:{
  div:({children,className}:{children:React.ReactNode;className?:string})=><div className={className}>{children}</div>,
  button:({children,onClick}:{children:React.ReactNode;onClick:React.MouseEventHandler})=><button onClick={onClick}>{children}</button>,
}}));
import TimerCard from './Timer';
import { audioService } from '../services/AudioService';
let root:Root;
let container:HTMLDivElement;
const baseline=Date.UTC(2026,8,29);
async function render(laps=[2], seconds=130, isRunning=true, startTime=baseline, id="timer") {
  await act(()=>root.render(<TimerCard config={{id,label:'test',durationMinutes:3,lapTimes:laps}} seconds={seconds} startTime={startTime} isRunning={isRunning} themeColor="#ffffff" onToggle={vi.fn()} onReset={vi.fn()} onAdjust={vi.fn()}/>));
}
beforeEach(async()=>{
  vi.useFakeTimers();vi.setSystemTime(baseline);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  vi.mocked(audioService.playLapChime).mockClear();
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await render();
});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.useRealTimers();vi.unstubAllGlobals();});
describe('GM notification edge cases',()=>{
  it('does not chime again when unchanged lap settings are recreated after the threshold',async()=>{
    await act(()=>vi.advanceTimersByTime(11000));
    expect(audioService.playLapChime).toHaveBeenCalledTimes(1);
    await render([2]);
    expect(audioService.playLapChime).toHaveBeenCalledTimes(1);
  });
  it('expires the notification after eight seconds while the timer continues',async()=>{
    await act(()=>vi.advanceTimersByTime(11000));
    expect(container.textContent).toContain('残り 2 分');
    await act(()=>vi.advanceTimersByTime(8000));
    expect(container.textContent).not.toContain('残り 2 分');
  });
  it('keeps notification history across pause and resume',async()=>{
    await act(()=>vi.advanceTimersByTime(11000));
    await render([2],119,false);
    await render([2],119,true,Date.now());
    await act(()=>vi.advanceTimersByTime(1000));
    expect(audioService.playLapChime).toHaveBeenCalledTimes(1);
  });
  it('rearms after reset and does not let the old expiration hide the new notification',async()=>{
    await act(()=>vi.advanceTimersByTime(11000));
    await render([2],125,false);
    expect(container.textContent).not.toContain('残り 2 分');
    await render([2],125,true,Date.now());
    await act(()=>vi.advanceTimersByTime(6000));
    expect(audioService.playLapChime).toHaveBeenCalledTimes(2);
    await act(()=>vi.advanceTimersByTime(2000));
    expect(container.textContent).toContain('残り 2 分');
    await act(()=>vi.advanceTimersByTime(6000));
    expect(container.textContent).not.toContain('残り 2 分');
  });
  it('clears a pending lap timeout when unmounted',async()=>{
    await act(()=>vi.advanceTimersByTime(11000));
    await act(()=>root.unmount());
    expect(vi.getTimerCount()).toBe(0);
    root=createRoot(container);
  });
  it('clears the highlight at zero and suppresses elapsed laps on timer switch',async()=>{
    await act(()=>vi.advanceTimersByTime(11000));
    await render([2],0,false);
    expect(container.textContent).not.toContain('残り 2 分');
    await render([2],110,true,Date.now(),'other');
    await act(()=>vi.advanceTimersByTime(1000));
    expect(audioService.playLapChime).toHaveBeenCalledTimes(1);
  });

});
