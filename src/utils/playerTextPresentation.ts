import { Phase, ScriptBlock } from '../types';

export type PlayerTextBlock = Pick<ScriptBlock, 'id' | 'type' | 'content' | 'label'>;

export const isPlayerTextBlock = (block: PlayerTextBlock): boolean =>
  block.type === 'markdown' || block.type === 'outline';

/**
 * Returns only blocks that can be shown in the local player reading view.
 * Media blocks intentionally remain excluded: the reading view must never
 * expose GM-only media controls or a file browser.
 */
export const getPlayerTextBlocks = (phase: Phase): PlayerTextBlock[] => {
  const blocks = (phase.scriptBlocks || []).filter(isPlayerTextBlock);
  if (blocks.length > 0) return blocks;

  return phase.script.trim()
    ? [{ id: 'legacy-script', type: 'markdown', content: phase.script, label: phase.name }]
    : [];
};

export const selectPlayerTextBlocks = (
  phase: Phase,
  selectedIds: ReadonlySet<string>,
): PlayerTextBlock[] => getPlayerTextBlocks(phase).filter((block) => selectedIds.has(block.id));
