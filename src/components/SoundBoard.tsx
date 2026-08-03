
import React, { useCallback, useMemo, useState } from 'react';
import { SoundConfig, SoundType, ImageResource, SoundCluster, Phase } from '../types';
import { TimerSyncData } from '../services/SyncService';
import { Volume2, VolumeX, Play, Pause, Square, Video, RotateCcw, Tv, GripVertical, Layers, Plus, Trash2, Zap, FolderKanban, Check, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SoundCard from './SoundCard';

interface SoundBoardProps {
  sounds: SoundConfig[];
  isPlaying: Record<string, boolean>;
  onToggleSound: (sound: SoundConfig) => void;
  onPlaySound?: (sound: SoundConfig) => void;
  onStopSound?: (soundId: string) => void;
  onUpdateSoundConfig?: (soundId: string, updates: Partial<SoundConfig>) => void;
  recommendedIds: string[];
  themeColor: string;
  masterVolume: number;
  onMasterVolumeChange: (v: number) => void;
  showSideVolume?: boolean;
  isNarrow?: boolean;
  volumePosition?: 'right-center' | 'right-bottom';
  
  // Sound Clusters
  soundClusters?: SoundCluster[];
  onUpdateSoundClusters?: (clusters: SoundCluster[]) => void;
  currentPhaseId?: string;
  phases?: Phase[];

  // Video-specific controls
  images?: ImageResource[];
  syncData?: TimerSyncData | null;
  onControlVideo?: (videoId: string | null, action: 'play' | 'pause' | 'seek' | 'stop', time?: number) => void;
  onReorderSounds?: (sounds: SoundConfig[]) => void;
}

const MasterVolumeUnit: React.FC<{
  masterVolume: number;
  onMasterVolumeChange: (v: number) => void;
  showSideVolume: boolean;
  volumePosition: 'right-center' | 'right-bottom';
}> = React.memo(({ masterVolume, onMasterVolumeChange, showSideVolume, volumePosition }) => (
  <div 
    className={`w-12 bg-black/80 backdrop-blur-xl border border-white/10 flex flex-col items-center py-8 gap-6 shrink-0 shadow-2xl m-1 rounded-2xl group/vol transition-all duration-300 hover:border-white/20 ${showSideVolume && volumePosition?.includes('right') ? 'mr-12' : ''}`}
  >
    <div className="flex-1 relative flex items-center justify-center w-full min-h-[160px]">
      <input 
        type="range" min="0" max="1" step="0.01" value={masterVolume || 0}
        onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
        className="vertical-slider appearance-none w-[140px] h-1.5 bg-white/10 rounded-full cursor-pointer accent-white rotate-[-90deg] origin-center group-hover/vol:bg-white/20 transition-all"
      />
    </div>
    <div className="flex flex-col items-center gap-3 px-1">
      <span className="text-[10px] font-mono font-black text-white/80 tabular-nums tracking-tighter">
        {Math.round(masterVolume * 100)}%
      </span>
      <button 
        onClick={() => onMasterVolumeChange(masterVolume > 0 ? 0 : 0.8)}
        className={`p-2 rounded-full border transition-all duration-300 active:scale-90 ${masterVolume === 0 ? 'bg-red-500/20 border-red-500/40 text-red-500 scale-110' : 'bg-white/10 border-white/20 text-white/70 hover:text-white hover:border-white/45 hover:bg-white/15'}`}
      >
        {masterVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
    </div>
  </div>
));

const SoundBoard: React.FC<SoundBoardProps> = React.memo(({ 
  sounds = [], 
  isPlaying = {}, 
  onToggleSound, 
  onPlaySound,
  onStopSound,
  onUpdateSoundConfig,
  onReorderSounds,
  recommendedIds = [],
  themeColor,
  masterVolume,
  onMasterVolumeChange,
  showSideVolume = true,
  isNarrow = false,
  volumePosition = 'right-center',
  soundClusters = [],
  onUpdateSoundClusters,
  currentPhaseId = '',
  phases = [],
  images = [],
  syncData = null,
  onControlVideo
}) => {
  const [filter, setFilter] = useState<'all' | SoundType | 'clusters' | 'video'>('all');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Cluster state
  const [showClusterModal, setShowClusterModal] = useState<boolean>(false);
  const [editingClusterId, setEditingClusterId] = useState<string | null>(null);
  const [clusterName, setClusterName] = useState<string>('');
  const [clusterPhaseId, setClusterPhaseId] = useState<string>('');
  const [clusterSoundIds, setClusterSoundIds] = useState<string[]>([]);

  // Fallback clusters state if not managed by parent scenario
  const [localClusters, setLocalClusters] = useState<SoundCluster[]>([]);
  const effectiveClusters = useMemo(() => {
    return soundClusters && soundClusters.length > 0 ? soundClusters : localClusters;
  }, [soundClusters, localClusters]);

  const updateClusters = useCallback((nextClusters: SoundCluster[]) => {
    if (onUpdateSoundClusters) {
      onUpdateSoundClusters(nextClusters);
    } else {
      setLocalClusters(nextClusters);
    }
  }, [onUpdateSoundClusters]);

  // One-click Trigger Cluster
  const handleTriggerCluster = useCallback((cluster: SoundCluster) => {
    const clusterSoundSet = new Set(cluster.soundIds);
    const clusterBgmIds = sounds.filter(s => s.type === SoundType.BGM && clusterSoundSet.has(s.id)).map(s => s.id);

    // Stop currently playing BGMs if cluster has specific BGM
    if (clusterBgmIds.length > 0) {
      sounds.forEach(s => {
        if (s.type === SoundType.BGM && isPlaying[s.id] && !clusterSoundSet.has(s.id)) {
          if (onStopSound) {
            onStopSound(s.id);
          } else {
            onToggleSound(s);
          }
        }
      });
    }

    // Play all sounds in cluster
    sounds.forEach(s => {
      if (clusterSoundSet.has(s.id)) {
        if (!isPlaying[s.id]) {
          if (onPlaySound) {
            onPlaySound(s);
          } else {
            onToggleSound(s);
          }
        }
      }
    });
  }, [sounds, isPlaying, onStopSound, onPlaySound, onToggleSound]);

  // Save currently active sounds as a new Cluster
  const handleSaveActiveAsCluster = useCallback(() => {
    const activeIds = Object.keys(isPlaying).filter(id => isPlaying[id]);
    if (activeIds.length === 0) {
      alert("現在再生中のサウンドがありません。音響を再生してからクラスター保存してください。");
      return;
    }
    const currentPhase = phases.find(p => p.id === currentPhaseId);
    const defaultName = currentPhase ? `[${currentPhase.name}] サウンドクラスター` : `クラスター ${effectiveClusters.length + 1}`;
    
    const newCluster: SoundCluster = {
      id: `cluster_${Date.now()}`,
      name: defaultName,
      phaseId: currentPhaseId || undefined,
      soundIds: activeIds
    };

    updateClusters([...effectiveClusters, newCluster]);
    setFilter('clusters');
  }, [isPlaying, phases, currentPhaseId, effectiveClusters, updateClusters]);

  const handleOpenClusterModal = useCallback((cluster?: SoundCluster) => {
    if (cluster) {
      setEditingClusterId(cluster.id);
      setClusterName(cluster.name);
      setClusterPhaseId(cluster.phaseId || '');
      setClusterSoundIds(cluster.soundIds || []);
    } else {
      setEditingClusterId(null);
      setClusterName('');
      setClusterPhaseId(currentPhaseId || '');
      setClusterSoundIds(Object.keys(isPlaying).filter(id => isPlaying[id]));
    }
    setShowClusterModal(true);
  }, [currentPhaseId, isPlaying]);

  const handleSaveClusterModal = useCallback(() => {
    if (!clusterName.trim()) {
      alert("クラスター名を入力してください");
      return;
    }
    if (clusterSoundIds.length === 0) {
      alert("少なくとも1つのサウンドを選択してください");
      return;
    }

    if (editingClusterId) {
      const updated = effectiveClusters.map(c => c.id === editingClusterId ? {
        ...c,
        name: clusterName.trim(),
        phaseId: clusterPhaseId || undefined,
        soundIds: clusterSoundIds
      } : c);
      updateClusters(updated);
    } else {
      const newCluster: SoundCluster = {
        id: `cluster_${Date.now()}`,
        name: clusterName.trim(),
        phaseId: clusterPhaseId || undefined,
        soundIds: clusterSoundIds
      };
      updateClusters([...effectiveClusters, newCluster]);
    }
    setShowClusterModal(false);
  }, [clusterName, clusterSoundIds, editingClusterId, clusterPhaseId, effectiveClusters, updateClusters]);

  const handleDeleteCluster = useCallback((id: string) => {
    updateClusters(effectiveClusters.filter(c => c.id !== id));
  }, [effectiveClusters, updateClusters]);

  const filteredSounds = useMemo(() => {
    return (sounds || []).filter(s => filter === 'all' || s.type === filter);
  }, [sounds, filter]);

  const sortedSounds = useMemo(() => {
    const safeRecommendedIds = recommendedIds || [];
    return [...filteredSounds].sort((a, b) => {
      const aLinked = safeRecommendedIds.includes(a.id);
      const bLinked = safeRecommendedIds.includes(b.id);
      if (aLinked && !bLinked) return -1;
      if (!aLinked && bLinked) return 1;
      return 0;
    });
  }, [filteredSounds, recommendedIds]);

  const videos = useMemo(() => {
    return (images || []).filter(img => img.type === 'video');
  }, [images]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    setDraggedIndex(null);
    setDragOverIndex(null);

    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const newSorted = [...sortedSounds];
    const [removed] = newSorted.splice(sourceIndex, 1);
    newSorted.splice(targetIndex, 0, removed);

    const sortedIds = newSorted.map(s => s.id);
    let nextSortedIdx = 0;
    const mappedSounds = (sounds || []).map(s => {
      if (sortedIds.includes(s.id)) {
        return newSorted[nextSortedIdx++];
      }
      return s;
    });

    if (onReorderSounds) {
      onReorderSounds(mappedSounds);
    }
  }, [sortedSounds, sounds, onReorderSounds]);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className={`flex items-center justify-between border-b border-white/5 shrink-0 transition-all ${isNarrow ? 'px-2 h-10' : 'px-3 md:px-5 h-14'}`}>
          <div className="flex items-center gap-2 h-full flex-1">
             <div className="flex items-center bg-white/[0.03] rounded-xl p-0.5 border border-white/5 w-full overflow-x-auto scrollbar-none">
               {(['all', SoundType.BGM, SoundType.SE, 'clusters', 'video'] as const).map(type => (
                 <button 
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`flex-1 py-1 px-1.5 rounded text-[8px] font-bold font-cinzel transition-all uppercase whitespace-nowrap flex items-center justify-center gap-1 ${filter === type ? 'bg-white/20 text-white shadow-sm border border-white/15' : 'text-white/75 hover:text-white/95 hover:bg-white/5'}`}
                 >
                   {type === 'clusters' && <Layers size={10} className="text-amber-400" />}
                   {type === 'video' ? 'Video' : type === 'clusters' ? 'Cluster' : type}
                 </button>
               ))}
             </div>
          </div>
        </div>

        <div className="flex-1 p-2 md:p-2.5 overflow-y-auto scrollbar-thin">
          {filter === 'clusters' ? (
            <div className="flex flex-col gap-3 pb-8">
              {/* Header bar */}
              <div className="flex items-center justify-between px-1 shrink-0">
                <span className="text-[9px] font-black font-sans tracking-widest text-amber-400 uppercase flex items-center gap-1.5">
                  <Layers size={11} className="text-amber-400" /> SOUND CLUSTERS (音響プリセット)
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleSaveActiveAsCluster}
                    className="py-1 px-2 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[8px] font-bold tracking-wider uppercase transition-all flex items-center gap-1 cursor-pointer"
                    title="現在再生中のサウンドをクラスターとして保存"
                  >
                    <Sparkles size={10} /> 再生中を保存
                  </button>
                  <button
                    onClick={() => handleOpenClusterModal()}
                    className="py-1 px-2 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-[8px] font-bold tracking-wider uppercase transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={10} /> 作成
                  </button>
                </div>
              </div>

              {effectiveClusters.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center p-6 text-center text-white/20 border border-white/5 border-dashed rounded-xl gap-2">
                  <Layers size={28} className="opacity-30 text-amber-400" />
                  <p className="text-[11px] font-bold text-white/60">クラスターが登録されていません</p>
                  <p className="text-[9px] text-white/40 leading-relaxed max-w-xs">
                    複数のBGMやSEを組み合わせた音響セットを作成すると、1クリックで一括再生・切り替えが可能になります。
                  </p>
                  <button
                    onClick={handleSaveActiveAsCluster}
                    className="mt-2 py-1.5 px-3 rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg"
                  >
                    <Sparkles size={12} /> 現在の再生音響から作成
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {effectiveClusters.map((cluster) => {
                    const isMappedToCurrentPhase = currentPhaseId && cluster.phaseId === currentPhaseId;
                    const clusterSounds = sounds.filter(s => cluster.soundIds.includes(s.id));
                    const isFullyActive = cluster.soundIds.length > 0 && cluster.soundIds.every(id => isPlaying[id]);

                    return (
                      <div
                        key={cluster.id}
                        className={`p-3 rounded-xl border transition-all duration-200 flex flex-col gap-2 relative overflow-hidden group ${
                          isFullyActive
                            ? 'bg-amber-950/20 border-amber-500/40 shadow-lg shadow-amber-950/20'
                            : isMappedToCurrentPhase
                              ? 'bg-amber-500/5 border-amber-500/20'
                              : 'bg-white/[0.02] border-white/5 hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isMappedToCurrentPhase && (
                                <span className="text-[7px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-amber-500/30">
                                  Current Phase
                                </span>
                              )}
                              {cluster.phaseId && !isMappedToCurrentPhase && (
                                <span className="text-[7px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded font-mono">
                                  {phases.find(p => p.id === cluster.phaseId)?.name || 'Phase'}
                                </span>
                              )}
                            </div>
                            <h4 className="text-[12px] font-bold text-white truncate mt-1 flex items-center gap-1.5">
                              {cluster.name}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleTriggerCluster(cluster)}
                              className={`py-1.5 px-3 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 ${
                                isFullyActive
                                  ? 'bg-amber-500 border-amber-400 text-black font-black shadow-amber-500/30'
                                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/50'
                              }`}
                              title="ワンクリックでクラスター内の音響を一括再生"
                            >
                              <Zap size={12} className={isFullyActive ? 'fill-black' : ''} />
                              <span>{isFullyActive ? 'ACTIVE' : 'TRIGGER'}</span>
                            </button>
                            
                            <button
                              onClick={() => handleOpenClusterModal(cluster)}
                              className="p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
                              title="編集"
                            >
                              <FolderKanban size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteCluster(cluster.id)}
                              className="p-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-red-500/20 hover:border-red-500/30 text-white/30 hover:text-red-400 transition-all cursor-pointer"
                              title="削除"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Sound list tags inside cluster */}
                        <div className="flex flex-wrap gap-1 mt-1 border-t border-white/5 pt-2">
                          {clusterSounds.map(sound => {
                            const active = !!isPlaying[sound.id];
                            return (
                              <span
                                key={sound.id}
                                className={`text-[8.5px] px-2 py-0.5 rounded-md font-mono flex items-center gap-1 border transition-all ${
                                  active
                                    ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 font-bold'
                                    : 'bg-white/5 border-white/5 text-white/50'
                                }`}
                              >
                                <span className={`w-1 h-1 rounded-full ${active ? 'bg-cyan-400 animate-pulse' : 'bg-white/20'}`} />
                                {sound.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : filter === 'video' ? (
            <div className="flex flex-col gap-3 pb-8">
              <div className="flex items-center justify-between px-1 shrink-0">
                <span className="text-[9px] font-black font-sans tracking-widest text-white/55 uppercase flex items-center gap-1.5">
                  <Tv size={11} className="text-red-500 animate-pulse" /> 動画コントロール (VIDEO CONTROL)
                </span>
                {syncData?.activeImageId && syncData?.activeResourceType === 'video' && (
                  <button
                    onClick={() => onControlVideo?.(null, 'stop')}
                    className="py-1 px-2.5 rounded border border-red-500/20 bg-red-400/5 hover:bg-red-400/10 text-red-400 text-[8px] font-black tracking-widest uppercase transition-all flex items-center gap-1"
                  >
                    <Square size={8} className="fill-current" /> 全動画同期解除 (Unsync)
                  </button>
                )}
              </div>

              {videos.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center p-6 text-center text-white/15 border border-white/5 border-dashed rounded-xl">
                  <Video size={30} className="mb-2 opacity-25" />
                  <p className="text-[10px] font-bold font-cinzel uppercase tracking-wider">No Videos Found</p>
                  <p className="text-[9px] mt-2 text-white/5 normal-case leading-relaxed">
                    エディタの「リソース」タブから<br />動画を追加してください。
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {videos.map((vid) => {
                    const isActive = syncData?.activeImageId === vid.id && syncData?.activeResourceType === 'video';
                    const isPlaying = isActive && syncData?.videoPlaying === true;
                    const progress = syncData?.videoProgress || 0;
                    const duration = syncData?.videoDuration || 0;

                    const formatTime = (secs: number) => {
                      const m = Math.floor(secs / 60);
                      const s = Math.floor(secs % 60);
                      return `${m}:${s.toString().padStart(2, '0')}`;
                    };

                    const percentage = duration > 0 ? (progress / duration) * 100 : 0;

                    return (
                      <div 
                        key={vid.id}
                        className={`p-3 rounded-xl border transition-all duration-300 relative overflow-hidden flex flex-col gap-2 ${
                          isActive 
                            ? 'bg-red-500/5 border-red-500/20 shadow-lg shadow-red-950/5' 
                            : 'bg-white/[0.01] border-white/5 hover:border-white/15'
                        }`}
                      >
                        {isActive && (
                          <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                        )}

                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[8px] text-red-400 font-bold tracking-wider">
                                [[{vid.id}]]
                              </span>
                              {isActive && (
                                <span className="text-[7px] bg-red-500/20 text-red-500 px-1 py-0.5 rounded font-black tracking-widest animate-pulse uppercase leading-none">
                                  {isPlaying ? "PLAYING" : "PAUSED"}
                                </span>
                              )}
                            </div>
                            <h4 className="text-[11px] font-bold text-white truncate mt-1">
                              {vid.name}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                if (isActive) {
                                  onControlVideo?.(vid.id, isPlaying ? 'pause' : 'play', progress);
                                } else {
                                  onControlVideo?.(vid.id, 'play', 0);
                                }
                              }}
                              className={`p-1.5 rounded-full border transition-all active:scale-90 flex items-center justify-center ${
                                isPlaying
                                  ? 'bg-red-500/20 border-red-500/30 text-red-400'
                                  : 'bg-white/5 border-white/5 text-white/40 hover:text-white hover:border-white/20'
                              }`}
                            >
                              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                            </button>

                            {isActive && (
                              <button
                                onClick={() => onControlVideo?.(null, 'stop')}
                                className="p-1.5 rounded-full bg-white/5 border border-white/5 text-white/40 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all active:scale-95"
                              >
                                <Square size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        {isActive && (
                          <div className="space-y-1.5 mt-0.5 animate-in fade-in duration-200">
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] font-mono text-white/30 tracking-wider font-semibold w-10">
                                {formatTime(progress)}
                              </span>

                              <div 
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const clickX = e.clientX - rect.left;
                                  const width = rect.width;
                                  const seekPercentage = Math.max(0, Math.min(1, clickX / width));
                                  const seekTime = seekPercentage * duration;
                                  onControlVideo?.(vid.id, 'seek', seekTime);
                                }}
                                className="flex-1 h-1.5 bg-white/5 rounded-full cursor-pointer relative overflow-hidden group/bar"
                              >
                                <div 
                                  className="h-full bg-red-500 rounded-full transition-all duration-100" 
                                  style={{ width: `${percentage}%` }}
                                />
                                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                              </div>

                              <span className="text-[8px] font-mono text-white/30 tracking-wider font-semibold text-right w-10">
                                {formatTime(duration)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 justify-end pt-0.5">
                              <button
                                onClick={() => onControlVideo?.(vid.id, 'seek', 0)}
                                className="py-0.5 px-1.5 bg-white/[0.02] hover:bg-white/5 border border-white/5 rounded text-[7px] font-mono text-white/40 transition-all flex items-center gap-1 leading-none uppercase"
                              >
                                <RotateCcw size={8} /> 0:00
                              </button>
                              <button
                                onClick={() => {
                                  onControlVideo?.(vid.id, 'seek', Math.max(0, progress - 10));
                                }}
                                className="py-0.5 px-1.5 bg-white/[0.02] hover:bg-white/5 border border-white/5 rounded text-[7px] font-mono text-white/40 transition-all leading-none"
                              >
                                -10s
                              </button>
                              <button
                                onClick={() => {
                                  onControlVideo?.(vid.id, 'seek', Math.min(duration, progress + 10));
                                }}
                                className="py-0.5 px-1.5 bg-white/[0.02] hover:bg-white/5 border border-white/5 rounded text-[7px] font-mono text-white/40 transition-all leading-none"
                              >
                                +10s
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 pb-8">
              {sortedSounds.map((sound, index) => {
                const active = isPlaying[sound.id];
                const isLinked = (recommendedIds || []).includes(sound.id);
                const customColor = sound.color || themeColor;
                const prevSound = sortedSounds[index-1];
                const showDivider = index > 0 && !isLinked && prevSound && (recommendedIds || []).includes(prevSound.id);

                return (
                  <React.Fragment key={sound.id}>
                    {showDivider && (
                      <div className="col-span-full py-2 flex items-center gap-4 opacity-10">
                        <div className="h-px flex-1 bg-white/20" />
                        <span className="text-[6px] font-bold font-cinzel uppercase tracking-[0.4em]">Archive</span>
                        <div className="h-px flex-1 bg-white/20" />
                      </div>
                    )}
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`flex items-center gap-2 transition-all duration-200 rounded-xl relative
                        ${draggedIndex === index ? 'opacity-30 scale-95 border border-dashed border-white/20' : ''}
                        ${dragOverIndex === index ? 'border-t-2 border-dashed' : ''}
                      `}
                      style={{
                        borderTopColor: dragOverIndex === index ? themeColor : undefined
                      }}
                    >
                      {/* ドラッグハンドル */}
                      <div 
                        className="cursor-grab active:cursor-grabbing p-1 px-1.5 text-white/30 hover:text-white/70 transition-colors shrink-0"
                        title="ドラッグして並び替え"
                      >
                        <GripVertical size={13} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <SoundCard
                          sound={sound}
                          active={active}
                          isLinked={isLinked}
                          customColor={customColor}
                          isNarrow={isNarrow}
                          onToggleSound={onToggleSound}
                          onPlaySound={onPlaySound}
                          onStopSound={onStopSound}
                          onUpdateSoundConfig={onUpdateSoundConfig}
                        />
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showSideVolume && (
        <div className={`flex flex-col px-0.5 h-full ${volumePosition === 'right-bottom' ? 'justify-end pb-4' : 'justify-center'}`}>
          <MasterVolumeUnit 
            masterVolume={masterVolume}
            onMasterVolumeChange={onMasterVolumeChange}
            showSideVolume={showSideVolume}
            volumePosition={volumePosition}
          />
        </div>
      )}

      {/* SOUND CLUSTER EDIT MODAL */}
      <AnimatePresence>
        {showClusterModal && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-[#0d0d0f] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-amber-400" />
                  <h3 className="text-sm font-bold text-white font-sans">
                    {editingClusterId ? 'サウンドクラスターの編集' : '新規クラスター作成'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowClusterModal(false)}
                  className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-4 flex-1">
                <div>
                  <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1.5">
                    クラスター名 <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={clusterName}
                    onChange={(e) => setClusterName(e.target.value)}
                    placeholder="例: クライマックス演出BGMセット"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1.5">
                    フェーズマッピング (任意)
                  </label>
                  <select
                    value={clusterPhaseId}
                    onChange={(e) => setClusterPhaseId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#18181b] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 transition-all"
                  >
                    <option value="">全フェーズ共通</option>
                    {phases.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1.5">
                    含まれるサウンドを選択 ({clusterSoundIds.length}個選択中)
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {sounds.map(sound => {
                      const isSelected = clusterSoundIds.includes(sound.id);
                      return (
                        <div
                          key={sound.id}
                          onClick={() => {
                            if (isSelected) {
                              setClusterSoundIds(clusterSoundIds.filter(id => id !== sound.id));
                            } else {
                              setClusterSoundIds([...clusterSoundIds, sound.id]);
                            }
                          }}
                          className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                              : 'bg-white/[0.02] border-white/5 text-white/60 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono font-bold ${
                              sound.type === SoundType.BGM ? 'bg-sky-500/20 text-sky-300' : 'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {sound.type}
                            </span>
                            <span className="truncate text-xs font-medium">{sound.name}</span>
                          </div>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-amber-500 border-amber-400 text-black' : 'border-white/20'
                          }`}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-white/10 flex items-center justify-end gap-2 bg-black/40">
                <button
                  onClick={() => setShowClusterModal(false)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleSaveClusterModal}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  保存する
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <style>{`
        .vertical-slider::-webkit-slider-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 3px solid #000;
          box-shadow: 0 0 10px rgba(255,255,255,0.4);
          transition: transform 0.1s;
        }
        .vertical-slider:active::-webkit-slider-thumb {
          transform: scale(1.3);
        }
        .vertical-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: 3px solid #000;
          box-shadow: 0 0 10px rgba(255,255,255,0.4);
        }
      `}</style>
    </div>
  );
});

SoundBoard.displayName = 'SoundBoard';

export default SoundBoard;