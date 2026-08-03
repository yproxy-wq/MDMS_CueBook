
import React from 'react';
import { Scenario, SyncConfig } from '../../types';
import { Palette, Upload, Clock, Monitor, Layers, Type } from 'lucide-react';
import { ColorPicker } from './ColorPicker';

// サンプルデータを用いたライブプレビューコンポーネント
const DummyPreview: React.FC<{
  config: SyncConfig;
  backgroundImage?: string;
}> = React.memo(({ config, backgroundImage }) => {
  const isVisible = config.contentEnabled;

  // サンプル画像。背景画像があればそれを使い、なければ雰囲気のあるミステリー調のイメージ
  const displayUrl = backgroundImage || "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=600&auto=format&fit=crop";

  return (
    <div className="space-y-3 sticky top-4">
      <div className="flex items-center gap-2 pl-1">
        <Monitor size={14} className="text-emerald-500" />
        <span className="text-[10px] font-black font-cinzel tracking-widest text-white/50 uppercase">共有画面プレビュー</span>
        <div className="px-1.5 py-0.5 rounded text-[6px] font-black bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono uppercase tracking-widest ml-auto">
          サンプル表示
        </div>
      </div>
      <div className="aspect-video w-full bg-[#0a0a0a] rounded-xl border border-white/10 relative overflow-hidden ring-1 ring-white/5 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
        {/* Background (Solid) */}
        <div className="absolute inset-0 bg-zinc-950" />
        
        {/* Synced Content (Image) */}
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
            <img 
              src={displayUrl}
              alt="Preview"
              className="w-full h-full pointer-events-none transition-all duration-300"
              style={{ 
                opacity: isVisible ? 1.0 : 0.2,
                objectFit: config.imageFit === 'cover' ? 'cover' : (config.imageFit === 'contain' ? 'contain' : 'fill'),
                width: config.imageFit === 'height' ? 'auto' : '100%',
                height: config.imageFit === 'width' ? 'auto' : '100%',
                margin: 'auto'
              }}
              referrerPolicy="no-referrer"
            />
            {/* Dynamic Live Overlay Preview */}
            {config.overlayType && config.overlayType !== 'none' && (
              <div 
                className="absolute inset-0 pointer-events-none z-10 transition-all duration-300" 
                style={{ 
                  backgroundColor: config.overlayType === 'black' ? 'black' : 'white',
                  opacity: config.overlayIntensity ?? 0.5 
                }} 
              />
            )}
            {!isVisible && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/80 backdrop-blur-[1px] z-20">
                <Monitor size={18} className="text-pink-500/30 animate-pulse mb-1" />
                <span className="text-[7px] font-bold font-mono tracking-widest text-pink-500/50 uppercase">IMAGE MUTED</span>
              </div>
            )}
          </div>
        </div>

        {/* Timer Overlay */}
        {config.timerEnabled && !config.timerForceHidden && (
          <div 
            className={`absolute left-0 right-0 p-2 pointer-events-none z-20 flex ${config.timerPosition === 'bottom' ? 'bottom-0' : 'top-0'} justify-center`}
          >
            <div className={`
              ${config.timerColor === 'black' ? 'bg-white/80 border-black/10 text-black' : 'bg-black/70 border-white/20 text-white'}
              backdrop-blur-md border rounded-lg px-2 py-0.5 flex flex-col items-center gap-0.5
              ${config.timerSize === 'small' ? 'min-w-[60px]' : config.timerSize === 'medium' ? 'min-w-[80px]' : 'min-w-[100px]'}
              shadow-[0_0_15px_rgba(0,0,0,0.8)]
              transition-all duration-300
            `}>
              <p className={`text-[4px] font-cinzel ${config.timerColor === 'black' ? 'text-sky-600 font-bold' : 'text-sky-400/90 font-medium'} uppercase tracking-[0.3em] leading-none mb-0.5`}>
                {config.timerLabelText || 'SAMPLE TIMER'}
              </p>
              <p 
                className={`font-mono font-black tabular-nums leading-none ${config.timerSize === 'small' ? 'text-[9px]' : config.timerSize === 'medium' ? 'text-[12px]' : 'text-[15px]'} ${config.timerColor === 'black' ? 'text-black' : 'text-white'}`}
              >
                10:00
              </p>
            </div>
          </div>
        )}

        {/* Dark gradient for timer readability */}
        {config.timerEnabled && !config.timerForceHidden && isVisible && (
          <div className={`absolute inset-x-0 h-8 bg-gradient-to-${config.timerPosition === 'bottom' ? 't' : 'b'} from-black/60 to-transparent pointer-events-none ${config.timerPosition === 'bottom' ? 'bottom-0' : 'top-0'}`} />
        )}

        {/* Lap Banner Preview */}
        {config.lapDisplayMode && config.lapDisplayMode !== 'hidden' && (
          <div 
            className={`absolute bg-pink-600/95 border-t border-b border-pink-400/50 text-white uppercase z-30 flex items-center justify-center gap-1 font-mono transition-all duration-300 ${
              config.lapDisplayMode === 'overlay' 
                ? 'top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-4/5 rounded-full shadow-[0_0_15px_rgba(236,72,153,0.5)] border' 
                : `inset-x-0 ${config.lapDisplayPosition === 'bottom' ? 'bottom-0 border-b-0' : 'top-0 border-t-0'}`
            } ${
              config.lapDisplayMode === 'overlay'
                ? (config.lapBandSize === 'small' ? 'px-2 py-0.5' : config.lapBandSize === 'large' ? 'px-4 py-2.5' : 'px-3 py-1.5')
                : (config.lapBandSize === 'small' ? 'py-0.5' : config.lapBandSize === 'large' ? 'py-3' : 'py-1.5')
            } ${
              config.lapFontSize === 'small' ? 'text-[5px]' : config.lapFontSize === 'large' ? 'text-[11px]' : 'text-[8px]'
            }`}
            style={{
              letterSpacing: '0.2em'
            }}
          >
            <span className="w-1 h-1 rounded-full bg-white animate-ping shrink-0" />
            <span className="truncate">サンプルラップ: {config.lapDisplayMode === 'overlay' ? 'フラッシュ' : '常時表示'}</span>
          </div>
        )}
      </div>
      <p className="text-[10px] text-white/30 leading-relaxed font-sans pl-1">
        ※ 子ウィンドウ設定を調整すると、自動的に上記のサンプルプレビューに反映されます。
      </p>
    </div>
  );
});

interface ScenarioTabProps {
  scenario: Scenario;
  onUpdate: (updates: Partial<Scenario>) => void;
}

export const ScenarioTab: React.FC<ScenarioTabProps> = React.memo(({ scenario, onUpdate }) => {
  const syncConfig = scenario.syncConfig || {
    timerEnabled: true,
    contentEnabled: true,
    timerSize: 'small',
    timerPosition: 'bottom',
    imageFit: 'cover',
    activeImageId: null,
    timerForceHidden: false,
    lapDisplayMode: 'overlay',
    lapDisplayPosition: 'top',
    lapBandSize: 'medium',
    lapFontSize: 'medium',
    timerLabelText: '',
    overlayType: 'none',
    overlayIntensity: 0.5,
    timerColor: 'white'
  };

  const updateSyncConfig = (updates: Partial<SyncConfig>) => {
    onUpdate({
      syncConfig: {
        ...syncConfig,
        ...updates
      }
    });
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <h3 className="text-xl font-cinzel font-bold text-white/40 uppercase tracking-[0.3em] flex items-center gap-3">
        <Palette size={24} /> シナリオ全体設定
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest font-cinzel">シナリオタイトル</label>
            <input 
              value={scenario.title || ''} 
              onChange={e => onUpdate({title: e.target.value})} 
              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold outline-none focus:border-white/30 transition-all" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest font-cinzel">制作者 / 著作権</label>
            <input 
              value={scenario.author || ''} 
              onChange={e => onUpdate({author: e.target.value})} 
              className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold outline-none focus:border-white/30 transition-all" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest font-cinzel">テーマカラー</label>
            <ColorPicker 
              value={scenario.themeColor || '#1e50a2'} 
              onChange={val => onUpdate({themeColor: val})} 
            />
            <p className="text-[11px] text-white/40 leading-relaxed font-sans mt-1.5">
              ※ このカラーは、進行ナビゲーションや議論タイマーの輝き、および同期される子ウィンドウ（共有画面）全体の演出アクセントカラーとして美しく反映されます。
            </p>
          </div>
        </div>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest font-cinzel">背景画像 URL</label>
            <div className="flex gap-2">
              <input 
                value={scenario.backgroundImage || ''} 
                onChange={e => onUpdate({backgroundImage: e.target.value})} 
                className="flex-1 bg-black/40 border border-white/10 rounded-xl p-4 text-[12px] text-white/60 font-mono outline-none focus:border-white/30 transition-all" 
                placeholder="https://..." 
              />
              <button 
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e: Event) => {
                    const target = e.target as HTMLInputElement;
                    const file = target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (re) => {
                        if (re.target?.result) {
                          onUpdate({ backgroundImage: re.target.result as string });
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  };
                  input.click();
                }}
                className="px-4 bg-white/5 border border-white/10 rounded-xl text-white/20 hover:text-white hover:bg-white/10 transition-all shrink-0 flex items-center gap-2"
                title="ローカル画像をアップロード"
              >
                <Upload size={16} />
              </button>
              <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-xl overflow-hidden shrink-0">
                {scenario.backgroundImage ? <img src={scenario.backgroundImage} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 pt-10 space-y-8">
        <div className="flex flex-col gap-1">
          <h3 className="text-xl font-cinzel font-bold text-white/40 uppercase tracking-[0.3em] flex items-center gap-3">
            <Monitor size={24} /> 子ウィンドウ（共有画面）初期表示設定
          </h3>
          <p className="text-[11px] text-white/40 leading-relaxed font-sans pl-9">
            ※ ここで設定した値は、このシナリオを開始する際の子ウィンドウ（共有画面）の初期表示設定としてデフォルト適用されます。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左側：設定エリア (2カラム幅) */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 左カラム：タイマー＆レイアウト */}
            <div className="space-y-6">
              {/* タイマー表示設定 */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-sky-500" />
                  <span className="text-[10px] font-bold text-white/60 font-cinzel tracking-widest uppercase">タイマー表示設定</span>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">タイマー表示</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateSyncConfig({ timerEnabled: true })}
                          className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${syncConfig.timerEnabled ? 'bg-sky-500/20 border-sky-400/50 text-sky-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                        >
                          表示
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSyncConfig({ timerEnabled: false })}
                          className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${!syncConfig.timerEnabled ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                        >
                          非表示
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">タイマー配置位置</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateSyncConfig({ timerPosition: 'top' })}
                          className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${syncConfig.timerPosition === 'top' ? 'bg-amber-500/20 border-amber-500/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                        >
                          上部
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSyncConfig({ timerPosition: 'bottom' })}
                          className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${syncConfig.timerPosition === 'bottom' ? 'bg-amber-500/20 border-amber-500/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                        >
                          下部
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">タイマーサイズ</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['small', 'medium', 'large'] as const).map((s) => (
                          <button
                            type="button"
                            key={s}
                            onClick={() => updateSyncConfig({ timerSize: s })}
                            className={`py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${syncConfig.timerSize === s ? 'bg-purple-500/20 border-purple-500/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                          >
                            {s === 'small' ? '小' : s === 'medium' ? '中' : '大'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">タイマー文字色</label>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => updateSyncConfig({ timerColor: 'black' })} 
                          className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${syncConfig.timerColor === 'black' ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                        >
                          黒系
                        </button>
                        <button 
                          type="button"
                          onClick={() => updateSyncConfig({ timerColor: 'white' })} 
                          className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${syncConfig.timerColor === 'white' || !syncConfig.timerColor ? 'bg-white border-white text-black' : 'bg-white/5 border-white/10 text-white/40'}`}
                        >
                          白系
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pl-1">
                        <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel">クライアント強制非表示</label>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateSyncConfig({ timerForceHidden: false })}
                          className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${!syncConfig.timerForceHidden ? 'bg-emerald-500/20 border-emerald-500/35 text-emerald-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                        >
                          標準表示
                        </button>
                        <button
                          type="button"
                          onClick={() => updateSyncConfig({ timerForceHidden: true })}
                          className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${syncConfig.timerForceHidden ? 'bg-orange-500/20 border-orange-500/35 text-orange-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                        >
                          強制非表示
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">タイマー名表示カスタム</label>
                      <input
                        type="text"
                        value={syncConfig.timerLabelText || ''}
                        onChange={(e) => updateSyncConfig({ timerLabelText: e.target.value })}
                        placeholder="（未入力時は進行のタイマー名）"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-white/20 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* オーバーレイ設定 */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-bold text-white/60 font-cinzel tracking-widest uppercase">オーバーレイ設定</span>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">画像上の半透明レイヤー</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => updateSyncConfig({ overlayType: 'none' })} className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${syncConfig.overlayType === 'none' || !syncConfig.overlayType ? 'bg-zinc-500/20 border-zinc-500/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>なし</button>
                      <button type="button" onClick={() => updateSyncConfig({ overlayType: 'black' })} className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${syncConfig.overlayType === 'black' ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}>黒</button>
                      <button type="button" onClick={() => updateSyncConfig({ overlayType: 'white' })} className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${syncConfig.overlayType === 'white' ? 'bg-white border-white text-black' : 'bg-white/5 border-white/10 text-white/40'}`}>白</button>
                    </div>
                  </div>
                  {syncConfig.overlayType && syncConfig.overlayType !== 'none' && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[8px] text-white/40 font-mono">
                        <span>不透明度</span>
                        <span>{Math.round((syncConfig.overlayIntensity ?? 0.5) * 100)}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.05" value={syncConfig.overlayIntensity ?? 0.5} 
                        onChange={(e) => updateSyncConfig({ overlayIntensity: parseFloat(e.target.value) })}
                        className="w-full accent-cyan-500 bg-white/10 h-1.5 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 右カラム：ラップ通知表示 */}
            <div className="space-y-6">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Type size={14} className="text-pink-500" />
                  <span className="text-[10px] font-bold text-white/60 font-cinzel tracking-widest uppercase">ラップタイム表示設定</span>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">ラップ通知表示モード</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => updateSyncConfig({ lapDisplayMode: 'hidden' })}
                        className={`py-1.5 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${syncConfig.lapDisplayMode === 'hidden' ? 'bg-pink-500/20 border-pink-500/50 text-white shadow-[0_0_10px_rgba(236,72,153,0.15)]' : 'bg-white/5 border-white/10 text-white/40'}`}
                      >
                        非表示
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSyncConfig({ lapDisplayMode: 'overlay' })}
                        className={`py-1.5 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${syncConfig.lapDisplayMode === 'overlay' || !syncConfig.lapDisplayMode ? 'bg-pink-500/20 border-pink-500/50 text-white shadow-[0_0_10px_rgba(236,72,153,0.15)]' : 'bg-white/5 border-white/10 text-white/40'}`}
                      >
                        フラッシュ (8秒)
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSyncConfig({ lapDisplayMode: 'persistent' })}
                        className={`py-1.5 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${syncConfig.lapDisplayMode === 'persistent' ? 'bg-pink-500/20 border-pink-500/50 text-white shadow-[0_0_10px_rgba(236,72,153,0.15)]' : 'bg-white/5 border-white/10 text-white/40'}`}
                      >
                        常時表示
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">ラップバナー表示位置</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateSyncConfig({ lapDisplayPosition: 'top' })}
                        disabled={syncConfig.lapDisplayMode === 'hidden'}
                        className={`py-1.5 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${syncConfig.lapDisplayMode === 'hidden' ? 'opacity-30 cursor-not-allowed' : ''} ${syncConfig.lapDisplayPosition === 'top' || !syncConfig.lapDisplayPosition ? 'bg-amber-500/20 border-amber-500/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                      >
                        上部
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSyncConfig({ lapDisplayPosition: 'bottom' })}
                        disabled={syncConfig.lapDisplayMode === 'hidden'}
                        className={`py-1.5 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${syncConfig.lapDisplayMode === 'hidden' ? 'opacity-30 cursor-not-allowed' : ''} ${syncConfig.lapDisplayPosition === 'bottom' ? 'bg-amber-500/20 border-amber-500/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                      >
                        下部
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">ラップバナー帯のサイズ</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['small', 'medium', 'large'] as const).map((sz) => (
                          <button
                            type="button"
                            key={sz}
                            onClick={() => updateSyncConfig({ lapBandSize: sz })}
                            disabled={syncConfig.lapDisplayMode === 'hidden'}
                            className={`py-1.5 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${syncConfig.lapDisplayMode === 'hidden' ? 'opacity-30 cursor-not-allowed' : ''} ${syncConfig.lapBandSize === sz || (sz === 'medium' && !syncConfig.lapBandSize) ? 'bg-pink-500/20 border-pink-500/50 text-white shadow-[0_0_10px_rgba(236,72,153,0.15)]' : 'bg-white/5 border-white/10 text-white/40'}`}
                          >
                            {sz === 'small' ? '小' : sz === 'medium' ? '中' : '大'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">ラップバナー文字サイズ</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['small', 'medium', 'large'] as const).map((sz) => (
                          <button
                            type="button"
                            key={sz}
                            onClick={() => updateSyncConfig({ lapFontSize: sz })}
                            disabled={syncConfig.lapDisplayMode === 'hidden'}
                            className={`py-1.5 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${syncConfig.lapDisplayMode === 'hidden' ? 'opacity-30 cursor-not-allowed' : ''} ${syncConfig.lapFontSize === sz || (sz === 'medium' && !syncConfig.lapFontSize) ? 'bg-pink-500/20 border-pink-500/50 text-white shadow-[0_0_10px_rgba(236,72,153,0.15)]' : 'bg-white/5 border-white/10 text-white/40'}`}
                          >
                            {sz === 'small' ? '小' : sz === 'medium' ? '中' : '大'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右側：ライブプレビュー (1カラム幅) */}
          <div className="lg:col-span-1">
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 shadow-2xl space-y-4">
              <DummyPreview config={syncConfig} backgroundImage={scenario.backgroundImage} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
