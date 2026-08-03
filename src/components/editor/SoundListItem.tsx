
import React from 'react';
import { SoundConfig, SoundType } from '../../types';
import { Music, Volume2, Repeat, Waves, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { audioService } from '../../services/AudioService';

interface SoundListItemProps {
  sound: SoundConfig;
  isSelected: boolean;
  onClick: () => void;
  onRemove: () => void;
  onMove: (dir: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
}

export const SoundListItem: React.FC<SoundListItemProps> = React.memo(({ 
  sound, isSelected, onClick, onRemove, onMove, isFirst, isLast 
}) => {
  return (
    <div 
      onClick={onClick}
      onMouseEnter={() => sound.url && audioService.preload([sound.url])}
      className={`group relative flex items-center gap-1.5 p-2 rounded-xl border transition-all cursor-pointer ${
        isSelected 
          ? 'bg-white/10 border-white/20 shadow-lg' 
          : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-white/5'
      }`}
    >
      <div className="flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); onMove('up'); }}
          disabled={isFirst}
          className="p-0 text-white/20 hover:text-white disabled:opacity-0"
        >
          <ArrowUp size={10} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onMove('down'); }}
          disabled={isLast}
          className="p-0 text-white/20 hover:text-white disabled:opacity-0"
        >
          <ArrowDown size={10} />
        </button>
      </div>

      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 relative ${
        sound.type === SoundType.BGM ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'
      }`}>
        <Music size={14} className={isSelected ? 'animate-bounce' : ''} />
        {isSelected && (
          <div className="absolute -inset-1 rounded-lg border border-sky-400/30 animate-pulse" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-white truncate">{sound.name || '無題の音源'}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[8px] font-black font-cinzel text-white/20 uppercase tracking-widest">{sound.type}</span>
          <div className="flex items-center gap-1 ml-auto">
            {sound.loopEnabled && <Repeat size={8} className="text-emerald-500/40" />}
            {(sound.fadeInEnabled || sound.fadeOutEnabled) && <Waves size={8} className="text-indigo-500/40" />}
            <div className="flex items-center gap-1 text-[9px] font-mono text-white/20">
              <Volume2 size={8} />
              {Math.round((sound.volume || 0) * 100)}%
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="p-1.5 text-white/10 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
});
