import React, { useEffect, useMemo, useState } from 'react';
import { Music2, Play, Settings2, Square, X } from 'lucide-react';
import { Phase, SoundConfig, SoundType } from '../types';
import { selectViewedPhaseRecommendedBgmSounds } from '../utils/sessionSelectors';

interface RecommendedBgmDockProps {
  phase: Phase | null | undefined;
  sounds: SoundConfig[];
  isPlaying: Record<string, boolean>;
  themeColor: string;
  onToggleSound: (sound: SoundConfig) => void;
  onUpdateRecommendedSounds: (phaseId: string, soundIds: string[]) => void;
  children?: React.ReactNode;
  placement?: 'bar' | 'topbar';
}

export const RecommendedBgmDock: React.FC<RecommendedBgmDockProps> = React.memo(({
  phase,
  sounds,
  isPlaying,
  themeColor,
  onToggleSound,
  onUpdateRecommendedSounds,
  children,
  placement = 'bar',
}) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const bgmSounds = useMemo(
    () => sounds.filter((sound) => sound.type === SoundType.BGM),
    [sounds],
  );
  const recommendedBgms = useMemo(
    () => selectViewedPhaseRecommendedBgmSounds(sounds, phase),
    [sounds, phase],
  );
  const primaryBgm = recommendedBgms.find((sound) => isPlaying[sound.id]) || recommendedBgms[0];
  const primaryBgmPlaying = primaryBgm ? !!isPlaying[primaryBgm.id] : false;

  useEffect(() => {
    if (!isSettingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSettingsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSettingsOpen]);

  const toggleRecommendation = (soundId: string) => {
    if (!phase) return;
    const currentIds = new Set(phase.recommendedSounds || []);
    if (currentIds.has(soundId)) currentIds.delete(soundId);
    else currentIds.add(soundId);

    const bgmIds = new Set(bgmSounds.map((sound) => sound.id));
    const preservedNonBgmIds = (phase.recommendedSounds || []).filter((id) => !bgmIds.has(id));
    const nextBgmIds = bgmSounds
      .filter((sound) => currentIds.has(sound.id))
      .map((sound) => sound.id);
    onUpdateRecommendedSounds(phase.id, [...preservedNonBgmIds, ...nextBgmIds]);
  };

  const bgmControl = (
    <div className={placement === 'topbar' ? 'contents' : 'flex min-w-0 shrink items-stretch overflow-hidden rounded-lg border border-white/10 bg-white/[0.035]'}>
            <button
              type="button"
              aria-label={primaryBgm ? primaryBgm.name + 'を' + (primaryBgmPlaying ? '停止' : '再生') : '推奨BGMを選ぶ'}
              aria-pressed={primaryBgm ? primaryBgmPlaying : undefined}
              onClick={() => primaryBgm ? onToggleSound(primaryBgm) : setIsSettingsOpen(true)}
              disabled={!phase}
              className={(primaryBgmPlaying
                ? 'flex min-h-11 min-w-0 items-center gap-2 bg-emerald-500/15 px-3 text-left text-emerald-100 transition-colors'
                : 'flex min-h-11 min-w-0 items-center gap-2 px-3 text-left text-white/80 transition-colors hover:bg-white/[0.045] disabled:opacity-30')
                + (placement === 'topbar' ? ' order-1 rounded-lg border border-white/10 bg-[#121214]' : '')}
              style={primaryBgmPlaying ? { boxShadow: '0 0 14px ' + themeColor + '33' } : undefined}
            >
              {primaryBgmPlaying
                ? <Square size={13} fill="currentColor" className="shrink-0" />
                : primaryBgm
                  ? <Play size={14} fill="currentColor" className="shrink-0 text-amber-300" />
                  : <Music2 size={15} className="shrink-0 text-amber-300" />}
              <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold">
                <span className="max-w-48 truncate">{primaryBgm?.name || 'BGMを選ぶ'}</span>
                {primaryBgm && (
                  <span className="shrink-0 text-[9px] font-black text-current/60">
                    {primaryBgmPlaying ? '停止' : '再生'}
                  </span>
                )}
                {recommendedBgms.length > 1 && <span className="shrink-0 text-white/35">+{recommendedBgms.length - 1}</span>}
              </span>
            </button>
            <button
              type="button"
              aria-label="推奨BGMを変更"
              onClick={() => setIsSettingsOpen(true)}
              disabled={!phase}
              className={'flex min-h-11 w-10 shrink-0 items-center justify-center text-white/45 transition-colors hover:bg-amber-500/10 hover:text-amber-200 disabled:opacity-30 '
                + (placement === 'topbar' ? 'order-3 rounded-lg border border-white/10 bg-[#121214]' : 'border-l border-white/10')}
            >
              <Settings2 size={14} />
            </button>
    </div>
  );

  return (
    <>
      {placement === 'topbar' ? bgmControl : (
        <section aria-label="ライブ操作" className="shrink-0 border-b border-white/10 bg-[#0a0a0b] px-3 py-1.5 text-white">
          <div className="flex min-h-11 items-center justify-between gap-2 overflow-hidden">
            {bgmControl}

            {children && (
              <div className="flex min-w-0 items-center justify-end gap-2">
                {children}
              </div>
            )}
          </div>
        </section>
      )}

      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-[700] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={() => setIsSettingsOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="推奨BGMを設定"
            className="w-full max-w-md rounded-2xl border border-amber-300/20 bg-[#0c0c0e] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.8)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-300/70">推奨BGM設定</p>
                <h2 className="mt-1 text-sm font-bold text-white">{phase?.name || '台本未選択'}</h2>
              </div>
              <button
                type="button"
                aria-label="推奨BGM設定を閉じる"
                onClick={() => setIsSettingsOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mb-3 text-xs leading-relaxed text-white/45">
              このフェーズを表示している間に、常駐欄へ出すBGMを選びます。SEの推奨設定は保持されます。
            </p>

            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {bgmSounds.map((sound) => {
                const selected = (phase?.recommendedSounds || []).includes(sound.id);
                return (
                  <label
                    key={sound.id}
                    className={selected
                      ? 'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-amber-300/45 bg-amber-500/10 px-3 py-2 text-white transition-colors'
                      : 'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-white/60 transition-colors'}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleRecommendation(sound.id)}
                      className="h-4 w-4 accent-amber-400"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{sound.name}</span>
                    {selected && <span className="text-[9px] font-black text-amber-200">常駐</span>}
                  </label>
                );
              })}
              {!bgmSounds.length && (
                <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/40">
                  音源一覧にBGMを追加すると、ここで選べます。
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
});

RecommendedBgmDock.displayName = 'RecommendedBgmDock';
