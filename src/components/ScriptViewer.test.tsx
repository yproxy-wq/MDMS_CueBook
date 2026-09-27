// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ScriptViewer from './ScriptViewer';
import PhaseCard from './PhaseCard';
import { INITIAL_SCENARIO } from '../constants';
import { Phase, ScriptBlock } from '../types';
import { htmlToMarkdown, renderMarkdown } from '../utils/markdown';

vi.mock('./QuickNote', () => ({ QuickNote: () => null }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const makePhase = (blocks: ScriptBlock[]): Phase => ({
  ...INITIAL_SCENARIO.phases[0], id: 'test-phase', script: '', scriptBlocks: blocks, checklists: [],
});

async function show(phase: Phase, activeImageId?: string) {
  await act(() => root.render(
    <ScriptViewer phase={phase} scenario={INITIAL_SCENARIO} activeImageId={activeImageId} />,
  ));
}

describe('ScriptViewer tablet regressions', () => {
  it('folds only one outline branch and block', async () => {
    await show(makePhase([
      { id: 'one', type: 'outline', content: '# A\n## A child\n# B\n## B child' },
      { id: 'two', type: 'outline', content: '# C\n## C child' },
    ]));
    await act(() => (container.querySelector('[aria-label="折り畳む: A"]') as HTMLButtonElement).click());
    expect(container.textContent).not.toContain('A child');
    expect(container.textContent).toContain('B child');
    expect(container.textContent).toContain('C child');
  });

  it('keeps details state when the projected image changes', async () => {
    const phase = makePhase([{ id: 'md', type: 'markdown', content: '<details><summary>A</summary>Body [[image-a]]</details>\n<details><summary>B</summary>Other</details>' }]);
    await show(phase);
    const details = container.querySelector('details')!;
    details.open = true;
    await show(phase, 'image-a');
    expect(container.querySelector('details')).toBe(details);
    expect(details.open).toBe(true);
    expect(container.querySelector('.image-sync-btn')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps nested and sibling details through an editor round trip', () => {
    const html = '<details open><summary>A</summary><p>A body</p><details><summary>Inner</summary><p>Inner body</p></details></details><details><summary>B</summary><p>B body</p></details>';
    const target = document.createElement('div');
    target.innerHTML = renderMarkdown(htmlToMarkdown(html));
    expect(target.querySelectorAll('details')).toHaveLength(3);
    expect(target.querySelector('details')?.open).toBe(true);
    expect(target.textContent).toContain('Inner body');
    expect(target.children).toHaveLength(2);
  });

  it('mounts only the first 15 long-script blocks until requested', async () => {
    const blocks = Array.from({ length: 120 }, (_, index) => ({
      id: String(index), type: 'markdown' as const, content: `Paragraph ${index}`,
    }));
    await show(makePhase(blocks));
    expect(container.querySelectorAll('.script-block-item')).toHaveLength(15);
    const more = [...container.querySelectorAll('button')].find(button => button.textContent === '続きを表示')!;
    await act(() => more.click());
    expect(container.querySelectorAll('.script-block-item')).toHaveLength(30);
  });

  it('shows only the selected text blocks in the local player reading view', async () => {
    await show(makePhase([
      { id: 'first', type: 'markdown', content: 'プレイヤーに見せる本文' },
      { id: 'second', type: 'markdown', content: 'GMだけの本文' },
      { id: 'image', type: 'image', content: 'gm-image' },
    ]));
    const selection = container.querySelector('[aria-label="プレイヤー表示に追加: first"]') as HTMLButtonElement;
    await act(() => selection.click());
    const open = container.querySelector('[aria-label="選択した本文をプレイヤー表示する"]') as HTMLButtonElement;
    await act(() => open.click());

    const playerView = document.body.querySelector('[aria-label="プレイヤー本文表示"]')!;
    expect(playerView.textContent).toContain('プレイヤーに見せる本文');
    expect(playerView.textContent).not.toContain('GMだけの本文');
    expect(playerView.textContent).not.toContain('gm-image');
  });

  it('omits character list, flags, and individual notification controls from the GM viewer', async () => {
    await show(makePhase([{ id: 'md', type: 'markdown', content: 'GM本文' }]));
    expect(container.textContent).not.toContain('Characters');
    expect(container.textContent).not.toContain('個別通知');
    expect(container.querySelector('[title="Share Individual Notification"]')).toBeNull();
  });

  it('phase tabs only select a script, including repeated locked-phase taps', async () => {
    const preview = vi.fn();
    const forbidden = vi.fn();
    await act(() => root.render(
      <PhaseCard phase={{ ...makePhase([]), isLockedByPrevious: true }} index={0} isActive={false}
        isPreview={false} unlocked={false} themeColor="#123456" runningSeconds={0}
        onPreview={preview} onActivate={forbidden} onToggleTimer={forbidden}
        onSetCompleted={forbidden} onOpenDetails={forbidden} />,
    ));
    const button = container.querySelector('button')!;
    await act(() => { button.click(); button.click(); });
    expect(preview).toHaveBeenCalledTimes(2);
    expect(forbidden).not.toHaveBeenCalled();
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });
});
