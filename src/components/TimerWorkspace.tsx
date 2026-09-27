import React from 'react';
import { AppState, Phase, TimerConfig } from '../types';
import { useDisplayNow } from '../hooks/useDisplayNow';

const TimerAction = React.memo(({ timer, state, prefix, onToggle, onReset, compact = false }: {
  timer: TimerConfig; state?: AppState['timerStates'][string]; prefix?: string;
  onToggle: (id: string) => void; onReset: (id: string) => void;
  compact?: boolean;
}) => {
  const now = useDisplayNow(250, !!state?.isRunning);
  const seconds = Math.max(0, state?.isRunning && state.startTime != null
    ? state.seconds - Math.max(0, now - state.startTime) / 1000 : state?.seconds ?? timer.durationMinutes * 60);
  return <div className={'flex min-h-11 items-center gap-2 shrink-0 rounded-lg border border-white/15 px-2 bg-white/5 ' + (compact ? 'max-w-md' : '')}>
    <span className={(compact ? 'max-w-28 truncate' : 'max-w-48 whitespace-normal') + ' text-xs font-sans'}>{prefix}{timer.label}</span>
    <span className="font-mono text-sm font-bold tabular-nums">{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(Math.floor(seconds % 60)).padStart(2, '0')}</span>
    <button type="button" className="min-h-11 px-1.5 text-xs font-bold text-emerald-300" onClick={() => onToggle(timer.id)}
      aria-label={timer.label + (state?.isRunning ? 'を一時停止' : 'を開始・再開')}>{state?.isRunning ? '一時停止' : '開始・再開'}</button>
    <button type="button" className="min-h-11 px-1.5 text-[10px] text-white/55" onClick={() => onReset(timer.id)} aria-label={timer.label + 'をリセット'}>リセット</button>
  </div>;
});

export const TimerWorkspace = React.memo(({ phase, phases, timerStates, onToggle, onReset, embedded = false }: {
  phase?: Phase; phases: Phase[]; timerStates: AppState['timerStates'];
  onToggle: (id: string) => void; onReset: (id: string) => void;
  embedded?: boolean;
}) => {
  const timers = <div className={'flex gap-2 overflow-x-auto phase-tab-track ' + (embedded ? 'min-w-0' : '')}>
    {(phase?.timers || []).map(timer => <TimerAction key={timer.id} timer={timer} state={timerStates[timer.id]} onToggle={onToggle} onReset={onReset} compact={embedded} />)}
    {!phase?.timers?.length && <span className="text-xs py-2 text-white/50">この台本にはタイマーがありません</span>}
    {phases.filter(item => item.id !== phase?.id).flatMap(item => (item.timers || []).filter(timer => timerStates[timer.id]?.isRunning).map(timer =>
      <TimerAction key={timer.id} timer={timer} state={timerStates[timer.id]} prefix={item.name + ' / '} onToggle={onToggle} onReset={onReset} compact={embedded} />))}
  </div>;

  if (embedded) {
    return <div aria-label="タイマー操作" className="min-w-0 border-l border-white/10 pl-2 text-white">{timers}</div>;
  }

  return <section aria-label="タイマー操作" className="shrink-0 bg-zinc-950 border-b border-white/10 px-3 py-1.5 text-white">
    <div className="text-xs font-sans text-white/60 mb-1">タイマー · {phase?.name || '台本未選択'}</div>
    {timers}
  </section>;
});
