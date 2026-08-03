import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SoundConfig, SoundType } from '../../types';
import { audioService } from '../../services/AudioService';
import { 
  Volume2, Repeat, Link, Upload, Trash2, 
  Play, Pause, Scissors, Zap,
  Music, Radio, SkipBack
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
            className={`w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center shadow-lg ${isLoading && 'opacity-20'}`}
            title="最初から再生箇所を戻す"
          >
            <SkipBack size={24} fill="currentColor" />
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            disabled={isLoading}
            onClick={() => onTogglePreview(sound)} 
            className={`w-14 h-14 rounded-2xl transition-all shrink-0 flex items-center justify-center shadow-lg ${isLoading ? 'bg-white/5 text-white/20' : isPlaying ? 'bg-white text-black ring-4 ring-white/20' : 'bg-sky-500 text-white shadow-sky-500/20'}`}
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
        
        <div className="flex-1 space-y-2">
          <div className="flex justify-between items-end px-1 border-b border-white/5 pb-1">
            <div className="flex items-baseline gap-2">
              <span className="text-[14px] font-mono font-black text-white">{isLoading ? "--.--" : formatSec(displayStats?.current)}</span>
              <span className="text-[10px] font-mono text-white/30">/ {isLoading ? "--.--" : formatSec(displayStats?.duration)}s</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-sky-400/50' : isPlaying ? 'bg-sky-400 animate-pulse' : 'bg-white/10'}`} />
              <span className={`text-[9px] font-black font-cinzel tracking-widest ${isLoading ? 'text-sky-400/50' : isPlaying ? 'text-sky-400' : 'text-white/20'}`}>
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

// --- Sub-components for Range, Loop, Fade ---

const SettingInput: React.FC<{
  label: string;
  val: number;
  onUpdate: (val: number) => void;
  onCapture: () => void;
  disabled?: boolean;
}> = React.memo(({ label, val, onUpdate, onCapture, disabled }) => (
  <div className={`space-y-1.5 ${disabled ? 'opacity-20 pointer-events-none' : ''}`}>
    <div className="flex justify-between items-baseline px-1">
      <span className="text-[8px] font-bold text-white/30 truncate uppercase">{label}</span>
      <span className="text-[10px] font-mono font-black text-white/60">{val.toFixed(2)}s</span>
    </div>
    <div className="flex items-center gap-1">
      <button 
        onClick={() => onUpdate(Math.round(Math.max(0, val - 0.1) * 10) / 10)} 
        className="w-12 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-white/40 transition-colors"
      >-</button>
      <input 
        type="number" 
        step="0.1" 
        value={val} 
        onChange={e => onUpdate(parseFloat(e.target.value) || 0)} 
        className="w-16 h-8 bg-zinc-950 border border-white/10 rounded-lg text-[12px] font-mono text-white text-center font-black focus:border-white shadow-inner" 
      />
      <button 
        onClick={() => onUpdate(Math.round((val + 0.1) * 10) / 10)} 
        className="w-12 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-white/40 transition-colors"
      >+</button>
      <button 
        onClick={onCapture} 
        className="w-12 h-8 shrink-0 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 rounded-lg flex items-center justify-center transition-all active:scale-90" 
        title="現在値をキャプチャ"
      >
        <div className="w-[1.5px] h-3 bg-current" />
      </button>
    </div>
  </div>
));

const RangeSettings: React.FC<{
  sound: SoundConfig;
  onUpdate: (updates: Partial<SoundConfig>) => void;
  captureTime: (field: 'startTime' | 'endTime' | 'loopStart' | 'loopEnd') => void;
}> = React.memo(({ sound, onUpdate, captureTime }) => (
  <div className="space-y-3 bg-white/5 p-3 rounded-xl border border-white/10">
    <span className="text-[10px] font-black font-cinzel text-white/40 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2">
      <Scissors size={12}/> RANGE SETTINGS
    </span>
    <div className="space-y-4 pt-1">
      <SettingInput 
        label="START POINT" 
        val={sound.startTime || 0} 
        onUpdate={v => onUpdate({ startTime: v })} 
        onCapture={() => captureTime('startTime')} 
      />
      <SettingInput 
        label="END POINT" 
        val={sound.endTime || 0} 
        onUpdate={v => onUpdate({ endTime: v })} 
        onCapture={() => captureTime('endTime')} 
      />
    </div>
  </div>
));

const LoopSettings: React.FC<{
  sound: SoundConfig;
  onUpdate: (updates: Partial<SoundConfig>) => void;
  captureTime: (field: 'startTime' | 'endTime' | 'loopStart' | 'loopEnd') => void;
}> = React.memo(({ sound, onUpdate, captureTime }) => (
  <div className={`space-y-3 bg-white/5 p-3 rounded-xl border transition-all ${sound.loopEnabled ? 'border-emerald-500/20' : 'border-white/10 opacity-60 grayscale'}`}>
    <div className="flex items-center justify-between border-b border-white/5 pb-2">
      <span className="text-[10px] font-black font-cinzel text-white/40 uppercase tracking-widest flex items-center gap-2"><Repeat size={12}/> LOOP SETTINGS</span>
      <button 
        onClick={() => onUpdate({loopEnabled: !sound.loopEnabled})} 
        className={`px-2 py-0.5 rounded text-[8px] font-black transition-all ${sound.loopEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-white/20 border border-white/10'}`}
      >
        {sound.loopEnabled ? 'ON' : 'OFF'}
      </button>
    </div>
    <div className="space-y-4 pt-1">
      <SettingInput 
        label="LOOP START" 
        val={sound.loopStart || 0} 
        onUpdate={v => onUpdate({ loopStart: v })} 
        onCapture={() => captureTime('loopStart')} 
        disabled={!sound.loopEnabled}
      />
      <SettingInput 
        label="LOOP EXIT" 
        val={sound.loopEnd || 0} 
        onUpdate={v => onUpdate({ loopEnd: v })} 
        onCapture={() => captureTime('loopEnd')} 
        disabled={!sound.loopEnabled}
      />
    </div>
  </div>
));

const FadeSettings: React.FC<{
  sound: SoundConfig;
  onUpdate: (updates: Partial<SoundConfig>) => void;
}> = React.memo(({ sound, onUpdate }) => (
  <div className="space-y-3 bg-white/5 p-3 rounded-xl border border-white/10 text-white/80">
    <div className="flex items-center justify-between border-b border-white/5 pb-2">
      <span className="text-[10px] font-black font-cinzel text-white/40 uppercase tracking-widest flex items-center gap-2"><Zap size={12}/> FADE AUTOMATION</span>
    </div>
    <div className="space-y-4 pt-1">
      {[
        { field: 'fadeIn' as const, label: 'IN', enabled: sound.fadeInEnabled, dur: sound.fadeInDuration },
        { field: 'fadeOut' as const, label: 'OUT', enabled: sound.fadeOutEnabled, dur: sound.fadeOutDuration }
      ].map(ctrl => (
        <div key={ctrl.field} className={`space-y-1.5 transition-opacity ${!ctrl.enabled && 'opacity-40 grayscale'}`}>
          <div className="flex justify-between items-baseline px-1">
            <button onClick={() => onUpdate({[`${ctrl.field}Enabled`]: !ctrl.enabled})} className={`text-[8px] font-black font-cinzel transition-all ${ctrl.enabled ? 'text-white' : 'text-white/20'}`}>ENABLE {ctrl.label}</button>
            <span className="text-[10px] font-mono font-black text-white/60">{ctrl.dur?.toFixed(2) || '0.00'}s</span>
          </div>
          <div className="flex items-center gap-1">
            <button 
              disabled={!ctrl.enabled} 
              onClick={() => onUpdate({[`${ctrl.field}Duration`]: Math.max(0, (ctrl.dur || 0) - 0.1)})} 
              className="w-10 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-white/40 transition-colors disabled:opacity-0"
            >-</button>
            <input 
              disabled={!ctrl.enabled} 
              type="number" 
              step="0.1" 
              value={ctrl.dur || 0} 
              onChange={e => onUpdate({[`${ctrl.field}Duration`]: parseFloat(e.target.value) || 0})} 
              className="flex-1 min-w-0 h-8 bg-zinc-950 border border-white/10 rounded-lg text-[12px] font-mono text-white text-center font-black focus:border-white shadow-inner disabled:opacity-20" 
            />
            <button 
              disabled={!ctrl.enabled} 
              onClick={() => onUpdate({[`${ctrl.field}Duration`]: (ctrl.dur || 0) + 0.1})} 
              className="w-10 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-white/40 transition-colors disabled:opacity-0"
            >+</button>
            <button 
              disabled={!ctrl.enabled} 
              onClick={() => {
                const stats = audioService.getPlaybackStats(sound.id);
                if (!stats) return;
                if (ctrl.field === 'fadeIn') onUpdate({ fadeInDuration: Math.round(Math.max(0, stats.current - (sound.startTime || 0)) * 100) / 100 });
                else onUpdate({ fadeOutDuration: Math.round(Math.max(0, (sound.endTime || stats.duration) - stats.current) * 100) / 100 });
              }} 
              className="w-10 h-8 shrink-0 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg flex items-center justify-center transition-all active:scale-90 disabled:opacity-0" 
              title="現在値をキャプチャ"
            >
              <div className="w-[1.5px] h-3 bg-current" />
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
));

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
        className="flex flex-col h-full bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="py-3 px-5 border-b border-white/5 bg-gradient-to-r from-zinc-900 to-zinc-950 flex items-center justify-between gap-4">
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <div className={`p-2 rounded-xl border ${sound.type === SoundType.BGM ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
              {sound.type === SoundType.BGM ? <Music size={16} /> : <Radio size={16} />}
            </div>
              <div className="flex-1 min-w-0">
               <input 
                 defaultValue={sound.name || ''} 
                 onChange={e => {
                   const val = e.target.value;
                   if (nameTimeoutRef.current) clearTimeout(nameTimeoutRef.current);
                   nameTimeoutRef.current = setTimeout(() => {
                     onUpdate({name: val});
                   }, 400);
                 }} 
                 className="bg-transparent border-none p-0 text-lg font-bold text-white outline-none w-full placeholder-white/5 truncate" 
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
                  className={`px-2.5 py-1 rounded-lg text-[8px] font-black font-cinzel transition-all ${sound.type === type ? 'bg-white/10 text-white shadow-lg' : 'text-white/20 hover:text-white/40'}`}
                >
                  {type}
                </button>
              ))}
            </div>
            <button 
              onClick={onRemove} 
              className="p-2 bg-red-500/10 border border-red-500/20 text-red-500/40 hover:text-red-500 hover:bg-red-500/20 rounded-xl transition-all"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {/* Simple Settings Row */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] font-cinzel flex items-center gap-2">
                <Link size={10} className="text-white/20"/> 音源設定
              </label>
              <div className="group relative">
                <input 
                  defaultValue={sound.url || ''} 
                  onChange={e => {
                    const val = e.target.value;
                    if (urlTimeoutRef.current) clearTimeout(urlTimeoutRef.current);
                    urlTimeoutRef.current = setTimeout(() => {
                      onUpdate({url: val});
                    }, 500);
                  }} 
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-1.5 pl-2.5 pr-10 text-[9px] font-mono text-white/70 outline-none focus:border-white/20 transition-all" 
                  placeholder="URLを入力..." 
                />
                <button 
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
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-white/40 flex items-center justify-center transition-all"
                >
                  <Upload size={12} />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] font-cinzel flex items-center gap-2">
                <Volume2 size={10} className="text-white/20"/> 音量設定
              </label>
              <div className="bg-white/5 p-1.5 px-3 rounded-lg border border-white/5 flex items-center gap-3">
                <input 
                  type="range" min="0" max="1" step="0.01" 
                  value={sound.volume || 0} 
                  onChange={e => onUpdate({volume: parseFloat(e.target.value)})} 
                  className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-white" 
                />
                <span className="text-[9px] font-mono font-bold text-white/60 w-8 text-right">{Math.round((sound.volume || 0)*100)}%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em] font-cinzel flex items-center gap-2">
                <Scissors size={10} className="text-white/20"/> 排他グループ
              </label>
              <div className="bg-white/5 pr-2 rounded-lg border border-white/5 flex items-center gap-2">
                <select 
                  value={sound.chokeGroup || ''} 
                  onChange={e => onUpdate({chokeGroup: e.target.value})} 
                  className="flex-1 bg-transparent border-none py-1.5 pl-2.5 text-[9px] font-mono text-white/60 outline-none appearance-none cursor-pointer"
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
          </section>

          {/* Main Controls */}
          <section className="bg-zinc-900/80 rounded-2xl p-4 border border-white/10 space-y-6 shadow-2xl relative overflow-hidden">
            <PlaybackMonitor 
              sound={sound} 
              previewingSoundId={previewingSoundId} 
              onTogglePreview={onTogglePreview} 
            />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <RangeSettings sound={sound} onUpdate={onUpdate} captureTime={captureTime} />
              <LoopSettings sound={sound} onUpdate={onUpdate} captureTime={captureTime} />
              <FadeSettings sound={sound} onUpdate={onUpdate} />
            </div>
          </section>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

