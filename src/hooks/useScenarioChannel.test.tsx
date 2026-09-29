// @vitest-environment jsdom
import React, { act, useRef } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScenarioChannel } from './useScenarioChannel';
class FakeChannel extends EventTarget {
  static instances:FakeChannel[]=[];
  postMessage=vi.fn();
  close=vi.fn();
  constructor(public name:string) {super();FakeChannel.instances.push(this);}
  emit(data:unknown) {this.dispatchEvent(new MessageEvent('message',{data}));}
}
let root:Root;
let container:HTMLDivElement;
const receive=vi.fn();
function Harness({scenario='a',scope='anonymous',enabled=true}:{scenario?:string;scope?:string;enabled?:boolean}) {
  const channelRef=useRef<BroadcastChannel|null>(null);
  useScenarioChannel({enabled,scope,source:'this-tab',channelRef,onMessage:message=>receive(scenario,message)});
  return null;
}
async function render(scenario='a',scope='anonymous',enabled=true) {
  await act(()=>root.render(<Harness scenario={scenario} scope={scope} enabled={enabled}/>));
}
beforeEach(()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubGlobal('BroadcastChannel',FakeChannel);
  FakeChannel.instances=[];receive.mockClear();container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.unstubAllGlobals();});
describe('scenario channel lifetime',()=>{
  it('requests initial state once, not on scenario switches or repeated renders',async()=>{
    await render();
    for(let i=0;i<20;i++) await render(i%2?'a':'b');
    expect(FakeChannel.instances).toHaveLength(1);
    expect(FakeChannel.instances[0].postMessage).toHaveBeenCalledExactlyOnceWith({type:'scenario-active-request',source:'this-tab'});
    expect(FakeChannel.instances[0].close).not.toHaveBeenCalled();
    await act(()=>FakeChannel.instances[0].emit({type:'scenario-active-request',source:'another-tab'}));
    expect(receive).toHaveBeenLastCalledWith('a',{type:'scenario-active-request',source:'another-tab'});
  });
  it('uses the latest scenario callback and ignores messages from itself',async()=>{
    await render('a');await render('tablet-scenario');
    await act(()=>FakeChannel.instances[0].emit({type:'scenario-active',scenarioId:'b',source:'other'}));
    expect(receive).toHaveBeenLastCalledWith('tablet-scenario',{type:'scenario-active',scenarioId:'b',source:'other'});
    await act(()=>FakeChannel.instances[0].emit({type:'scenario-active',source:'this-tab'}));
    expect(receive).toHaveBeenCalledTimes(1);
  });
  it('reconnects for an account change and cleans up disabled transports',async()=>{
    await render();await render('a','new-account');
    expect(FakeChannel.instances).toHaveLength(2);
    expect(FakeChannel.instances[0].close).toHaveBeenCalledTimes(1);
    expect(FakeChannel.instances[1].name).toBe('cuebook-active-scenario:new-account');
    await render('a','new-account',false);
    expect(FakeChannel.instances[1].close).toHaveBeenCalledTimes(1);
    await act(()=>FakeChannel.instances[1].emit({type:'scenario-active',source:'other'}));
    expect(receive).not.toHaveBeenCalled();
  });
  it('keeps the storage fallback and ignores malformed or unrelated events',async()=>{
    await render();
    await act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'cuebook_active_scenario:anonymous',newValue:JSON.stringify({type:'scenario-active',scenarioId:'b',source:'other'})})));
    expect(receive).toHaveBeenCalledTimes(1);
    await act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'cuebook_active_scenario:anonymous',newValue:'invalid'})));
    await act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'other-key',newValue:'{}'})));
    expect(receive).toHaveBeenCalledTimes(1);
  });
});
