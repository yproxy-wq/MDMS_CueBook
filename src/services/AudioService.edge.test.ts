// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioService } from './AudioService';
import { SoundType, type SoundConfig } from '../types';
const sources: {start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>;connect:ReturnType<typeof vi.fn>;buffer?:unknown;onended?:()=>void}[] = [];
const elements: FakeAudio[] = [];
const gains: {gain:{setValueAtTime:ReturnType<typeof vi.fn>;linearRampToValueAtTime:ReturnType<typeof vi.fn>}}[] = [];
let decode: () => Promise<{duration:number}>;
vi.mock('./NetworkMonitor', () => ({networkMonitor:{safeFetch:async()=>({ok:true,headers:{get:()=> 'audio/wav'},arrayBuffer:async()=>new ArrayBuffer(8)})}}));
class FakeAudio {
  paused = true; currentTime = 0; duration = 10; readyState = 4; src = ''; loop = false;
  ontimeupdate?:()=>void; onended?:()=>void;
  constructor() { elements.push(this); }
  play = vi.fn(async()=> { this.paused=false; });
  pause = vi.fn(()=> {this.paused=true;});
  removeAttribute = vi.fn(); load = vi.fn();
}
class FakeContext {
  state = 'running'; currentTime=0; destination={};
  createGain() { const gain = {connect:vi.fn(),disconnect:vi.fn(),gain:{value:1,cancelScheduledValues:vi.fn(),setValueAtTime:vi.fn(),linearRampToValueAtTime:vi.fn(),setValueCurveAtTime:vi.fn()}}; gains.push(gain); return gain; }
  createMediaElementSource() { return {connect:vi.fn(),disconnect:vi.fn()}; }
  createBufferSource() { const source={start:vi.fn(),stop:vi.fn(),connect:vi.fn()}; sources.push(source);return source; }
  decodeAudioData() { return decode(); }
}
const sound:SoundConfig = {id:'effect',name:'Effect',type:SoundType.SE,url:'https://example.com/effect.wav',volume:1,loopEnabled:false,startTime:2,endTime:5};
beforeEach(()=> { sources.length=0;elements.length=0;gains.length=0;decode=async()=>({duration:10});vi.stubGlobal('Audio',FakeAudio);vi.stubGlobal('AudioContext',FakeContext); });
afterEach(()=>vi.unstubAllGlobals());
describe('audio operation boundaries',()=> {
  it('fades out at the configured SE endpoint without extending the clip',async()=> {
    const service=new AudioService();await service.play({...sound,fadeOutEnabled:true,fadeOutDuration:1});
    expect(gains[3].gain.setValueAtTime).toHaveBeenCalledWith(1,2);
    expect(gains[3].gain.linearRampToValueAtTime).toHaveBeenCalledWith(0,3);
    expect(sources[0].start).toHaveBeenCalledWith(0,2,3);
  });
  it('does not play an inverted SE interval',async()=> {
    const service=new AudioService();expect(await service.play({...sound,startTime:5,endTime:2})).toBe(false);
    expect(sources[0].start).not.toHaveBeenCalled();
  });
  it('plays the configured SE interval instead of the complete buffer',async()=> {
    const service=new AudioService();expect(await service.play(sound)).toBe(true);
    expect(sources[0].start).toHaveBeenCalledWith(0,2,3);
  });
  it('clamps SE end to the actual source duration',async()=> {
    const service=new AudioService();await service.play({...sound,endTime:50});
    expect(sources[0].start).toHaveBeenCalledWith(0,2,8);
  });
  it('offers monitorable, pausable and seekable SE preview',async()=> {
    const service=new AudioService();await service.playPreview(sound);
    expect(sources).toHaveLength(0);expect(service.isPlaying(sound.id)).toBe(true);
    expect(service.getPlaybackStats(sound.id)).toEqual({current:2,duration:10,isLoading:false});
    service.seek(sound.id,3);expect(service.getPlaybackStats(sound.id)?.current).toBe(3);
    await service.playPreview(sound);expect(service.isPaused(sound.id)).toBe(true);
    await service.playPreview(sound);expect(service.isPlaying(sound.id)).toBe(true);
  });
  it('does not start a decoded SE after stop all during loading',async()=> {
    let finish!:(value:{duration:number})=>void;decode=()=>new Promise(resolve=>{finish=resolve;});
    const service=new AudioService();const pending=service.play(sound);
    await vi.waitFor(()=>expect(finish).toBeDefined());service.stopAll();finish({duration:10});
    expect(await pending).toBe(false);expect(sources).toHaveLength(0);
  });
  it('cancels a pending sound individually and stops a playing preview immediately',async()=> {
    let finish!:(value:{duration:number})=>void;decode=()=>new Promise(resolve=>{finish=resolve;});
    const service=new AudioService();const pending=service.play(sound);
    await vi.waitFor(()=>expect(finish).toBeDefined());service.stop(sound.id,true);finish({duration:10});
    expect(await pending).toBe(false);
    await service.playPreview({...sound,fadeOutEnabled:true,fadeOutDuration:3});service.stop(sound.id,true);
    expect(service.isPlaying(sound.id)).toBe(false);expect(elements[0].pause).toHaveBeenCalled();
  });
});
