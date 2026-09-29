import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SoundConfig, SoundType } from '../../types';
import { audioService } from '../../services/AudioService';
import { buildFadeCurvePath, FADE_CURVES, normalizeFadeCurve } from '../../utils/fadeCurve';
import {
  Volume2, Link, Upload, Trash2,
  Play, Pause,
  Music, Radio, SkipBack, ChevronDown, MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PlaybackMonitorProps {
  sound: SoundConfig;
  previewingSoundId: string | null;
  onTogglePreview: (sound: SoundConfig) => void;
}

const PlaybackMonitor: React.FC<PlaybackMonitorProps> = React.memo(({ sound, previewingSoundId, onTogglePreview }) => {
  const [playbackStats, setPlaybackStats] = useState<{current: number, duration: number, isLoading: boolean} | null>(null);
  const isTarget = previewingSoundId === sound.id;

  useEffect(() => {
    if (!isTarget) return;

    const interval = setInterval(() => {
      const stats = audioService.getPlaybackStats(sound.id);
      if (stats) setPlaybackStats(stats as { current: number, duration: number, isLoading: boolean });
    }, 100);
    return () => {
      clearInterval(interval);
      setPlaybackStats(null); // Clear on cleanup
    };
  }, [isTarget, sound.id]);

  const displayStats = isTarget ? playbackStats : null;
  const isLoading = isTarget && (!displayStats || displayStats.isLoading);
  const formatSec = (s: number = 0) => s.toFixed(2);
  const isPlaying = isTarget && audioService.isPlaying(sound.id);

  return (
    <div className="flex flex-col gap-4 relative">
      <div className="flex items-center gap-4">
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading}
            onClick={() => audioService.resetToStart(sound.id)}
            className={`w-[44px] h-[44px] rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center shadow-lg ${isLoading && 'opacity-20'}`}
            aria-label="再生位置を先頭に戻す"
            title="最初から再生箇所を戻す"
          >
            <SkipBack size={24} fill="currentColor" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading}
            aria-label={isPlaying ? '試聴を一時停止' : '音源を試聴'}
            onClick={() => onTogglePreview(sound)}
            className={`w-[44px] h-[44px] rounded-lg transition-all shrink-0 flex items-center justify-center shadow-lg ${isLoading ? 'bg-white/5 text-white/20' : isPlaying ? 'bg-white text-black ring-4 ring-white/20' : 'bg-sky-500 text-white shadow-sky-500/20'}`}
          >
            {isLoading ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full"
              />
            ) : isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
          </motion.button>
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex justify-between items-end px-1 border-b border-white/5 pb-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[14px] font-mono font-black text-white">{isLoading ? "--.--" : formatSec(displayStats?.current)}</span>
              <span className="text-xs font-mono text-white/50">/ {isLoading ? "--.--" : formatSec(displayStats?.duration)}s</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-sky-400/50' : isPlaying ? 'bg-sky-400 animate-pulse' : 'bg-white/10'}`} />
              <span className={`text-xs font-medium ${isLoading ? 'text-sky-400/50' : isPlaying ? 'text-sky-400' : 'text-white/20'}`}>
                {isLoading ? 'PRELOADING' : isPlaying ? 'MONITORING' : isTarget ? 'PAUSED' : 'READY'}
              </span>
            </div>
          </div>

          <div
            className={`relative h-5 bg-white/5 rounded-lg overflow-hidden border border-white/5 shadow-inner mt-1 ${isLoading ? 'cursor-wait' : 'cursor-pointer group/seekbar'}`}
            onClick={(e) => {
              if (!displayStats || isLoading) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              const seekTime = percent * displayStats.duration;
              audioService.seek(sound.id, seekTime);
            }}
          >
            {isLoading && (
              <motion.div
                animate={{ x: ['-100%', '100%'] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-sky-400/10 to-transparent w-full"
              />
            )}
            {displayStats && displayStats.duration > 0 && (
              <div className="absolute inset-0 pointer-events-none">
                {sound.fadeInEnabled && sound.fadeInDuration && (
                  <div
                    className="absolute top-0 bottom-0 bg-gradient-to-r from-red-500/10 to-transparent z-0"
                    style={{
                      left: `${((sound.startTime || 0) / displayStats.duration) * 100}%`,
                      width: `${(sound.fadeInDuration / displayStats.duration) * 100}%`
                    }}
                  />
                )}
                {sound.fadeOutEnabled && sound.fadeOutDuration && (
                  <div
                    className="absolute top-0 bottom-0 bg-gradient-to-l from-red-500/10 to-transparent z-0"
                    style={{
                      left: `${(((sound.endTime || displayStats.duration) - (sound.fadeOutDuration || 0)) / displayStats.duration) * 100}%`,
                      width: `${(sound.fadeOutDuration / displayStats.duration) * 100}%`
                    }}
                  />
                )}
                {sound.loopEnabled && sound.loopStart !== undefined && sound.loopEnd && (
                  <div
                    className="absolute top-0 bottom-0 bg-white/5 z-0 border-x border-white/10"
                    style={{
                      left: `${(sound.loopStart / displayStats.duration) * 100}%`,
                      width: `${((sound.loopEnd - sound.loopStart) / displayStats.duration) * 100}%`
                    }}
                  />
                )}
                {[
                  { val: sound.startTime },
                  { val: sound.endTime },
                  { val: sound.loopStart, enabled: sound.loopEnabled },
                  { val: sound.loopEnd, enabled: sound.loopEnabled }
                ].map((m, idx) => (
                  m.val !== undefined && m.val > 0 && (m.enabled === undefined || m.enabled) && (
                    <div
                      key={idx}
                      className="absolute top-0 bottom-0 w-[1px] bg-white/30 z-10"
                      style={{ left: `${(m.val / displayStats.duration) * 100}%` }}
                    />
                  )
                ))}
              </div>
            )}
            <motion.div
              initial={false}
              animate={{ width: `${displayStats ? (displayStats.current / displayStats.duration) * 100 : 0}%` }}
              transition={{ type: 'tween', ease: 'linear', duration: 0.1 }}
              className="absolute top-0 left-0 h-full bg-white/20 z-[5]"
            />
          </div>
        </div>
      </div>
    </div>
  );
});

// Details stay local to the selected sound; audio mutations use existing callbacks.
const SoundSettingSection = React.memo(function SoundSettingSection({
  title, summary, children,
}: { title: string; summary: string; children: React.ReactNode }) {
  return (
    <details className="group/setting border-b border-white/10 last:border-b-0">
      <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 py-3 text-sm text-white/90 [&::-webkit-details-marker]:hidden">
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-white/40 transition-transform group-open/setting:rotate-180" />
        <span className="font-medium">{title}</span>
        <span className="ml-auto max-w-[60%] text-right text-xs text-white/55">{summary}</span>
      </summary>
      <div className="pb-5 pl-0 sm:pl-7">{children}</div>
    </details>
  );
});

const formatSeconds = (value = 0) => `${Number(value.toFixed(2))}秒`;
const formatEnd = (value?: number) => value ? formatSeconds(value) : '最後まで';

const SettingInput = React.memo(function SettingInput({
  label, val, onUpdate, onCapture, disabled = false,
}: { label: string; val: number; onUpdate: (value: number) => void; onCapture: () => void; disabled?: boolean }) {
  return <label className="block min-w-0 space-y-2 text-xs text-white/60">
    <span>{label}</span>
    <span className="flex items-center gap-2">
      <input type="number" min="0" step="0.1" value={val} disabled={disabled}
        onChange={event => onUpdate(Math.max(0, Number(event.target.value) || 0))}
        className="min-h-[44px] w-full min-w-0 rounded-lg border border-white/10 bg-zinc-950 px-3 font-mono text-base text-white disabled:opacity-40" />
      <span>秒</span>
      <button type="button" aria-label={label + 'を現在の再生位置から設定'} disabled={disabled} onClick={onCapture}
        className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-sky-300 disabled:opacity-40"
        title="現在の再生位置を使う"><MapPin size={16} aria-hidden="true" /></button>
    </span>
  </label>;
});

type RangeProps = { sound: SoundConfig; onUpdate: (updates: Partial<SoundConfig>) => void; captureTime: (field: 'startTime' | 'endTime' | 'loopStart' | 'loopEnd') => void };
const RangeSettings = React.memo(function RangeSettings({sound, onUpdate, captureTime}: RangeProps) {
  return <SoundSettingSection title="再生範囲" summary={formatSeconds(sound.startTime) + ' → ' + formatEnd(sound.endTime)}>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <SettingInput label="開始" val={sound.startTime || 0} onUpdate={value => onUpdate({startTime:value})} onCapture={() => captureTime('startTime')} />
      <div><SettingInput label="終了" val={sound.endTime || 0} onUpdate={value => onUpdate({endTime:value})} onCapture={() => captureTime('endTime')} /><p className="mt-2 text-xs text-white/40">0秒で最後まで再生</p></div>
    </div>
  </SoundSettingSection>;
});
const LoopSettings = React.memo(function LoopSettings({sound, onUpdate, captureTime}: RangeProps) {
  return <SoundSettingSection title="ループ" summary={sound.loopEnabled ? formatSeconds(sound.loopStart) + ' → ' + formatEnd(sound.loopEnd) : 'OFF'}>
    <label className="mb-3 flex min-h-[44px] items-center gap-3 text-sm text-white/80">
      <input type="checkbox" checked={Boolean(sound.loopEnabled)} onChange={event => onUpdate({loopEnabled:event.target.checked})} className="h-5 w-5 accent-sky-400" />ループを有効にする
    </label>
    {sound.loopEnabled && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <SettingInput label="ループ開始" val={sound.loopStart || 0} onUpdate={value => onUpdate({loopStart:value})} onCapture={() => captureTime('loopStart')} />
      <div><SettingInput label="ループ終了" val={sound.loopEnd || 0} onUpdate={value => onUpdate({loopEnd:value})} onCapture={() => captureTime('loopEnd')} /><p className="mt-2 text-xs text-white/40">0秒で最後まで繰り返す</p></div>
    </div>}
  </SoundSettingSection>;
});
const FadeSettings = React.memo(function FadeSettings({sound, onUpdate}: {sound:SoundConfig; onUpdate:(updates:Partial<SoundConfig>)=>void}) {
  const controls = [
    { field:'fadeIn' as const, label:'イン', enabled:sound.fadeInEnabled, duration:sound.fadeInDuration, curve:sound.fadeInCurve },
    { field:'fadeOut' as const, label:'アウト', enabled:sound.fadeOutEnabled, duration:sound.fadeOutDuration, curve:sound.fadeOutCurve },
  ];
  const summary = controls.map(control => control.label + ' ' + (control.enabled ? formatSeconds(control.duration) : 'OFF')).join(' · ');
  return <SoundSettingSection title="フェード" summary={summary}>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {controls.map(control => <div key={control.field} className="min-w-0 space-y-3">
        <label className="flex min-h-[44px] items-center gap-3 text-sm text-white/80">
          <input type="checkbox" checked={Boolean(control.enabled)} onChange={event => onUpdate({[control.field + 'Enabled']:event.target.checked})} className="h-5 w-5 accent-sky-400" />フェード{control.label}
        </label>
        {control.enabled && <>
          <SettingInput label={'フェード' + control.label + '時間'} val={control.duration || 0}
            onUpdate={value => onUpdate({[control.field + 'Duration']:value})}
            onCapture={() => {
              const stats=audioService.getPlaybackStats(sound.id);
              if (!stats) return;
              const value=control.field === 'fadeIn' ? stats.current - (sound.startTime || 0) : (sound.endTime || stats.duration) - stats.current;
              onUpdate({[control.field + 'Duration']:Math.round(Math.max(0,value)*100)/100});
            }} />
          <label className="block space-y-2 text-xs text-white/60">変化のしかた
            <select aria-label={'フェード' + control.label + 'の曲線'} value={normalizeFadeCurve(control.curve)}
              onChange={event => onUpdate({[control.field + 'Curve']:event.target.value})}
              className="mt-2 min-h-[44px] w-full rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white">
              {FADE_CURVES.map(curve => <option key={curve.value} value={curve.value}>{curve.label}</option>)}
            </select>
          </label>
          <svg viewBox="0 0 96 32" role="img" aria-label={'フェード' + control.label + 'の変化曲線'} className="h-10 w-full text-sky-300">
            <path d={buildFadeCurvePath(normalizeFadeCurve(control.curve),control.field==='fadeIn'?'in':'out')} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
        </>}
      </div>)}
    </div>
  </SoundSettingSection>;
});

interface SoundSettingsPanelProps {
  sound: SoundConfig;
  onUpdate: (updates: Partial<SoundConfig>) => void;
  onRemove: () => void;
  previewingSoundId: string | null;
  onTogglePreview: (sound: SoundConfig) => void;
}

export const SoundSettingsPanel: React.FC<SoundSettingsPanelProps> = React.memo(({
  sound, onUpdate, onRemove, previewingSoundId, onTogglePreview
}) => {
  const nameTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const urlTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingEditsRef = useRef<Partial<SoundConfig>>({});
  const latestUpdateRef = useRef(onUpdate);
  useEffect(() => { latestUpdateRef.current = onUpdate; }, [onUpdate]);
  const flushEdits = useCallback(() => {
    if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
    if (urlTimeoutRef.current) clearTimeout(urlTimeoutRef.current);
    const updates = pendingEditsRef.current;
    pendingEditsRef.current = {};
    if (Object.keys(updates).length) latestUpdateRef.current(updates);
  }, []);
  useEffect(() => () => {
    if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
    if (urlTimeoutRef.current) clearTimeout(urlTimeoutRef.current);
    pendingEditsRef.current = {};
  }, [sound.id]);
  const captureTime = useCallback((field: 'startTime' | 'endTime' | 'loopStart' | 'loopEnd') => {
    const stats = audioService.getPlaybackStats(sound.id);
    if (stats) onUpdate({ [field]: Math.round(stats.current * 100) / 100 });
  }, [sound.id, onUpdate]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={sound.id}
        initial={{ opacity: 0, scale: 0.98, translateY: 10 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        exit={{ opacity: 0, scale: 0.98, translateY: -10 }}
        transition={{ duration: 0.1, ease: "easeOut" }}
        className="sound-settings-panel flex flex-col bg-zinc-950 border border-white/10 rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="py-3 px-5 border-b border-white/5 bg-gradient-to-r from-zinc-900 to-zinc-950 flex items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl border ${sound.type === SoundType.BGM ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
              {sound.type === SoundType.BGM ? <Music size={16} /> : <Radio size={16} />}
            </div>
              <div className="flex-1 min-w-0">
               <input
                 aria-label="音源名"
                 onBlur={flushEdits}
                 defaultValue={sound.name || ''}
                 onChange={e => {
                   const val = e.target.value;
                   if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
                   pendingEditsRef.current.name = val;
                   nameTimeoutRef.current = setTimeout(flushEdits, 400);
                 }}
                 className="bg-transparent border-none min-h-[44px] p-0 text-lg font-bold text-white outline-none w-full placeholder-white/5 truncate"
                 placeholder="音源名を入力..."
               />
               <div className="flex items-center gap-2">
                <span className="text-[9px] font-black font-cinzel text-white/20 uppercase tracking-widest">{sound.type}</span>
                <div className="w-1 h-1 rounded-full bg-white/10" />
                <span className="text-[9px] font-mono text-white/20">{sound.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/5">
              {([SoundType.BGM, SoundType.SE] as const).map(type => (
                <button
                  key={type}
                  onClick={() => onUpdate({type})}
                  className={`min-h-[44px] px-3 rounded-lg text-xs font-black font-cinzel transition-all ${sound.type === type ? 'bg-white/10 text-white shadow-lg' : 'text-white/20 hover:text-white/40'}`}
                >
                  {type}
                </button>
              ))}
            </div>
            <button
              aria-label="音源を削除"
              onClick={onRemove}
              className="flex h-[44px] w-[44px] shrink-0 items-center justify-center bg-red-500/10 border border-red-500/20 text-red-500/40 hover:text-red-500 hover:bg-red-500/20 rounded-xl transition-all"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {/* Simple Settings Row */}
          <section className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)] gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60 flex items-center gap-2">
                <Link size={10} className="text-white/20"/> 音源URL
              </label>
              <div className="group relative">
                <input
                  aria-label="音源URL"
                  onBlur={flushEdits}
                  defaultValue={sound.url || ''}
                  onChange={e => {
                    const val = e.target.value;
                    if (urlTimeoutRef.current) clearTimeout(urlTimeoutRef.current);
                    pendingEditsRef.current.url = val;
                    urlTimeoutRef.current = setTimeout(flushEdits, 500);
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg min-h-[44px] pl-3 pr-14 text-base font-mono text-white/70 outline-none focus:border-white/20 transition-all"
                  placeholder="URLを入力..."
                />
                <button
                  aria-label="端末から音源を読み込む"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'audio/*';
                    input.onchange = (e) => {
                      const target = e.target as HTMLInputElement;
                      const file = target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (re) => onUpdate({ url: re.target?.result as string });
                        reader.readAsDataURL(file);
                      }
                    };
                    input.click();
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-[44px] h-[44px] bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white/40 flex items-center justify-center transition-all"
                >
                  <Upload size={12} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/60 flex items-center gap-2">
                <Volume2 size={10} className="text-white/20"/> 音量
              </label>
              <div className="bg-white/5 min-h-[44px] px-3 rounded-lg border border-white/5 flex items-center gap-3">
                <input
                  aria-label="音源の音量"
                  type="range" min="0" max="1" step="0.01"
                  value={sound.volume || 0}
                  onChange={e => onUpdate({volume: parseFloat(e.target.value)})}
                  className="flex-1 min-w-0 h-[44px] cursor-pointer accent-white"
                />
                <span className="text-xs font-mono font-medium text-white/60 w-8 text-right">{Math.round((sound.volume || 0)*100)}%</span>
              </div>
            </div>

          </section>

          {/* Main Controls */}
          <section className="space-y-4">
            <PlaybackMonitor
              sound={sound}
              previewingSoundId={previewingSoundId}
              onTogglePreview={onTogglePreview}
            />

            <div className="border-t border-white/10">
              <RangeSettings sound={sound} onUpdate={onUpdate} captureTime={captureTime} />
              <LoopSettings sound={sound} onUpdate={onUpdate} captureTime={captureTime} />
              <FadeSettings sound={sound} onUpdate={onUpdate} />
              <SoundSettingSection title="排他グループ" summary={({red:'レッド',blue:'ブルー',green:'グリーン',yellow:'イエロー'} as Record<string,string>)[sound.chokeGroup || ''] || '指定なし'}>
                <div className="space-y-1.5">
                  <div className="bg-white/5 pr-2 rounded-lg border border-white/5 flex items-center gap-2">
                    <select
                      aria-label="排他グループ"
                      value={sound.chokeGroup || ''}
                      onChange={e => onUpdate({chokeGroup: e.target.value})}
                      className="flex-1 bg-transparent border-none min-h-[44px] pl-3 text-sm font-mono text-white/60 outline-none appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-zinc-900 text-white/40">指定なし</option>
                      <option value="red" className="bg-zinc-900 text-red-500">レッド</option>
                      <option value="blue" className="bg-zinc-900 text-blue-500">ブルー</option>
                      <option value="green" className="bg-zinc-900 text-green-500">グリーン</option>
                      <option value="yellow" className="bg-zinc-900 text-yellow-500">イエロー</option>
                    </select>
                    {sound.chokeGroup && (
                      <div className={`w-2 h-2 rounded-full ${
                        sound.chokeGroup === 'red' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]' :
                        sound.chokeGroup === 'blue' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]' :
                        sound.chokeGroup === 'green' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' :
                        sound.chokeGroup === 'yellow' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]' : ''
                      }`} />
                    )}
                  </div>
                </div>
              </SoundSettingSection>
            </div>
          </section>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});
