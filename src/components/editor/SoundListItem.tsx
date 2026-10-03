import React, { useState } from 'react';
import { Music, Trash2, ArrowUp, ArrowDown, MoreHorizontal } from 'lucide-react';
import { SoundConfig } from '../../types';
import { audioService } from '../../services/AudioService';
import { isR2AssetUrl } from '../../services/R2AssetService';
interface SoundListItemProps {
  sound: SoundConfig; isSelected: boolean; onClick: () => void; onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void; isFirst: boolean; isLast: boolean;
}
export const SoundListItem: React.FC<SoundListItemProps> = React.memo(({ sound, isSelected, onClick, onRemove, onMove, isFirst, isLast }) => {
  const [showActions, setShowActions] = useState(false);
  const name = sound.name || '無題の音源';
  return <div className={isSelected ? 'rounded-lg border border-emerald-300/40 bg-emerald-300/5' : 'rounded-lg border border-white/10 bg-white/[0.02]'}>
    <div className="flex items-center gap-1">
      <button type="button" aria-label={name + 'を選択'} aria-pressed={isSelected} onClick={onClick}
        onMouseEnter={() => sound.url && !isR2AssetUrl(sound.url) && audioService.preload([sound.url])}
        className="flex min-h-[64px] min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/5">
        <Music size={18} className="shrink-0 text-emerald-200/70" />
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-white/90">{name}</span>
          <span className="mt-1 block text-xs text-white/50"><span className="font-mono">{sound.type}</span> · {Math.round((sound.volume ?? 1) * 100)}%{sound.loopEnabled ? ' · ループ' : ''}</span>
        </span>
      </button>
      <button type="button" aria-label={name + 'の操作'} aria-expanded={showActions} onClick={() => setShowActions(value => !value)}
        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/10"><MoreHorizontal size={18} /></button>
    </div>
    {showActions && <div className="flex flex-wrap gap-1 border-t border-white/10 p-1" aria-label={name + 'の操作一覧'}>
      <button type="button" disabled={isFirst} aria-label={name + 'を上へ移動'} onClick={() => onMove('up')} className="flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-1 rounded text-xs text-white/70 disabled:opacity-30"><ArrowUp size={14} />上へ</button>
      <button type="button" disabled={isLast} aria-label={name + 'を下へ移動'} onClick={() => onMove('down')} className="flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-1 rounded text-xs text-white/70 disabled:opacity-30"><ArrowDown size={14} />下へ</button>
      <button type="button" aria-label={name + 'を削除'} onClick={onRemove} className="flex min-h-[44px] min-w-[44px] flex-1 items-center justify-center gap-1 rounded text-xs text-red-300"><Trash2 size={14} />削除</button>
    </div>}
  </div>;
});
