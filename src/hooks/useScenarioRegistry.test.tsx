// @vitest-environment jsdom
import React, { act, useEffect, useRef, useState } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState, Scenario } from '../types';
const cloud=vi.hoisted(()=>({read:vi.fn()}));
vi.mock('../services/StorageService',()=>({storageService:{listScenarioKeys:async()=>[],saveScenario:vi.fn(),loadScenario:async()=>null,loadBinding:async()=>null}}));
vi.mock('../services/ScenarioRegistryService',()=>({applyScenarioSettings:(scenario:Scenario,settings:object)=>({...scenario,...settings}),createScenarioBinding:vi.fn(),fingerprintScenario:async()=>'',readCloudScenarios:cloud.read}));
vi.mock('../services/ErrorLogger',()=>({errorLogger:{logOperationError:vi.fn()}}));
import { useScenarioRegistry } from './useScenarioRegistry';
let container:HTMLDivElement;
let root:Root;
let edit:(scenario:Scenario)=>void;
let resolveCloud:(entries:unknown[])=>void;
const original={id:'a',title:'A',layoutPreset:'tablet',phases:[]} as Scenario;
function Harness() {
  const [state,setState]=useState({currentScenario:original,syncConfig:{timerEnabled:true}} as AppState);
  const ref=useRef(state.currentScenario);
  useEffect(()=>{ref.current=state.currentScenario;edit=scenario=>setState(previous=>({...previous,currentScenario:scenario}));},[state.currentScenario]);
  useScenarioRegistry({isReady:true,user:null,currentScenarioRef:ref,setState});
  return <span>{state.currentScenario.id}:{state.currentScenario.layoutPreset}</span>;
}
beforeEach(async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  cloud.read.mockImplementation(()=>new Promise(resolve=>{resolveCloud=resolve;}));
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
  await act(()=>root.render(<Harness/>));
});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.unstubAllGlobals();});
describe('scenario settings loading boundaries',()=>{
  it('does not revert local layout changes with a late cloud read',async()=>{
    await act(()=>edit({...original,layoutPreset:'pc'}));
    await act(()=>resolveCloud([{scenarioId:'a',settings:{layoutPreset:'auto'}}]));
    expect(container.textContent).toBe('a:pc');
  });
  it('does not apply a response started for another scenario to the new scenario',async()=>{
    await act(()=>edit({...original,id:'b'}));
    await act(()=>resolveCloud([{scenarioId:'b',settings:{layoutPreset:'auto'}}]));
    expect(container.textContent).toBe('b:tablet');
  });
  it('restores cloud preferences when the target has not changed during the request',async()=>{
    await act(()=>resolveCloud([{scenarioId:'a',settings:{layoutPreset:'auto'}}]));
    expect(container.textContent).toBe('a:auto');
  });
});
