// @vitest-environment jsdom
import React, { act, useState, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioController } from './useAudioController';
import { audioService } from '../services/AudioService';
import { type AppState, type SoundConfig, SoundType } from '../types';
vi.mock('../services/AudioService',()=>({audioService:{setVolume:vi.fn(),setDucking:vi.fn(),stop:vi.fn(),stopAll:vi.fn(),play:vi.fn(async()=>true)}}));
let controls:ReturnType<typeof useAudioController>;
let current:AppState;
let root:Root;
let container:HTMLDivElement;
const a:SoundConfig={id:'a',name:'A',url:'a.wav',type:SoundType.BGM,volume:1};
const b:SoundConfig={...a,id:'b',name:'B',url:'b.wav'};
function Harness() {
  const [state,setState]=useState({volume:1,isDucking:false,isPlaying:{a:true,b:true},usedSounds:new Set(),currentScenario:{id:'test',sounds:[a,b]}} as unknown as AppState);
  const controller=useAudioController(state,setState,vi.fn());
  useEffect(()=>{controls=controller;current=state;},[controller,state]);return null;
}
beforeEach(async()=>{vi.clearAllMocks();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');root=createRoot(container);await act(()=>root.render(<Harness/>));});
afterEach(async()=>{await act(()=>root.unmount());vi.unstubAllGlobals();});
describe('audio controller state boundaries',()=>{
  it('stops every sound through the existing all shortcut and clears playing markers',async()=>{
    await act(()=>controls.handleStopSound('all'));
    expect(audioService.stopAll).toHaveBeenCalledOnce();expect(audioService.stop).not.toHaveBeenCalled();expect(current.isPlaying).toEqual({});
  });
  it('does not revive playing markers after stop all while play is awaiting',async()=>{
    let finish!:(value:boolean)=>void;vi.mocked(audioService.play).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    const pending=controls.handlePlaySound(a);await act(()=>controls.handleStopAllSounds());
    await act(async()=>{finish(true);await pending;});expect(current.isPlaying).toEqual({});
  });
  it('merges overlapping completions without resurrecting unrelated stopped sounds',async()=>{
    await act(()=>controls.handleStopAllSounds());
    let finishA!:(value:boolean)=>void;let finishB!:(value:boolean)=>void;
    vi.mocked(audioService.play).mockImplementationOnce(()=>new Promise(resolve=>{finishA=resolve;})).mockImplementationOnce(()=>new Promise(resolve=>{finishB=resolve;}));
    const pendingA=controls.handlePlaySound(a);const pendingB=controls.handlePlaySound(b);
    await act(async()=>{finishA(true);await pendingA;});await act(async()=>{finishB(true);await pendingB;});
    expect(current.isPlaying).toEqual({a:true,b:true});
  });
});
