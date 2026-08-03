import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Settings2, Layout, Columns, Maximize, Target, Heart, Music, Clock, Keyboard } from 'lucide-react';
import { Scenario, SoundType, KeyboardShortcuts } from '../types';
import { audioService } from '../services/AudioService';
// ... (rest of imports)

interface PreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: Scenario;
  onUpdateScenario: (updates: Partial<Scenario>) => void;
}

// Inside PreferencesModal component:
// Add a new section in the main grid or below existing sections.

const PreferencesModal: React.FC<PreferencesModalProps> = React.memo(({ isOpen, onClose, scenario, onUpdateScenario }) => {
  const [recordingShortcut, setRecordingShortcut] = useState<keyof KeyboardShortcuts | null>(null);

  const updateShortcut = (key: keyof KeyboardShortcuts, value: string) => {
    const newShortcuts = { ...(scenario.keyboardShortcuts || { bgmPlayPause: 'm', sePlay: 'k', syncImageNext: ']', syncImagePrev: '[', timerStartPause: ' ' }), [key]: value };
    onUpdateScenario({ keyboardShortcuts: newShortcuts });
  };

  if (!isOpen) return null;

  const themeColor = scenario.themeColor || '#1e50a2';

  return typeof document !== 'undefined' ? createPortal(
    <div 
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-[#0a0a0a] border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <Settings2 size={24} style={{ color: themeColor }} />
            <h3 className="text-xl font-cinzel font-bold text-white tracking-[0.2em] uppercase">環境設定</h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/20 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {/* マスターボリュームの配置 */}
              <div className="space-y-2.5">
                 <label className="text-[10px] uppercase text-white/20 font-bold font-cinzel tracking-widest flex items-center gap-2">
                   <Target size={12}/> マスターボリュームの配置
                 </label>
                 <div className="grid grid-cols-3 gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                   {['top', 'right-center', 'right-bottom'].map(pos => (
                     <button 
                       key={pos} 
                       onClick={() => onUpdateScenario({ masterVolumePosition: pos as "top" | "right-center" | "right-bottom" })} 
                       className={`py-2 text-[9px] font-bold font-cinzel uppercase rounded-lg transition-all ${scenario.masterVolumePosition === pos ? 'bg-white/10 text-white border border-white/10 shadow-lg' : 'text-white/20 hover:text-white/40 border border-transparent'}`}
                     >
                       {pos === 'top' ? '上部中央' : pos === 'right-center' ? '右側中央' : '右側下部'}
                     </button>
                   ))}
                 </div>
              </div>
   
              {/* ポップアップタイマー位置 */}
              <div className="space-y-2.5">
                 <label className="text-[10px] uppercase text-white/20 font-bold font-cinzel tracking-widest flex items-center gap-2">
                   <Layout size={12}/> ポップアップタイマー位置
                 </label>
                 <div className="grid grid-cols-3 gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                   {[
                     { val: 'top-right', label: '右上' },
                     { val: 'bottom-right', label: '右下' },
                     { val: 'disabled', label: '無効' }
                   ].map(pos => (
                     <button 
                       key={pos.val} 
                       onClick={() => onUpdateScenario({ popupTimerPosition: pos.val as "top-right" | "bottom-right" | "disabled" })} 
                       className={`py-2 text-[9px] font-bold font-cinzel uppercase rounded-lg transition-all ${scenario.popupTimerPosition === pos.val || (!scenario.popupTimerPosition && pos.val === 'top-right') ? 'bg-white/10 text-white border border-white/10 shadow-lg' : 'text-white/20 hover:text-white/40 border border-transparent'}`}
                     >
                       {pos.label}
                     </button>
                   ))}
                 </div>
              </div>

              {/* 表示デバイスプリセット */}
              <div className="space-y-2.5">
                 <label className="text-[10px] uppercase text-white/20 font-bold font-cinzel tracking-widest flex items-center gap-2">
                   <Layout size={12}/> 表示デバイスプリセット
                 </label>
                 <div className="grid grid-cols-5 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
                   {[
                     { val: 'auto', label: '自動判定' },
                     { val: 'pc', label: 'PC' },
                     { val: 'tablet', label: 'タブレット' },
                     { val: 'mobile', label: 'スマホ' },
                     { val: 'manual', label: '手動設定' }
                   ].map(opt => (
                     <button 
                       key={opt.val} 
                       onClick={() => {
                         const updates: Partial<Scenario> = { layoutPreset: opt.val as 'auto' | 'pc' | 'tablet' | 'mobile' | 'manual' };
                         if (opt.val === 'manual' && (!scenario.columnLayoutMode || scenario.columnLayoutMode === 'auto')) {
                           updates.columnLayoutMode = '3-column';
                         }
                         onUpdateScenario(updates);
                       }} 
                       className={`py-2 text-[8px] font-bold font-cinzel uppercase rounded-lg transition-all ${(!scenario.layoutPreset && opt.val === 'auto') || scenario.layoutPreset === opt.val ? 'bg-white/10 text-white border border-white/10 shadow-lg' : 'text-white/20 hover:text-white/40 border border-transparent'}`}
                     >
                       {opt.label}
                     </button>
                   ))}
                 </div>
              </div>

              {/* カラムレイアウト設定 */}
              {scenario.layoutPreset === 'manual' && (
                <div className="space-y-2.5">
                   <label className="text-[10px] uppercase text-white/20 font-bold font-cinzel tracking-widest flex items-center gap-2">
                     <Columns size={12}/> カラムレイアウト設定
                   </label>
                   <div className="grid grid-cols-3 gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                     {['1-column', '2-column', '3-column'].map(mode => (
                       <button 
                         key={mode} 
                         onClick={() => onUpdateScenario({ columnLayoutMode: mode as "1-column" | "2-column" | "3-column" })} 
                         className={`py-2 text-[8px] font-bold font-cinzel uppercase rounded-lg transition-all ${scenario.columnLayoutMode === mode ? 'bg-white/10 text-white border border-white/10 shadow-lg' : 'text-white/20 hover:text-white/40 border border-transparent'}`}
                       >
                         {mode === '1-column' ? '1列' : mode === '2-column' ? '2列' : '3列'}
                       </button>
                     ))}
                   </div>
                </div>
              )}
    
              {/* UI表示倍率 */}
              <div className="space-y-2.5">
                 <label className="text-[10px] uppercase text-white/20 font-bold font-cinzel tracking-widest flex items-center gap-2">
                   <Maximize size={12}/> UI表示倍率
                 </label>
                 <div className="grid grid-cols-3 gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                   {['small', 'medium', 'large'].map(scale => (
                     <button 
                       key={scale} 
                       onClick={() => onUpdateScenario({ uiScaleMode: scale as "small" | "medium" | "large" })} 
                       className={`py-2 text-[9px] font-bold font-cinzel uppercase rounded-lg transition-all ${scenario.uiScaleMode === scale ? 'bg-white/10 text-white border border-white/10 shadow-lg' : 'text-white/20 hover:text-white/40 border border-transparent'}`}
                     >
                       {scale === 'small' ? '小' : scale === 'medium' ? '中' : '大'}
                     </button>
                   ))}
                 </div>
              </div>

               {/* AUDIOカラム幅の最適化 */}
              <div className="space-y-2.5">
                 <label className="text-[10px] uppercase text-white/20 font-bold font-cinzel tracking-widest flex items-center gap-2">
                   <Music size={12}/> AUDIOカラム幅の最適化
                 </label>
                 <div className="grid grid-cols-2 gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                   {[
                     { val: false, label: '標準' },
                     { val: true, label: '20% 削減' }
                   ].map(opt => (
                     <button 
                       key={String(opt.val)} 
                       onClick={() => onUpdateScenario({ narrowAudioPanel: opt.val })} 
                       className={`py-2 text-[9px] font-bold font-cinzel uppercase rounded-lg transition-all ${!!scenario.narrowAudioPanel === opt.val ? 'bg-white/10 text-white border border-white/10 shadow-lg' : 'text-white/20 hover:text-white/40 border border-transparent'}`}
                     >
                       {opt.label}
                     </button>
                   ))}
                 </div>
              </div>

              {/* タイマーの表示位置 */}
              <div className="space-y-2.5">
                 <label className="text-[10px] uppercase text-white/20 font-bold font-cinzel tracking-widest flex items-center gap-2">
                   <Clock size={12}/> タイマーの表示位置
                 </label>
                 <div className="grid grid-cols-3 gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
                   {[
                     { val: 'header', label: '上部バー' },
                     { val: 'tab', label: 'AUDIOタブ' },
                     { val: 'both', label: '両方' }
                   ].map(opt => (
                     <button 
                       key={opt.val} 
                       onClick={() => onUpdateScenario({ timerDisplayPosition: opt.val as 'header' | 'tab' | 'both' })} 
                       className={`py-2 text-[9px] font-bold font-cinzel uppercase rounded-lg transition-all ${(!scenario.timerDisplayPosition && opt.val === 'tab') || scenario.timerDisplayPosition === opt.val ? 'bg-white/10 text-white border border-white/10 shadow-lg' : 'text-white/20 hover:text-white/40 border border-transparent'}`}
                     >
                       {opt.label}
                     </button>
                   ))}
                 </div>
              </div>

              {/* タイマー終了時のアラート */}
              <div className="space-y-2.5 md:col-span-2 pt-4 border-t border-white/5">
                 <label className="text-[10px] uppercase text-white/20 font-bold font-cinzel tracking-widest flex items-center gap-2">
                   <Clock size={12}/> タイマー終了時のアラート音設定
                 </label>
                 <div className="flex flex-col md:flex-row gap-4 bg-black/40 p-3 rounded-xl border border-white/5">
                   <div className="flex items-center gap-3 shrink-0">
                     <span className="text-[11px] font-bold text-white/60">通知音の再生:</span>
                     <button 
                       onClick={() => onUpdateScenario({ timerEndSoundEnabled: !scenario.timerEndSoundEnabled })} 
                       className={`px-4 py-1.5 text-[10px] font-bold font-cinzel uppercase rounded-lg transition-all border ${scenario.timerEndSoundEnabled ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/5 text-white/40'}`}
                     >
                       {scenario.timerEndSoundEnabled ? '有効 (ON)' : '無効 (OFF)'}
                     </button>
                   </div>
                   
                   {scenario.timerEndSoundEnabled && (
                     <div className="flex-1 flex flex-col gap-2">
                       <div className="flex items-center gap-2">
                         <span className="text-[11px] font-bold text-white/60 shrink-0">音源の選択:</span>
                         <select
                           value={
                             [
                               'https://assets.mixkit.co/active_storage/sfx/2869/2869-200.wav',
                               'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
                               'https://actions.google.com/sounds/v1/clock/ticks_clock.ogg'
                             ].includes(scenario.timerEndSoundUrl || '')
                               ? scenario.timerEndSoundUrl
                               : 'custom'
                           }
                           onChange={(e) => {
                             const val = e.target.value;
                             if (val === 'custom') {
                               onUpdateScenario({ timerEndSoundUrl: scenario.timerEndSoundUrl || '' });
                             } else {
                               onUpdateScenario({ timerEndSoundUrl: val });
                             }
                           }}
                           className="bg-black border border-white/10 rounded-lg text-xs text-white p-1.5 focus:outline-none focus:border-white/30 flex-1 cursor-pointer"
                         >
                           <option value="https://assets.mixkit.co/active_storage/sfx/2869/2869-200.wav">控えめなチャイム音 (Mixkit)</option>
                           <option value="https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg">デジタルアラーム音 (Google)</option>
                           <option value="https://actions.google.com/sounds/v1/clock/ticks_clock.ogg">秒針の刻み音 (Google)</option>
                           <option value="custom">カスタムURL</option>
                         </select>
                       </div>

                       {(!scenario.timerEndSoundUrl || ![
                         'https://assets.mixkit.co/active_storage/sfx/2869/2869-200.wav',
                         'https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg',
                         'https://actions.google.com/sounds/v1/clock/ticks_clock.ogg'
                       ].includes(scenario.timerEndSoundUrl)) && (
                         <div className="flex flex-col gap-1">
                           <span className="text-[9px] text-white/40">カスタムオーディオURLを入力:</span>
                           <input
                             type="text"
                             value={scenario.timerEndSoundUrl || ''}
                             onChange={(e) => onUpdateScenario({ timerEndSoundUrl: e.target.value })}
                             placeholder="https://example.com/sound.mp3"
                             className="bg-black border border-white/10 rounded-lg text-xs text-white px-2 py-1 focus:outline-none focus:border-white/30 font-mono"
                           />
                         </div>
                       )}

                       {/* Preview Button */}
                       <button
                         onClick={() => {
                           audioService.activateAudio(scenario.title);
                           const soundUrl = scenario.timerEndSoundUrl || 'https://assets.mixkit.co/active_storage/sfx/2869/2869-200.wav';
                           const previewConfig = {
                             id: `timer-end-preview-${Date.now()}`,
                             name: 'Timer Timeout Preview',
                             url: soundUrl,
                             type: SoundType.SE,
                             volume: 0.8
                           };
                           audioService.play(previewConfig);
                         }}
                         className="self-end px-3 py-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 text-[10px] rounded font-cinzel tracking-wider uppercase transition-all"
                       >
                         テスト再生 (Test Play)
                       </button>
                     </div>
                   )}
                 </div>
              </div>
            </div>

              {/* 一時停止時のフラッシュフィードバック */}
              <div className="space-y-2.5 md:col-span-2 pt-4 border-t border-white/5">
                 <label className="text-[10px] uppercase text-white/20 font-bold font-cinzel tracking-widest flex items-center gap-2">
                   <Clock size={12}/> タイマー一時停止時のビジュアルフィードバック
                 </label>
                 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 gap-3">
                   <div className="flex flex-col gap-0.5">
                     <span className="text-[11px] font-bold text-white/60">一時停止フラッシュ:</span>
                     <span className="text-[9px] text-white/40">タイマーが一時停止または再開された際に、カード全体を一時的にフラッシュ表示します。</span>
                   </div>
                   <button 
                     onClick={() => onUpdateScenario({ timerFlashOnPauseEnabled: !scenario.timerFlashOnPauseEnabled })} 
                     className={`px-4 py-1.5 text-[10px] font-bold font-cinzel uppercase rounded-lg transition-all border shrink-0 ${scenario.timerFlashOnPauseEnabled ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.15)]' : 'bg-white/5 border-white/5 text-white/40'}`}
                   >
                     {scenario.timerFlashOnPauseEnabled ? '有効 (ON)' : '無効 (OFF)'}
                   </button>
                 </div>
              </div>

              {/* フェーズの自動追従 */}
              <div className="space-y-2.5 md:col-span-2 pt-4 border-t border-white/5">
                 <label className="text-[10px] uppercase text-white/20 font-bold font-cinzel tracking-widest flex items-center gap-2">
                   <Layout size={12}/> アクティブフェーズの自動追従
                 </label>
                 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 gap-3">
                   <div className="flex flex-col gap-0.5">
                     <span className="text-[11px] font-bold text-white/60">アクティブフェーズ自動スクロール:</span>
                     <span className="text-[9px] text-white/40">進行中のフェーズ（Active Phase）が切り替わった際に、サイドバーを自動でスクロール追従させます。</span>
                   </div>
                   <button 
                     onClick={() => onUpdateScenario({ phaseAutoScrollEnabled: scenario.phaseAutoScrollEnabled === false ? true : false })} 
                     className={`px-4 py-1.5 text-[10px] font-bold font-cinzel uppercase rounded-lg transition-all border shrink-0 ${scenario.phaseAutoScrollEnabled !== false ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/5 text-white/40'}`}
                   >
                     {scenario.phaseAutoScrollEnabled !== false ? '有効 (ON)' : '無効 (OFF)'}
                   </button>
                 </div>
              </div>

              {/* 台本テキストの表示サイズ */}
              <div className="space-y-2.5 md:col-span-2 pt-4 border-t border-white/5">
                 <label className="text-[10px] uppercase text-white/20 font-bold font-cinzel tracking-widest flex items-center gap-2">
                   <Layout size={12}/> 台本テキストの表示サイズ
                 </label>
                 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 gap-4">
                   <div className="flex flex-col gap-0.5">
                     <span className="text-[11px] font-bold text-white/60">台本テキストサイズ:</span>
                     <span className="text-[9px] text-white/40">PC・タブレット等での閲覧時の、進行・台本テキストのフォントサイズを設定します（モバイル端末では13px固定）。</span>
                   </div>
                   <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
                     <input 
                       type="range" 
                       min="16" 
                       max="24" 
                       step="1"
                       value={scenario.scriptFontSize || 18} 
                       onChange={(e) => onUpdateScenario({ scriptFontSize: parseInt(e.target.value, 10) })}
                       className="w-full sm:w-32 accent-white bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                     />
                     <span className="text-xs font-mono font-bold text-white bg-white/5 px-2 py-1 rounded border border-white/10 min-w-[3.5rem] text-center">
                       {scenario.scriptFontSize || 18}px
                     </span>
                   </div>
                 </div>
              </div>

            {/* キーボードショートカット設定 */}
            <div className="space-y-2.5 md:col-span-2 pt-4 border-t border-white/5">
               <label className="text-[10px] uppercase text-white/20 font-bold font-cinzel tracking-widest flex items-center gap-2">
                 <Keyboard size={12}/> キーボードショートカット設定
               </label>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-black/40 p-3 rounded-xl border border-white/5">
                 {(Object.entries({
                   bgmPlayPause: 'BGM再生/停止',
                   sePlay: 'SE再生',
                   syncImageNext: '同期画像 次へ',
                   syncImagePrev: '同期画像 前へ',
                   timerStartPause: 'タイマー開始/停止'
                 }) as [keyof KeyboardShortcuts, string][]).map(([key, label]) => (
                   <div key={key} className="flex items-center justify-between gap-2">
                     <span className="text-[10px] text-white/60">{label}</span>
                     <button 
                       className={`px-3 py-1 text-[10px] rounded border ${recordingShortcut === key ? 'border-amber-500 bg-amber-500/20 text-white' : 'border-white/10 bg-black text-white/70'}`}
                       onClick={() => setRecordingShortcut(key)}
                       onKeyDown={(e) => {
                         if (recordingShortcut === key) {
                           e.preventDefault();
                           updateShortcut(key, e.key);
                           setRecordingShortcut(null);
                         }
                       }}
                     >
                       {recordingShortcut === key ? 'キーを入力...' : (scenario.keyboardShortcuts?.[key] || '未設定')}
                     </button>
                   </div>
                 ))}
               </div>
            </div>

            {/* Bluetoothスリープ防止 */}
            <div className="pt-4 border-t border-white/5 space-y-4 md:col-span-2">
               <label className="text-[10px] uppercase text-white/20 font-bold font-cinzel tracking-widest flex items-center gap-2">
                 <Heart size={12} className="text-emerald-500" /> Bluetoothスリープ防止機能
               </label>
               <div className="grid grid-cols-3 gap-3 bg-black/40 p-1 rounded-xl border border-white/5">
                 {[
                   { val: 'silent-wav', label: '標準 (無音WAV)' },
                   { val: 'white-noise', label: '強化 (ノイズ)' },
                   { val: 'disabled', label: '無効' }
                 ].map(mode => (
                   <button 
                     key={mode.val} 
                     onClick={() => onUpdateScenario({ 
                       audioPreferences: { preventSleepMode: mode.val as 'silent-wav' | 'white-noise' | 'disabled' } 
                     })} 
                     className={`py-2 text-[10px] font-bold font-cinzel uppercase rounded-lg transition-all ${scenario.audioPreferences?.preventSleepMode === mode.val || (!scenario.audioPreferences?.preventSleepMode && mode.val === 'silent-wav') ? 'bg-white/10 text-white border border-white/10 shadow-lg' : 'text-white/20 hover:text-white/40 border border-transparent'}`}
                   >
                     {mode.label}
                   </button>
                 ))}
               </div>
               <p className="text-[9px] text-white/20 px-2 leading-relaxed">
                 一部のスピーカーで音が途切れる場合、「強化」設定をお試しください。可聴域外の極小ノイズを流し続け、接続を維持します。
               </p>
            </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-black/60 flex justify-center shrink-0">
          <button 
            onClick={onClose}
            className="px-10 py-2.5 rounded-xl font-bold font-cinzel text-xs tracking-widest transition-all text-white border border-white/10 hover:bg-white/5 active:scale-95"
          >
            完了
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;
});

export default PreferencesModal;
