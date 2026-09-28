// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SoundType, SoundConfig } from '../../types';
vi.mock('../../services/AudioService',()=>({audioService:{
  getPlaybackStats:vi.fn(()=>({current:12.5,duration:60,isLoading:false})),
  isPlaying:vi.fn(()=>false),
  resetToStart:vi.fn(),
}}));
vi.mock('motion/react',()=>({
  AnimatePresence:({children}:{children:React.ReactNode})=>children,
  motion:{
    div:({children,className}:{children:React.ReactNode;className?:string})=><div className={className}>{children}</div>,
    button:({children,onClick,disabled,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>)=><button onClick={onClick} disabled={disabled} aria-label={props['aria-label']}>{children}</button>,
  },
}));
import { SoundSettingsPanel } from './SoundSettingsPanel';
let container:HTMLDivElement;
let root:Root;
const update=vi.fn();
const preview=vi.fn();
const sound:SoundConfig={id:'sound-a',name:'雨',url:'https://example.com/rain.mp3',type:SoundType.BGM,volume:0.5,fadeInEnabled:true,fadeInDuration:3,fadeOutEnabled:false,loopEnabled:false};
async function render(value=sound){
  await act(()=>root.render(<SoundSettingsPanel sound={value} onUpdate={update} onRemove={vi.fn()} previewingSoundId={null} onTogglePreview={preview}/>));
}
function input(label:string){return container.querySelector('[aria-label="'+label+'"]') as HTMLInputElement;}
async function setInput(element:HTMLInputElement|HTMLSelectElement,value:string){
  const proto=element instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto,'value')!.set!.call(element,value);
  await act(()=>element.dispatchEvent(new Event('change',{bubbles:true})));
}
beforeEach(async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  update.mockClear();preview.mockClear();
  container=document.createElement('div');document.body.append(container);
  root=createRoot(container);await render();
});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.unstubAllGlobals();});
describe('sound settings disclosure',()=>{
  it('starts with four closed summaries and keeps preview available',async()=>{
    const details=Array.from(container.querySelectorAll('details'));
    expect(details).toHaveLength(4);
    expect(details.every(detail=>!detail.open)).toBe(true);
    expect(details.map(detail=>detail.querySelector('summary')!.textContent)).toEqual([
      '再生範囲0秒 → 最後まで','ループOFF','フェードイン 3秒 · アウト OFF','排他グループ指定なし',
    ]);
    expect(input('音源URL').value).toBe(sound.url);
    await act(()=>(container.querySelector('[aria-label="音源を試聴"]') as HTMLButtonElement).click());
    expect(preview).toHaveBeenCalledWith(sound);
  });
  it('retains loop values and the open section when its enabled state changes',async()=>{
    const detail=container.querySelectorAll('details')[1];
    detail.open=true;
    expect(container.querySelector('[aria-label="ループ開始を現在の再生位置から設定"]')).toBeNull();
    await render({...sound,loopEnabled:true,loopStart:5,loopEnd:25});
    expect(detail.open).toBe(true);
    expect(detail.querySelector('summary')!.textContent).toContain('5秒 → 25秒');
    await act(()=>(container.querySelector('[aria-label="ループ開始を現在の再生位置から設定"]') as HTMLButtonElement).click());
    expect(update).toHaveBeenCalledWith({loopStart:12.5});
  });
  it('keeps curve and exclusion-group edits on the existing update callback',async()=>{
    await setInput(container.querySelector('[aria-label="フェードインの曲線"]') as HTMLSelectElement,'ease-in-out');
    expect(update).toHaveBeenCalledWith({fadeInCurve:'ease-in-out'});
    await setInput(container.querySelector('[aria-label="排他グループ"]') as HTMLSelectElement,'blue');
    expect(update).toHaveBeenCalledWith({chokeGroup:'blue'});
  });
});
