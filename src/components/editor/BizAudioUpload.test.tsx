// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { User } from 'firebase/auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const upload=vi.hoisted(()=>vi.fn());
vi.mock('../../services/R2AssetService',()=>({uploadR2Audio:upload,getR2StorageErrorMessage:(error:Error)=>error.message}));
import { BizAudioUpload } from './BizAudioUpload';
let root:Root;let container:HTMLDivElement;
const saved=vi.fn();const claim=vi.fn();
const user={uid:'owner',getIdTokenResult:claim} as unknown as User;
const updates={url:'r2://asset',storageProvider:'r2'};
const input=()=>container.querySelector('input') as HTMLInputElement;
async function render(account:User|null=user,scenarioId='scenario'){
  await act(async()=>{root.render(<BizAudioUpload user={account} scenarioId={scenarioId} onSaved={saved}/>);});
}
async function select(){
  Object.defineProperty(input(),'files',{configurable:true,value:[new File(['audio'],'rain.mp3',{type:'audio/mpeg'})]});
  await act(async()=>{input().dispatchEvent(new Event('change',{bubbles:true}));});
}
beforeEach(()=>{
  vi.clearAllMocks();vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.stubEnv('VITE_CUEBOOK_TENANT','xtv');
  claim.mockResolvedValue({claims:{cuebookPlan:'biz'}});upload.mockResolvedValue(updates);
  container=document.createElement('div');root=createRoot(container);
});
afterEach(async()=>{await act(()=>root.unmount());vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('Biz upload interaction',()=>{
  it.each(['','normal'])('hides storage on non-Biz bundles (%s)',async tenant=>{
    vi.stubEnv('VITE_CUEBOOK_TENANT',tenant);await render();expect(input()).toBeNull();
  });
  it('disables upload without login or a trusted Biz claim',async()=>{
    await render(null);expect(input().disabled).toBe(true);
    claim.mockResolvedValueOnce({claims:{cuebookPlan:'free'}});await render();expect(input().disabled).toBe(true);expect(upload).not.toHaveBeenCalled();
  });
  it('attaches the uploaded asset only after the server confirms it',async()=>{
    await render();await select();expect(saved).toHaveBeenCalledWith(updates);
    expect(container.querySelector('[role="status"]')?.textContent).toContain('保存しました');
    expect(upload).toHaveBeenCalledWith('scenario',expect.any(File));expect(input().value).toBe('');
  });
  it('reports failure, preserves the existing source and permits retry',async()=>{
    upload.mockRejectedValueOnce(new Error('容量上限'));await render();await select();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('容量上限');expect(saved).not.toHaveBeenCalled();expect(input().disabled).toBe(false);
    await select();expect(saved).toHaveBeenCalledOnce();expect(container.querySelector('[role="alert"]')).toBeNull();
  });
  it('prevents duplicate submissions and does not attach to an unmounted sound',async()=>{
    let finish!:(value:unknown)=>void;upload.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    await render();await select();expect(input().disabled).toBe(true);await select();expect(upload).toHaveBeenCalledOnce();
    await act(()=>root.render(null));await act(async()=>{finish(updates);await Promise.resolve();});expect(saved).not.toHaveBeenCalled();
  });
  it('does not attach an upload after the user logs out',async()=>{
    let finish!:(value:unknown)=>void;upload.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
    await render();await select();await render(null);await act(async()=>{finish(updates);await Promise.resolve();});expect(saved).not.toHaveBeenCalled();
  });
});
