// @vitest-environment jsdom
import React, { act, useEffect, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scenario, SoundType } from '../../types';
vi.mock('../../services/AudioService', () => ({audioService:{preload:vi.fn(),getPlaybackStats:vi.fn(),isPlaying:vi.fn(()=>false)}}));
vi.mock('motion/react', () => ({AnimatePresence:({children}:{children:React.ReactNode})=>children,motion:{
  div:({children,className}:{children:React.ReactNode;className?:string})=><div className={className}>{children}</div>,
  button:({children,onClick,disabled,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>)=><button onClick={onClick} disabled={disabled} aria-label={props['aria-label']}>{children}</button>,
}}));
import { SoundTab } from './SoundTab';
let container:HTMLDivElement;
let root:Root;
let latest:Scenario;
const initial = {id:'edge-scenario',sounds:[
  {id:'a',name:'first',url:'',volume:0.6,type:SoundType.BGM},
  {id:'b',name:'second',url:'',volume:0.6,type:SoundType.BGM},
  {id:'c',name:'third',url:'',volume:0.6,type:SoundType.SE},
]} as Scenario;
function Harness() {
  const [scenario,setScenario]=useState(initial);
  useEffect(() => { latest=scenario; }, [scenario]);
  return <SoundTab scenario={scenario} onUpdate={setScenario} previewingSoundId={null} onTogglePreview={vi.fn()}/>;
}
const input=(label:string)=>container.querySelector('[aria-label="'+label+'"]') as HTMLInputElement;
async function change(element:HTMLInputElement,value:string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(element,value);
  await act(()=>element.dispatchEvent(new Event('input',{bubbles:true})));
  await act(()=>element.dispatchEvent(new Event('change',{bubbles:true})));
}
async function select(name:string) {
  const card=Array.from(container.querySelectorAll('.truncate')).find(el=>el.textContent===name)!;
  await act(()=>(card as HTMLElement).click());
  await act(()=>vi.advanceTimersByTime(60));
}
beforeEach(async()=>{
  vi.useFakeTimers();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(()=>root.render(<Harness/>));
});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.useRealTimers();vi.unstubAllGlobals();});
describe('sound editing edge cases',()=>{
  it('moves the actual selected search result, including its original upper neighbor',async()=>{
    await change(container.querySelector('[placeholder="音源を検索..."]') as HTMLInputElement,'second');
    const up=container.querySelector('[aria-label="secondを上へ移動"]') as HTMLButtonElement;
    expect(up.disabled).toBe(false);
    await act(()=>up.click());
    expect(latest.sounds.map(s=>s.id)).toEqual(['b','a','c']);
  });
  it('does not overwrite a volume change when a pending name is saved',async()=>{
    await select('first');
    await change(input('音源名'),'renamed');
    await change(input('音源の音量'),'0.2');
    await act(()=>vi.advanceTimersByTime(500));
    expect(latest.sounds[0]).toMatchObject({name:'renamed',volume:0.2});
  });
  it('saves text on blur before switching and never applies it to the next sound',async()=>{
    await select('first');
    input('音源名').focus();
    await change(input('音源名'),'quick edit');
    await act(()=>input('音源名').blur());
    await select('second');
    await act(()=>vi.advanceTimersByTime(1000));
    expect(latest.sounds[0].name).toBe('quick edit');
    expect(latest.sounds[1].name).toBe('second');
    expect(input('音源名').value).toBe('second');
  });
  it('merges pending name and URL edits instead of restoring stale fields',async()=>{
    await select('first');
    await change(input('音源名'),'combined');
    await change(input('音源URL'),'https://example.com/combined.wav');
    await act(()=>vi.advanceTimersByTime(500));
    expect(latest.sounds[0]).toMatchObject({name:'combined',url:'https://example.com/combined.wav'});
  });
});
