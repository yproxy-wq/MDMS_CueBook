// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SoundCard } from './SoundCard';
import { SoundConfig, SoundType } from '../types';
vi.mock('../services/AudioService', () => ({audioService:{seek:vi.fn(),getPlaybackStats:vi.fn()}}));
let container: HTMLDivElement;
let root: Root;
const toggle = vi.fn(), play = vi.fn(), stop = vi.fn(), update = vi.fn();
const sound = {id:'sample',name:'効果音',type:SoundType.SE,url:'sample.mp3',volume:1,triggerMode:'toggle',loopEnabled:true} as SoundConfig;
const render = async (hold = false) => act(() => root.render(<SoundCard sound={{...sound, triggerMode: hold ? 'hold' : 'toggle'}} active={false} isLinked={false} customColor="#ffffff" onToggleSound={toggle} onPlaySound={play} onStopSound={stop} onUpdateSoundConfig={update}/>));
const card = () => container.querySelector('[role="group"]') as HTMLDivElement;
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true); [toggle,play,stop,update].forEach(mock=>mock.mockClear()); container=document.createElement('div');document.body.append(container);root=createRoot(container); });
afterEach(async () => {await act(()=>root.unmount());container.remove();vi.unstubAllGlobals();});
it('exposes playback controls on keyboard focus without playing on first focus', async () => {
  await render(); await act(()=>card().focus());
  expect(toggle).not.toHaveBeenCalled();
  const action=container.querySelector('[aria-label="効果音を再生"]') as HTMLButtonElement;
  expect(action).not.toBeNull();
  const globalKey=vi.fn();window.addEventListener('keydown',globalKey);
  await act(()=>action.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
  window.removeEventListener('keydown',globalKey);
  expect(toggle).toHaveBeenCalledTimes(1);expect(globalKey).not.toHaveBeenCalled();
});
it('makes sound configuration indicators read-only and announces their meaning', async () => {
  await render();
  const status=container.querySelector('[aria-label="ループ：有効"]') as HTMLElement;
  expect(status).not.toBeNull(); await act(()=>status.click()); expect(update).not.toHaveBeenCalled();
});
it('plays hold sounds once and releases on keyup, focus departure, and touch cancel', async () => {
  await render(true);
  for (const reason of ['keyup','blur','touchcancel']) {
    await act(()=>{
      card().focus();card().dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));card().dispatchEvent(new KeyboardEvent('keydown',{key:' ',repeat:true,bubbles:true}));
    });
    await act(()=>{
      if(reason==='keyup') card().dispatchEvent(new KeyboardEvent('keyup',{key:' ',bubbles:true}));
      else if(reason==='blur') card().blur();
      else card().dispatchEvent(new Event('touchcancel',{bubbles:true}));
    });
  }
  expect(play).toHaveBeenCalledTimes(3);expect(stop).toHaveBeenCalledTimes(3);
});
