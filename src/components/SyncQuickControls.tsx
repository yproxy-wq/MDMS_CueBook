import React from 'react';
import { Eye, EyeOff, MonitorUp, Settings2 } from 'lucide-react';
import { SyncConfig } from '../types';
import { isSyncTimerVisible } from '../utils/sessionSelectors';

interface SyncQuickControlsProps {
  syncConfig: SyncConfig;
  onSetTimerVisible: (visible: boolean) => void;
  onOpenSyncStudio: () => void;
  embedded?: boolean;
  className?: string;
}

export const SyncQuickControls: React.FC<SyncQuickControlsProps> = React.memo(({
  syncConfig,
  onSetTimerVisible,
  onOpenSyncStudio,
  embedded = false,
  className = '',
}) => {
  const timerVisible = isSyncTimerVisible(syncConfig);

  const controls = (
      <div className="sync-quick-controls__actions flex min-h-11 min-w-0 items-center gap-2">
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <MonitorUp size={15} className="text-sky-300" />
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">子画面</span>
        </div>

        <button
          type="button"
          aria-label={timerVisible ? '同期タイマーを非表示' : '同期タイマーを表示'}
          aria-pressed={timerVisible}
          onClick={() => onSetTimerVisible(!timerVisible)}
          className={timerVisible
            ? 'flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-sky-400/45 bg-sky-500/15 px-2.5 text-[11px] font-bold text-sky-100 transition-colors hover:bg-sky-500/25'
            : 'flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-bold text-white/55 transition-colors hover:text-white'}
        >
          {timerVisible ? <Eye size={15} /> : <EyeOff size={15} />}
          タイマー {timerVisible ? '表示中' : '非表示'}
        </button>

        <button
          type="button"
          aria-label="同期画面の詳細設定を開く"
          onClick={onOpenSyncStudio}
          className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-white/10 px-2 text-[10px] font-bold text-white/60 transition-colors hover:border-sky-300/35 hover:text-sky-100"
        >
          <Settings2 size={14} />
          <span className="hidden sm:inline">SYNC</span>
        </button>
      </div>
  );

  if (embedded) {
    return <div aria-label="プレイヤー同期のクイック操作" className={`sync-quick-controls flex shrink-0 text-white ${className}`}>{controls}</div>;
  }

  return (
    <section aria-label="プレイヤー同期のクイック操作" className="shrink-0 border-b border-white/10 bg-[#090a0c] px-3 py-1.5 text-white">
      {controls}
    </section>
  );
});

SyncQuickControls.displayName = 'SyncQuickControls';
