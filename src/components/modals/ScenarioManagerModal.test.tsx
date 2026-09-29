// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import type { User } from 'firebase/auth';
vi.mock('motion/react', () => ({AnimatePresence:({children}:{children:React.ReactNode})=>children,motion:{div:({children,className,role,...props}:React.HTMLAttributes<HTMLDivElement>)=><div className={className} role={role} aria-label={props['aria-label']}>{children}</div>}}));
import ScenarioManagerModal from './ScenarioManagerModal';
const entries = ['a','b'].map(scenarioId=>({scenarioId,title:scenarioId,updatedAt:0,availability:'available' as const,source:'both' as const}));
let root:Root; let container:HTMLDivElement;
const select=vi.fn(), close=vi.fn();
const target=()=>Array.from(container.querySelectorAll('button')).find(button=>button.textContent?.includes('bREADY'))!;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);select.mockReset();close.mockReset();container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(()=>root.unmount());container.remove();vi.unstubAllGlobals();});
const render=()=>act(()=>root.render(<ScenarioManagerModal isOpen onClose={close} user={{uid:'signed-in'} as User} entries={entries} currentScenarioId="a" isEditorMode={false} switching={false} onSelect={select} onToggleEditor={()=>{}} onImport={()=>{}} onExport={()=>{}}/>));
it('keeps the dialog open and blocks duplicate selections while switching is pending',async()=>{
  let finish!:(value:boolean)=>void;select.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));await render();
  await act(()=>target().click());expect(target().disabled).toBe(true);expect(container.textContent).toContain('切り替え中');expect(close).not.toHaveBeenCalled();
  await act(()=>target().click());expect(select).toHaveBeenCalledTimes(1);
  await act(()=>finish(false));expect(target().disabled).toBe(false);expect(container.textContent).toContain('まだ切り替わっていません');
});
it('shows failure and permits retry instead of silently disappearing',async()=>{
  select.mockRejectedValueOnce(new Error('storage failed')).mockResolvedValueOnce(true);await render();await act(()=>target().click());
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('失敗');expect(close).not.toHaveBeenCalled();
  await act(()=>target().click());expect(select).toHaveBeenCalledTimes(2);expect(container.querySelector('[role="alert"]')).toBeNull();
});

it('accepts a progress confirmation handoff without a stale waiting status',async()=>{
  select.mockResolvedValue('confirmation');await render();await act(()=>target().click());
  expect(select).toHaveBeenCalledTimes(1);
  expect(container.textContent).not.toContain('まだ切り替わっていません');
  expect(target().disabled).toBe(false);
});
