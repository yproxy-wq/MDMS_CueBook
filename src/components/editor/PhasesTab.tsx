
import React from 'react';
import { Scenario, Phase, ScriptBlock } from '../../types';
import { 
  ArrowUp, ArrowDown, Trash2, 
  ChevronUp, ChevronDown, Clock3, X, 
  AlignLeft, List as ListIcon, CheckSquare,
  Plus, FileText, Image as ImageIcon, Upload
} from 'lucide-react';
import { EasyEditorBlock } from './EasyEditorBlock';
import { OutlineEditor } from './OutlineEditor';
import { HelpTooltip } from './HelpTooltip';
import { ColorPicker } from './ColorPicker';

const formatToMMSS = (minutes: number): string => {
  const totalSeconds = Math.round(minutes * 60);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const parseFromMMSS = (str: string): number => {
  const cleaned = str.trim();
  if (!cleaned) return 0;
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    const m = parseInt(parts[0], 10) || 0;
    const s = parseInt(parts[1], 10) || 0;
    return m + s / 60;
  } else {
    const val = parseFloat(cleaned) || 0;
    return val;
  }
};

interface MMSSInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const MMSSInput: React.FC<MMSSInputProps> = ({ value, onChange, className, placeholder, disabled }) => {
  const [tempVal, setTempVal] = React.useState(formatToMMSS(value));

  React.useEffect(() => {
    setTempVal(formatToMMSS(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let text = e.target.value;
    text = text.replace(/[^0-9:]/g, '');
    setTempVal(text);
  };

  const handleBlur = () => {
    const parsed = parseFromMMSS(tempVal);
    onChange(parsed);
    setTempVal(formatToMMSS(parsed));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const parsed = parseFromMMSS(tempVal);
      onChange(parsed);
      setTempVal(formatToMMSS(parsed));
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type="text"
      value={tempVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
    />
  );
};

const generateId = (prefix: string) => `${prefix}-${Date.now()}`;

const compressImage = (dataUrl: string, maxWidth: number = 1920): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      
      const TARGET_SIZE = 700 * 1024;
      const TARGET_BASE64_LENGTH = TARGET_SIZE * 1.33;
      
      let quality = 0.8;
      let result = canvas.toDataURL('image/jpeg', quality);
      
      if (result.length > TARGET_BASE64_LENGTH) {
        while (result.length > TARGET_BASE64_LENGTH && quality > 0.1) {
          quality -= 0.15;
          result = canvas.toDataURL('image/jpeg', quality);
        }
      }

      if (result.length > TARGET_BASE64_LENGTH) {
        let scale = 0.7;
        while (result.length > TARGET_BASE64_LENGTH && scale > 0.2) {
          const sWidth = width * scale;
          const sHeight = height * scale;
          const sCanvas = document.createElement('canvas');
          sCanvas.width = sWidth;
          sCanvas.height = sHeight;
          const sCtx = sCanvas.getContext('2d');
          sCtx?.drawImage(img, 0, 0, sWidth, sHeight);
          result = sCanvas.toDataURL('image/jpeg', 0.4);
          scale -= 0.15;
        }
      }

      resolve(result);
    };
    img.src = dataUrl;
  });
};

interface PhasesTabProps {
  scenario: Scenario;
  onUpdate: (updates: Partial<Scenario>) => void;
  collapsedPhases: Set<string>;
  onToggleCollapse: (id: string) => void;
  onSetAllCollapsed: (collapsed: boolean) => void;
  onTabChange?: (tab: 'phases' | 'sounds' | 'characters' | 'scenario' | 'identity' | 'media' | 'snapshots') => void;
}

export const PhasesTab: React.FC<PhasesTabProps> = React.memo(({ 
  scenario, onUpdate, collapsedPhases, onToggleCollapse, onSetAllCollapsed, onTabChange
}) => {
  const [localPhaseNames, setLocalPhaseNames] = React.useState<Record<string, string>>({});
  const [deletingPhaseId, setDeletingPhaseId] = React.useState<string | null>(null);
  const [deletingBlockId, setDeletingBlockId] = React.useState<string | null>(null);
  const [lapErrors, setLapErrors] = React.useState<Record<string, string>>({});
  const [settingsCollapsed, setSettingsCollapsed] = React.useState<Record<string, boolean>>({});
  
  const showLapError = (phaseId: string, message: string) => {
    setLapErrors(prev => ({ ...prev, [phaseId]: message }));
    setTimeout(() => {
      setLapErrors(prev => {
        const next = { ...prev };
        if (next[phaseId] === message) {
          delete next[phaseId];
        }
        return next;
      });
    }, 4000);
  };
  const debounceTimers = React.useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const fileInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  const handleBlockFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    phaseId: string,
    bi: number,
    blocks: ScriptBlock[]
  ) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    
    const fType = String(file.type || '');
    const fName = String(file.name || '');
    const isPdf = fType.includes('pdf') || fName.endsWith('.pdf');

    // Warning for large PDFs
    if (isPdf && file.size > 700 * 1024) {
      const mbSize = (file.size / (1024 * 1024)).toFixed(2);
      const ok = window.confirm(
        `【警告/データ容量注意】\n選択したPDFの容量は ${mbSize} MB です。本アプリの推奨最大サイズは 700 KB (0.7 MB) 以下です。\n\n大容量PDFをそのままアップロードすると、同期の失敗や動作速度低下の原因になります。以下を強く推奨します：\n\n1. クラウド（Dropbox等）に保存し、そのURLを登録する（容量消費0 KB）\n2. 必要な重要ページだけにPDFを分割してアップロードする\n3. タブレット用に解像度を下げた圧縮PDFとして再出力する\n\nこのままアップロードを続行しますか？`
      );
      if (!ok) {
        e.target.value = '';
        return;
      }
    }

    let dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (re) => resolve(re.target?.result as string);
      reader.readAsDataURL(file);
    });

    if (!isPdf && file.size > 700 * 1024) {
      // Compress image
      dataUrl = await compressImage(dataUrl);
    }

    const newId = `img-${Math.random().toString(36).substring(2, 7)}`;
    const newResource = {
      id: newId,
      name: file.name,
      url: dataUrl,
      type: isPdf ? ('pdf' as const) : ('image' as const),
      updatedAt: Date.now()
    };

    onUpdate({
      images: [...(scenario.images || []), newResource],
      phases: (scenario.phases || []).map(p => {
        if (p.id === phaseId) {
          const nextBlocks = [...blocks];
          nextBlocks[bi] = { ...nextBlocks[bi], content: newId };
          return { ...p, scriptBlocks: nextBlocks };
        }
        return p;
      })
    });

    e.target.value = '';
  };

  const handlePhaseNameChange = (phaseId: string, name: string) => {
    setLocalPhaseNames(prev => ({ ...prev, [phaseId]: name }));
    
    if (debounceTimers.current[phaseId]) clearTimeout(debounceTimers.current[phaseId]);
    debounceTimers.current[phaseId] = setTimeout(() => {
      updatePhase(phaseId, { name });
    }, 500);
  };
  const phases = React.useMemo(() => scenario.phases || [], [scenario.phases]);
  const sounds = React.useMemo(() => scenario.sounds || [], [scenario.sounds]);

  const updatePhase = (phaseId: string, updates: Partial<Phase>) => {
    onUpdate({
      phases: phases.map(p => p.id === phaseId ? { ...p, ...updates } : p)
    });
  };

  const updateBlock = (phaseId: string, bi: number, blocks: ScriptBlock[], updates: Partial<ScriptBlock>) => {
    const next = [...blocks];
    next[bi] = { ...next[bi], ...updates };
    updatePhase(phaseId, { scriptBlocks: next });
  };

  const addPhase = () => {
    const phaseId = generateId('p');
    onUpdate({
      phases: [
        ...phases, 
        {
          id: phaseId, 
          name: '新規フェーズ', 
          description: '', 
          script: '', 
          scriptBlocks: [], 
          checklists: [], 
          timers: [
            { id: 't-' + phaseId, label: 'タイマー', durationMinutes: 10 }
          ], 
          bufferDurationMinutes: 0,
          recommendedSounds: [], 
          targetDurationMinutes: 10
        }
      ]
    });
  };

  const movePhase = (idx: number, dir: 'up' | 'down') => {
    const next = [...phases];
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    onUpdate({ phases: next });
  };

  const removePhase = (id: string) => {
    onUpdate({
      phases: phases.filter(p => p.id !== id)
    });
  };

  const addBlock = (phaseId: string, type: ScriptBlock['type']) => {
    const blockId = generateId(`b-${type}`);
    const next = [...(phases.find(p => p.id === phaseId)?.scriptBlocks || []), { 
      id: blockId, 
      type, 
      content: '',
      label: type === 'pdf' ? 'Script PDF' : type === 'image' ? 'Reference Image' : ''
    }];
    updatePhase(phaseId, { scriptBlocks: next });
  };

  const moveBlock = (phaseId: string, bi: number, dir: 'up' | 'down') => {
    const phase = phases.find(p => p.id === phaseId);
    if (!phase || !phase.scriptBlocks) return;
    const next = [...phase.scriptBlocks];
    const targetIdx = dir === 'up' ? bi - 1 : bi + 1;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    [next[bi], next[targetIdx]] = [next[targetIdx], next[bi]];
    updatePhase(phaseId, { scriptBlocks: next });
  };

  return (
    <div className="space-y-3 md:space-y-4 animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-3">
          <h2 className="hidden md:block text-base font-bold text-white/70 font-cinzel uppercase tracking-[0.2em]">進行タイムライン</h2>
          <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/5">
            <button 
              onClick={() => onSetAllCollapsed(true)}
              className="px-2 py-1 text-[8px] font-black font-cinzel text-white/30 hover:text-white transition-colors"
            >CLOSE ALL</button>
            <button 
              onClick={() => onSetAllCollapsed(false)}
              className="px-2 py-1 text-[8px] font-black font-cinzel text-white/30 hover:text-white transition-colors"
            >OPEN ALL</button>
          </div>
        </div>
        <button 
          onClick={addPhase} 
          className="px-3 py-1 bg-zinc-900 border border-white/10 rounded-lg text-[10px] font-bold text-white/70 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-2 font-cinzel uppercase shadow-lg shadow-black/40"
        >
          <Plus size={14} className="text-sky-500" /> フェーズ追加
        </button>
      </div>

      <div className="space-y-2">
        {phases.map((phase, idx) => {
          const isCollapsed = collapsedPhases.has(phase.id);
          const pColor = phase.themeColor || scenario.themeColor || '#1e50a2';
          return (
            <div 
              key={phase.id} 
              className="bg-[#111]/50 border rounded-xl overflow-hidden flex flex-col transition-all shadow-xl"
              style={{
                borderColor: `${pColor}2b`,
                boxShadow: isCollapsed ? 'none' : `0 0 30px ${pColor}05`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${pColor}55`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${pColor}2b`;
              }}
            >
              <div 
                className="p-2 px-4 flex items-center justify-between border-b bg-[#151515]/80 relative cursor-pointer select-none hover:bg-[#1c1c1c]/90 transition-colors"
                style={{
                  borderBottomColor: `${pColor}15`
                }}
                onClick={() => onToggleCollapse(phase.id)}
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 w-[4px]" 
                  style={{ backgroundColor: pColor }}
                />
                <div className="flex items-center gap-3 pl-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center">
                    <button 
                      onClick={(e) => { e.stopPropagation(); movePhase(idx, 'up'); }} 
                      disabled={idx === 0} 
                      className="p-1 text-white/30 hover:text-white disabled:opacity-0 transition-opacity"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); movePhase(idx, 'down'); }} 
                      disabled={idx === phases.length - 1} 
                      className="p-1 text-white/30 hover:text-white disabled:opacity-0 transition-opacity"
                    >
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="font-mono font-black text-sm"
                      style={{ color: pColor }}
                    >
                      {idx + 1}.
                    </span>
                    <input 
                      value={(localPhaseNames[phase.id] !== undefined ? localPhaseNames[phase.id] : phase.name) || ''} 
                      onChange={e => handlePhaseNameChange(phase.id, e.target.value)} 
                      onClick={(e) => e.stopPropagation()}
                      className="bg-white/5 border border-white/10 hover:border-white/20 focus:border-white/30 focus:bg-white/10 text-[13px] font-extrabold text-zinc-100 rounded px-2.5 py-1 outline-none w-full md:w-[350px] placeholder-white/20 transition-all" 
                      placeholder="フェーズ名..." 
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="hidden lg:inline text-[9px] font-mono font-black text-white/20 tracking-widest mr-3">
                    {phase.targetDurationMinutes || 0}M / {(phase.timers || []).length}T / {(phase.scriptBlocks || []).length}B
                  </span>
                  
                  {/* Collapsible Trigger */}
                  <button 
                    onClick={(e) => { e.stopPropagation(); onToggleCollapse(phase.id); }} 
                    className="p-1.5 text-zinc-400 hover:text-white transition-all rounded hover:bg-white/5"
                  >
                    {isCollapsed ? <ChevronDown size={18}/> : <ChevronUp size={18}/>}
                  </button>
                  
                  {/* Divider to avoid accidental click */}
                  <div className="w-[1px] h-4 bg-white/10 mx-2" />

                  {/* Deleting Button */}
                  {deletingPhaseId === phase.id ? (
                    <div className="flex items-center gap-1 bg-red-950/80 border border-red-500/30 px-2 py-0.5 rounded-lg animate-in fade-in zoom-in-95 duration-150 shrink-0">
                      <span className="text-[10px] text-red-200 font-bold font-sans">フェーズ削除？</span>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhase(phase.id);
                          setDeletingPhaseId(null);
                        }} 
                        className="p-1 text-red-400 hover:text-white hover:bg-red-500/20 rounded transition-all text-[9.5px] font-black uppercase tracking-wider"
                      >
                        はい
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingPhaseId(null);
                        }} 
                        className="p-1 text-white/40 hover:text-white hover:bg-white/5 rounded transition-all text-[9.5px] font-bold"
                      >
                        いいえ
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingPhaseId(phase.id);
                      }} 
                      className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {!isCollapsed && (
                <div className="p-4 space-y-4">
                  {(() => {
                    const singleTimer = (phase.timers && phase.timers[0]) || { id: 't-' + phase.id, label: 'タイマー', durationMinutes: 10 };
                    const timerMin = singleTimer.durationMinutes || 0;
                    const buffer = phase.bufferDurationMinutes !== undefined ? phase.bufferDurationMinutes : 0;
                    const target = timerMin + buffer;
                    const isSettingsCollapsed = settingsCollapsed[phase.id] !== false;
                    const selectedSounds = (phase.recommendedSounds || [])
                      .map(id => sounds.find(s => s.id === id))
                      .filter(Boolean);

                    return (
                      <div className="space-y-3">
                        {/* 設定概要バー（折りたたまれても見えるバー） */}
                        <div 
                          className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-2 px-3 bg-zinc-900/60 border border-white/5 rounded-xl hover:bg-zinc-900/95 hover:border-white/10 transition-all cursor-pointer select-none"
                          onClick={() => setSettingsCollapsed(prev => ({ ...prev, [phase.id]: !isSettingsCollapsed }))}
                        >
                          {/* タイマー情報 */}
                          <div className="flex items-center gap-2 text-[11px] font-mono text-white/50 shrink-0">
                            <Clock3 size={12} className="text-white/40" />
                            <span className="font-bold text-white/80">{formatToMMSS(timerMin)}</span>
                            <span className="text-white/20">+</span>
                            <span className="font-bold text-white/80">{formatToMMSS(buffer)}</span>
                            <span className="text-white/20">=</span>
                            <span className="font-extrabold text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/10">{formatToMMSS(target)}</span>
                            <span className="text-[10px] text-white/30 font-sans ml-1">予定時間</span>
                          </div>

                          {/* 推奨音源情報 */}
                          <div className="flex items-center gap-1.5 overflow-hidden flex-1 md:border-l md:border-white/5 md:pl-4">
                            <span className="text-[9px] uppercase font-black text-white/30 tracking-wider shrink-0">推奨音源:</span>
                            {selectedSounds.length > 0 ? (
                              <div className="flex flex-wrap gap-1 items-center max-h-[22px] overflow-hidden">
                                {selectedSounds.map(s => (
                                  <span key={s!.id} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-white/60 border border-white/5 truncate max-w-[120px]">
                                    {s!.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[9px] italic text-white/20">設定なし</span>
                            )}
                          </div>

                          {/* 個別カラー & 編集トグルボタン */}
                          <div className="flex items-center gap-3 shrink-0 md:border-l md:border-white/5 md:pl-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2 bg-black/20 hover:bg-black/40 px-2 py-1 rounded-lg border border-white/5 transition-all">
                              <span className="text-[9px] font-black text-white/40 uppercase tracking-wider">カラー</span>
                              <ColorPicker 
                                value={phase.themeColor || scenario.themeColor || '#1e50a2'} 
                                onChange={val => updatePhase(phase.id, {themeColor: val})} 
                              />
                            </div>

                            <button
                              onClick={() => setSettingsCollapsed(prev => ({ ...prev, [phase.id]: !isSettingsCollapsed }))}
                              className="p-1 px-2.5 rounded bg-white/5 hover:bg-white/10 text-[9.5px] font-black tracking-wider uppercase transition-colors flex items-center gap-1 border border-white/5 text-white/70 hover:text-white"
                            >
                              <span>タイマー・音源設定</span>
                              {isSettingsCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                            </button>
                          </div>
                        </div>

                        {/* 詳細設定エリア */}
                        {!isSettingsCollapsed && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200" id={`phase-settings-grid-${phase.id}`}>
                            {/* 1. タイマー、バッファ、予定時間、フェーズカラー設定 (左カラム) */}
                            <div className="space-y-4 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                <div className="space-y-2">
                                  <label className="text-[8px] uppercase font-black text-white/20 tracking-widest flex items-center gap-1.5">
                                   <Clock3 size={10}/> タイマー設定
                                   <HelpTooltip title="タイマー設定" content="このフェーズのタイマー名を設定します。" />
                                 </label>
                                 <div className="space-y-1">
                                      <div className="flex items-center gap-2 bg-black/40 border border-white/5 p-1 px-2.5 rounded-lg group/timer hover:border-white/10 h-[28px]">
                                         <input 
                                           value={singleTimer.label || ''} 
                                           onChange={e => {
                                             const updatedTimer = { ...singleTimer, label: e.target.value };
                                             updatePhase(phase.id, {
                                               timers: [updatedTimer]
                                             });
                                           }} 
                                           className="bg-transparent flex-1 text-[11px] font-bold outline-none text-white/50 focus:text-white" 
                                           placeholder="タイマー名..." 
                                         />
                                      </div>
                                 </div>
                                 {onTabChange && (
                                   <div className="mt-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-sky-500/5 border border-sky-500/10 rounded-lg text-[9.5px] leading-relaxed text-zinc-400">
                                     <span>共有画面（子ウィンドウ）でのタイマーの大きさや初期配置・カラー等は、パレットアイコンの「シナリオ全体設定」から一括カスタマイズ可能です。</span>
                                     <button
                                       type="button"
                                       onClick={() => onTabChange('scenario')}
                                       className="shrink-0 px-2 py-0.5 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 hover:border-sky-500/30 rounded text-[9px] font-bold transition-all cursor-pointer whitespace-nowrap self-end sm:self-center"
                                     >
                                       設定へ移動 ↗
                                     </button>
                                   </div>
                                 )}
                               </div>

                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[8px] uppercase font-black text-white/20 tracking-widest font-cinzel">
                                    <span className="flex items-center gap-1">タイマー <HelpTooltip title="タイマー時間" content="このフェーズの制限時間です。" iconSize={10} /></span>
                                    <span>+</span>
                                    <span className="flex items-center gap-1">バッファ <HelpTooltip title="バッファ時間" content="タイマーとしては表示されない余裕時間です。" iconSize={10} /></span>
                                    <span>=</span>
                                    <span className="text-sky-400 flex items-center gap-1">予定時間 <HelpTooltip title="予定時間 (自動計算)" content="タイマー時間とバッファを足し合わせた、このフェーズ全体の予定時間です。" iconSize={10} /></span>
                                  </div>
                                  <div className="flex items-center gap-1.5 font-mono text-[16px]">
                                    <div className="flex-1 min-w-0">
                                      <MMSSInput 
                                        value={timerMin} 
                                        onChange={nextMin => {
                                          const currentLaps = singleTimer.lapTimes || [];
                                          const filteredLaps = currentLaps.filter(l => l <= nextMin);
                                          const updatedTimer = { ...singleTimer, durationMinutes: nextMin, lapTimes: filteredLaps };
                                          updatePhase(phase.id, {
                                            timers: [updatedTimer],
                                            targetDurationMinutes: nextMin + buffer
                                          });
                                        }} 
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-1 text-center font-bold text-white outline-none focus:border-white/30 transition-all h-[32px] text-[16px]" 
                                        placeholder="00:00"
                                      />
                                    </div>
                                    <span className="text-white/20 shrink-0">+</span>
                                    <div className="flex-1 min-w-0">
                                      <MMSSInput 
                                        value={buffer} 
                                        onChange={nextBuffer => {
                                          updatePhase(phase.id, {
                                            bufferDurationMinutes: nextBuffer,
                                            targetDurationMinutes: timerMin + nextBuffer
                                          });
                                        }} 
                                        className="w-full bg-black/40 border border-white/10 rounded-lg p-1 text-center font-bold text-white outline-none focus:border-white/30 transition-all h-[32px] text-[16px]" 
                                        placeholder="00:00"
                                      />
                                    </div>
                                    <span className="text-white/20 shrink-0">=</span>
                                    <div className="flex-1 min-w-0">
                                      <div className="w-full bg-black/60 border border-white/5 rounded-lg p-1 text-center font-bold text-sky-400 select-none h-[32px] text-[16px] flex items-center justify-center">
                                        {formatToMMSS(target)}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Lap Times Config */}
                                <div className="space-y-2 pt-1 border-t border-white/5">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[8px] uppercase font-black text-white/20 tracking-widest flex items-center gap-1.5 font-cinzel">
                                      ラップタイム (最大16個) <span className="text-sky-400 font-mono">({(singleTimer.lapTimes || []).length}/16)</span>
                                      <HelpTooltip title="ラップタイム設定" content="指定した残り時間（分）になった際に、強調表示と効果音（チャイム）を鳴らします。複数設定可能です。" />
                                    </label>
                                  </div>
                                  
                                  <div className="flex flex-col gap-2 p-2 bg-black/40 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        min="1"
                                        max={Math.floor(timerMin)}
                                        step="1"
                                        placeholder="残り分 (例: 10)"
                                        id={`lap-input-${phase.id}`}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const input = document.getElementById(`lap-input-${phase.id}`) as HTMLInputElement | null;
                                            if (!input) return;
                                            const val = parseInt(input.value, 10);
                                            if (isNaN(val) || val <= 0) return;
                                            
                                            if (val > timerMin) {
                                              showLapError(phase.id, `ラップタイム(${val}分)はタイマー時間(${Math.floor(timerMin)}分)以下で設定してください。`);
                                              return;
                                            }
                                            
                                            const currentLaps = singleTimer.lapTimes || [];
                                            if (currentLaps.includes(val)) {
                                              showLapError(phase.id, '既に設定済みのラップタイムです。');
                                              return;
                                            }
                                            if (currentLaps.length >= 16) {
                                              showLapError(phase.id, 'ラップタイムは最大16個まで設定可能です。');
                                              return;
                                            }
                                            
                                            const nextLaps = [...currentLaps, val].sort((a, b) => b - a);
                                            const updatedTimer = { ...singleTimer, lapTimes: nextLaps };
                                            updatePhase(phase.id, {
                                              timers: [updatedTimer]
                                            });
                                            input.value = '';
                                          }
                                        }}
                                        className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] font-bold text-white focus:outline-none focus:border-white/20 placeholder-white/10 h-[28px]"
                                      />
                                      <button
                                        onClick={() => {
                                          const input = document.getElementById(`lap-input-${phase.id}`) as HTMLInputElement | null;
                                          if (!input) return;
                                          const val = parseInt(input.value, 10);
                                          if (isNaN(val) || val <= 0) return;
                                          
                                          if (val > timerMin) {
                                            showLapError(phase.id, `ラップタイム(${val}分)はタイマー時間(${Math.floor(timerMin)}分)以下で設定してください。`);
                                            return;
                                          }
                                          
                                          const currentLaps = singleTimer.lapTimes || [];
                                          if (currentLaps.includes(val)) {
                                            showLapError(phase.id, '既に設定済みのラップタイムです。');
                                            return;
                                          }
                                          if (currentLaps.length >= 16) {
                                            showLapError(phase.id, 'ラップタイムは最大16個まで設定可能です。');
                                            return;
                                          }
                                          
                                          const nextLaps = [...currentLaps, val].sort((a, b) => b - a);
                                          const updatedTimer = { ...singleTimer, lapTimes: nextLaps };
                                          updatePhase(phase.id, {
                                            timers: [updatedTimer]
                                          });
                                          input.value = '';
                                        }}
                                        className="px-3 h-[28px] bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-[9px] font-black text-white/80 transition-colors font-sans uppercase tracking-wider"
                                      >
                                        追加
                                      </button>
                                    </div>

                                    {lapErrors[phase.id] && (
                                      <div className="text-[10px] text-red-400 font-bold px-1 py-0.5 bg-red-950/20 rounded border border-red-900/30 animate-in fade-in duration-200">
                                        {lapErrors[phase.id]}
                                      </div>
                                    )}
                                    
                                    <div className="space-y-1.5 mt-1">
                                      {(singleTimer.lapTimes || []).map((lap) => {
                                        const lapText = singleTimer.lapTexts?.[lap] || '';
                                        return (
                                          <div
                                            key={lap}
                                            className="flex items-center gap-2 p-1.5 bg-black/25 border border-white/5 rounded-lg w-full transition-all hover:border-white/10"
                                          >
                                            <span className="shrink-0 inline-flex items-center justify-center px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono text-[9px] font-black w-[55px] tracking-tight">
                                              {lap}分前
                                            </span>
                                            <input
                                              type="text"
                                              maxLength={20}
                                              placeholder={`PL表示: 残り ${lap} 分`}
                                              value={lapText}
                                              onChange={(e) => {
                                                const val = e.target.value.slice(0, 20);
                                                const updatedLapTexts = { ...(singleTimer.lapTexts || {}), [lap]: val };
                                                const updatedTimer = { ...singleTimer, lapTexts: updatedLapTexts };
                                                updatePhase(phase.id, {
                                                  timers: [updatedTimer]
                                                });
                                              }}
                                              className="flex-1 bg-white/5 border border-white/5 hover:border-white/10 focus:border-white/20 focus:bg-white/10 rounded-md px-2 py-1 text-[10px] text-white focus:outline-none placeholder-white/20 h-[26px] transition-all"
                                            />
                                            <button
                                              onClick={() => {
                                                const currentLaps = singleTimer.lapTimes || [];
                                                const nextLaps = currentLaps.filter(l => l !== lap);
                                                const updatedLapTexts = { ...(singleTimer.lapTexts || {}) };
                                                delete updatedLapTexts[lap];
                                                const updatedTimer = { ...singleTimer, lapTimes: nextLaps, lapTexts: updatedLapTexts };
                                                updatePhase(phase.id, {
                                                  timers: [updatedTimer]
                                                });
                                              }}
                                              className="w-5 h-5 rounded hover:bg-red-500/10 text-zinc-400 hover:text-red-400 flex items-center justify-center transition-all shrink-0"
                                            >
                                              <X size={10} />
                                            </button>
                                          </div>
                                        );
                                      })}
                                      {(!singleTimer.lapTimes || singleTimer.lapTimes.length === 0) && (
                                        <span className="text-[9px] text-white/20 italic pl-1 font-sans block py-1">設定なし (通常タイマー)</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                               <div className="flex items-center pt-2 border-t border-white/5">
                                 <label className="flex items-center gap-2 cursor-pointer group">
                                    <input 
                                      type="checkbox" 
                                      checked={phase.isLockedByPrevious || false} 
                                      onChange={e => updatePhase(phase.id, {isLockedByPrevious: e.target.checked})} 
                                      className="w-4 h-4 rounded bg-zinc-800 border-white/10 text-sky-600 focus:ring-0" 
                                    />
                                    <span className="text-[10px] font-bold text-white/20 group-hover:text-white/40 transition-colors">前フェーズ必須</span>
                                    <HelpTooltip title="進行ロック" content="このフェーズのチェックリストを全て完了しないと、次のフェーズに進めないように強制します。" iconSize={12} />
                                 </label>
                               </div>

                               <div className="space-y-1.5 pt-1">
                                  <label className="text-[8px] uppercase font-black text-white/20 font-cinzel flex items-center gap-1 tracking-widest">
                                     フェーズカラー (ムード)
                                     <HelpTooltip title="フェーズカラー" content="このフェーズ進行中にフェーズボタンの色を変化させる、独自のカラー（ムードカラー）を指定します。空白にすると、シナリオ全体のテーマカラーが使用されます。" />
                                  </label>
                                  <div className="flex flex-col gap-1.5 p-2.5 bg-black/30 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-2">
                                      <ColorPicker 
                                        value={phase.themeColor || scenario.themeColor || '#1e50a2'} 
                                        onChange={val => updatePhase(phase.id, {themeColor: val})} 
                                      />
                                      <div className="flex-1 flex flex-col justify-center">
                                        {phase.themeColor ? (
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] font-bold text-sky-400 font-sans">
                                              個別カラー設定中
                                            </span>
                                            <button
                                              onClick={() => updatePhase(phase.id, {themeColor: undefined})}
                                              className="px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-[8px] font-black tracking-wider uppercase transition-colors shrink-0"
                                              title="テーマカラーを自動継承する状態に戻します"
                                            >
                                              継承に戻す
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] font-bold text-white/40 font-sans">
                                            全体テーマカラーを継承中
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <p className="text-[9.5px] text-white/30 leading-relaxed font-sans">
                                      ※ 基本的にシナリオ全体のテーマカラーと同一になりますが、このフェーズだけ演出や雰囲気を変えたい場合に個別の色を別途設定することができます。
                                    </p>
                                  </div>
                               </div>
                            </div>

                            {/* 2. 推奨音源設定 (右カラム) */}
                            <div className="space-y-3 bg-white/[0.02] p-3 rounded-xl border border-white/5 flex flex-col justify-between">
                               <div className="space-y-1.5">
                                 <label className="text-[8px] uppercase font-black text-white/20 tracking-widest">推奨音源</label>
                                <div className="flex flex-wrap gap-1 p-2 bg-black/40 rounded-lg border border-white/5 min-h-[40px]">
                                  {sounds.map((s, idx) => (
                                    <button key={s.id} onClick={() => {
                                      const recommended = phase.recommendedSounds || [];
                                      const next = recommended.includes(s.id)
                                        ? recommended.filter(id => id !== s.id)
                                        : [...recommended, s.id];
                                      updatePhase(phase.id, {recommendedSounds: next});
                                    }} className={`px-2 py-0.5 rounded font-bold border transition-all ${ (phase.recommendedSounds || []).includes(s.id) ? 'bg-white/10 text-white border-white/20' : 'bg-transparent text-white/10 border-white/5 opacity-30 shadow-none'}`}
                                      style={{
                                        borderColor: '#666666',
                                        color: '#bbbaba',
                                        fontSize: idx === 0 || idx === 1 ? '11px' : '10px'
                                      }}
                                    >
                                      {s.name}
                                    </button>
                                  ))}
                                  {sounds.length === 0 && <span className="text-[8px] text-white/5 italic">No sounds defined</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  <div className="space-y-3 pt-3 border-t border-white/5">
                     <label className="text-[9px] uppercase font-black text-white/10 tracking-[0.2em] flex items-center gap-2">
                        <FileText size={12} /> 台本・内容ブロック
                     </label>
                     <div className="space-y-3">
                       {(phase.scriptBlocks || []).map((block, bi) => (
                         <div key={block.id} className="relative bg-white/[0.01] border border-white/10 rounded-xl p-3 md:p-4 group/block shadow-inner">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                               <div className="flex items-center gap-3">
                                  <div className="flex bg-black/60 rounded-lg p-0.5 border border-white/5 shadow-lg">
                                     {['markdown', 'outline', 'pdf', 'image'].map(type => (
                                       <button 
                                         key={type}
                                         onClick={() => updateBlock(phase.id, bi, phase.scriptBlocks || [], { type: type as ScriptBlock['type'] })} 
                                         className={`px-3 py-1 text-[8px] font-black font-cinzel rounded transition-all ${block.type === type ? 'bg-white/10 text-white' : 'text-white/10 hover:text-white/30 uppercase'}`}
                                       >{type.toUpperCase()}</button>
                                     ))}
                                  </div>
                                  <input 
                                    value={block.label || ''} 
                                    onChange={e => updateBlock(phase.id, bi, phase.scriptBlocks || [], { label: e.target.value })}
                                    className="bg-zinc-900/50 border border-white/5 rounded-lg px-3 py-1 text-[11px] font-bold text-white/40 focus:text-white focus:border-white/20 outline-none w-32 md:w-48 placeholder-white/5"
                                    placeholder="BLOCK LABEL..."
                                  />
                               </div>
                               <div className="flex items-center gap-0.5">
                                  <button onClick={() => moveBlock(phase.id, bi, 'up')} disabled={bi === 0} className="p-1 px-2 text-white/10 hover:text-white transition-all disabled:opacity-0"><ArrowUp size={14}/></button>
                                  <button onClick={() => moveBlock(phase.id, bi, 'down')} disabled={bi === (phase.scriptBlocks?.length || 0) - 1} className="p-1 px-2 text-white/10 hover:text-white transition-all disabled:opacity-0"><ArrowDown size={14}/></button>
                                  {deletingBlockId === block.id ? (
                                    <div className="flex items-center gap-1 bg-red-950/80 border border-red-500/30 px-2 py-0.5 rounded-lg animate-in fade-in zoom-in-95 duration-150 shrink-0">
                                      <span className="text-[9px] text-red-200 font-bold">削除？</span>
                                      <button 
                                        onClick={() => {
                                          const next = (phase.scriptBlocks || []).filter((_, i) => i !== bi);
                                          updatePhase(phase.id, { scriptBlocks: next });
                                          setDeletingBlockId(null);
                                        }} 
                                        className="p-1 text-red-400 hover:text-white hover:bg-red-500/20 text-[9px] rounded transition-all font-black"
                                      >
                                        はい
                                      </button>
                                      <button 
                                        onClick={() => setDeletingBlockId(null)} 
                                        className="p-1 text-white/40 hover:text-white hover:bg-white/5 text-[9px] rounded transition-all font-bold"
                                      >
                                        いいえ
                                      </button>
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => setDeletingBlockId(block.id)} 
                                      className="p-1 px-2 text-white/10 hover:text-red-500 transition-all"
                                      title="このブロックを削除"
                                    >
                                      <Trash2 size={14}/>
                                    </button>
                                  )}
                               </div>
                            </div>
                            
                            <div className="animate-in fade-in duration-200">
                              {(block.type === 'pdf' || block.type === 'image') ? (
                                <div className="space-y-2 bg-black/60 p-4 rounded-xl border border-white/10 shadow-2xl">
                                  <div className="flex items-center justify-between gap-4">
                                     <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2 mb-1">
                                           <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${block.type === 'pdf' ? 'bg-red-500' : 'bg-purple-500'}`}></div>
                                           <label className="text-[10px] font-black text-white/20 uppercase tracking-widest font-cinzel">Select Source</label>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <select 
                                            className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-[11px] font-bold text-white/60 focus:text-white outline-none cursor-pointer transition-all hover:border-white/20"
                                            value={(scenario.images || []).some(r => r.id === block.content) ? block.content : ''}
                                            onChange={e => {
                                              if (e.target.value) {
                                                updateBlock(phase.id, bi, phase.scriptBlocks || [], { content: e.target.value });
                                              }
                                            }}
                                          >
                                            <option value="">-- メディアリソースから選択 --</option>
                                            {(scenario.images || []).filter(r => r.type === block.type).map(r => (
                                              <option key={r.id} value={r.id}>{r.name} ([[{r.id}]])</option>
                                            ))}
                                          </select>
                                          
                                          <button
                                            type="button"
                                            onClick={() => fileInputRefs.current[block.id]?.click()}
                                            className="p-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg transition-all flex items-center justify-center shrink-0 shadow-lg shadow-purple-900/40 active:scale-95 border border-purple-400/20"
                                            title={`${block.type.toUpperCase()}をアップロードして設定`}
                                          >
                                            <Upload size={14} />
                                          </button>
                                          
                                          <input 
                                            type="file"
                                             ref={el => { fileInputRefs.current[block.id] = el; }}
                                            accept={block.type === 'pdf' ? 'application/pdf' : 'image/*'}
                                            onChange={e => handleBlockFileUpload(e, phase.id, bi, phase.scriptBlocks || [])}
                                            className="hidden"
                                          />
                                        </div>
                                     </div>
                                     <div className="text-center px-4 text-white/5 font-black font-cinzel text-[10px] uppercase">OR</div>
                                     <div className="flex-1 space-y-1">
                                        <div className="flex items-center gap-2 mb-1">
                                           <label className="text-[10px] font-black text-white/20 uppercase tracking-widest font-cinzel">External URL</label>
                                        </div>
                                        <input 
                                          value={block.content.startsWith('data:') ? 'Local Resource (Uploaded)' : block.content} 
                                          onChange={e => updateBlock(phase.id, bi, phase.scriptBlocks || [], { content: e.target.value })} 
                                          className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-[11px] font-mono text-white/40 focus:text-white outline-none transition-all" 
                                          placeholder="https://..." 
                                        />
                                     </div>
                                  </div>
                                  
                                  {block.content && (
                                    <div className={`mt-3 p-2 rounded-lg border border-dashed flex items-center justify-between text-[9px] font-mono
                                      ${block.type === 'pdf' ? 'border-red-500/20 bg-red-500/5 text-red-400' : 'border-purple-500/20 bg-purple-500/5 text-purple-400'}`}
                                    >
                                       <span className="truncate max-w-[80%]">Linked: {block.content}</span>
                                       <span className="font-sans font-bold uppercase tracking-tighter opacity-40">Active</span>
                                    </div>
                                  )}
                                </div>
                              ) : block.type === 'outline' ? (
                                <OutlineEditor initialContent={block.content} onChange={c => {
                                  const next = [...(phase.scriptBlocks || [])];
                                  next[bi] = { ...next[bi], content: c };
                                  updatePhase(phase.id, { scriptBlocks: next });
                                }} />
                              ) : (
                                <EasyEditorBlock 
                                  initialContent={block.content} 
                                  images={scenario.images || []}
                                  themeColor={pColor}
                                  onChange={c => {
                                  const next = [...(phase.scriptBlocks || [])];
                                  next[bi] = { ...next[bi], content: c };
                                  updatePhase(phase.id, { scriptBlocks: next });
                                }} />
                              )}
                            </div>
                         </div>
                       ))}
                       
                       <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-2">
                          {[
                            { type: 'markdown', icon: <AlignLeft size={14}/>, label: '+ MD_GUIDE' },
                            { type: 'outline', icon: <ListIcon size={14}/>, label: '+ OUTLINE' },
                            { type: 'pdf', icon: <FileText size={14}/>, label: '+ PDF_BLOCK' },
                            { type: 'image', icon: <ImageIcon size={14}/>, label: '+ IMG_BLOCK' }
                          ].map(btn => (
                            <button key={btn.type} onClick={() => addBlock(phase.id, btn.type as ScriptBlock['type'])} className="flex items-center justify-center gap-2 py-3 bg-white/5 border border-dashed border-white/10 rounded-xl text-[9px] font-black text-white/20 hover:text-white/50 hover:bg-white/[0.07] hover:border-white/30 transition-all font-cinzel shadow-sm">
                               {btn.icon} {btn.label}
                            </button>
                          ))}
                       </div>
                     </div>
                  </div>

                  <div className="pt-3 border-t border-white/5">
                    <label className="text-[9px] uppercase font-black text-white/10 flex items-center gap-1.5 mb-2"><CheckSquare size={14}/> 進行チェックリスト</label>
                    <div className="space-y-1">
                      {(phase.checklists || []).map((c, ci) => (
                        <div key={ci} className="flex items-center gap-2 bg-black/40 border border-white/5 p-1 px-3 rounded-lg group/check hover:bg-black/60 transition-colors">
                           <div className="w-3.5 h-3.5 rounded border border-white/10 flex items-center justify-center shrink-0 opacity-20"><div className="w-1 h-1 bg-white" /></div>
                           <input value={c || ''} onChange={e => {
                                const next = [...(phase.checklists || [])];
                                next[ci] = e.target.value;
                                updatePhase(phase.id, {checklists: next});
                              }} className="bg-transparent flex-1 text-[12px] font-bold outline-none text-white/40 focus:text-white" placeholder="内容..." />
                           <button onClick={() => updatePhase(phase.id, {checklists: (phase.checklists || []).filter((_, i) => i !== ci)})} className="text-white/10 hover:text-red-500 p-1 opacity-0 group-hover/check:opacity-100 transition-opacity"><X size={14}/></button>
                        </div>
                      ))}
                      <button onClick={() => updatePhase(phase.id, {checklists: [...(phase.checklists || []), '']})} className="w-full py-1.5 bg-white/[0.02] border border-dashed border-white/5 rounded-lg text-[9px] font-bold text-white/10 hover:text-white/30 transition-all">+ 新規追加</button>
                    </div>
                  </div>

                  <div className="pt-1 flex justify-center">
                    <button onClick={() => onToggleCollapse(phase.id)} className="px-4 py-1.5 text-[8px] font-black text-white/10 hover:text-white/30 transition-all font-cinzel uppercase tracking-[0.3em] flex items-center gap-2 group">
                       <ChevronUp size={12} className="group-hover:-translate-y-0.5 transition-transform" /> CLOSE
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
