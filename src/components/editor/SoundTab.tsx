import type { User } from 'firebase/auth';
import { isR2AssetUrl } from '../../services/R2AssetService';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Scenario, SoundConfig, SoundType } from '../../types';
import { Music, Plus, Search } from 'lucide-react';
import { SoundListItem } from './SoundListItem';
import { SoundSettingsPanel } from './SoundSettingsPanel';
import { audioService } from '../../services/AudioService';

interface SoundTabProps {
  scenario: Scenario;
  user?: User | null;
  onUpdate: (updated: Scenario) => void;
  previewingSoundId: string | null;
  onTogglePreview: (sound: SoundConfig) => void;
  onStopPreview?: (soundId: string) => void;
}

export const SoundTab: React.FC<SoundTabProps> = React.memo(({
  scenario, user = null, onUpdate, previewingSoundId, onTogglePreview, onStopPreview
}) => {
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  const [isChangingSound, setIsChangingSound] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletedSound, setDeletedSound] = useState<{scenarioId:string; sound:SoundConfig; index:number} | null>(null);
  useEffect(() => {
    if (!deletedSound) return;
    const timer = window.setTimeout(() => setDeletedSound(null), 8000);
    return () => window.clearTimeout(timer);
  }, [deletedSound]);

  const handleSelectSound = useCallback((id: string) => {
    if (id === selectedSoundId) return;
    setIsChangingSound(true);
    setSelectedSoundId(id);
    // Use a small timeout to allow UI to breathe
    setTimeout(() => setIsChangingSound(false), 50);
  }, [selectedSoundId]);

  const sounds = useMemo(() => scenario.sounds || [], [scenario.sounds]);

  // Preload sounds when they are added or changed
  useEffect(() => {
    const urls = sounds.map(s => s.url).filter(url => Boolean(url) && !isR2AssetUrl(url));
    audioService.preload(urls.slice(0, 5)); // Preload first 5 for quick start
  }, [sounds]);

  const filteredSounds = useMemo(() => {
    if (!searchQuery) return sounds;
    return sounds.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [sounds, searchQuery]);

  const selectedSound = useMemo(() =>
    sounds.find(s => s.id === selectedSoundId) || null
  , [sounds, selectedSoundId]);

  const updateSound = useCallback((soundId: string, updates: Partial<SoundConfig>) => {
    onUpdate({
      ...scenario,
      sounds: sounds.map(s => s.id === soundId ? { ...s, ...updates } : s)
    });
  }, [onUpdate, scenario, sounds]);

  const addSound = () => {
    const newSound: SoundConfig = {
      id: `s-${Date.now()}`,
      name: '新規音源',
      url: '',
      type: SoundType.SE,
      volume: 1.0,
      fadeInEnabled: true,
      fadeInDuration: 3.0,
      fadeOutEnabled: true,
      fadeOutDuration: 3.0,
      loopEnabled: false
    };
    onUpdate({
      ...scenario,
      sounds: [...sounds, newSound]
    });
    setSelectedSoundId(newSound.id);
  };

  const removeSound = (id: string) => {
    const index = sounds.findIndex(sound => sound.id === id);
    if (index < 0) return;
    audioService.stop(id, true);
    onStopPreview?.(id);
    setDeletedSound({scenarioId:scenario.id, sound:sounds[index], index});
    onUpdate({
      ...scenario,
      sounds: sounds.filter(s => s.id !== id)
    });
    if (selectedSoundId === id) setSelectedSoundId(null);
  };

  const moveSound = (idx: number, dir: 'up' | 'down') => {
    const next = [...sounds];
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= next.length) return;
    [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
    onUpdate({ ...scenario, sounds: next });
  };

  return (
    <div className="flex flex-col h-full gap-4 animate-in fade-in duration-300">
      {deletedSound?.scenarioId === scenario.id && <div role="status" className="flex min-h-[44px] items-center justify-between gap-3 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 text-sm text-white/80">
        <span>「{deletedSound.sound.name}」を削除しました</span>
        <button type="button" className="min-h-[44px] shrink-0 px-3 text-amber-300" onClick={() => {
          if (!sounds.some(sound => sound.id === deletedSound.sound.id)) {
            const restored = [...sounds];
            restored.splice(Math.min(deletedSound.index, restored.length), 0, deletedSound.sound);
            onUpdate({...scenario, sounds:restored});
            setSelectedSoundId(deletedSound.sound.id);
          }
          setDeletedSound(null);
        }}>元に戻す</button>
      </div>}
      {/* Top Section: List */}
      <div className="flex flex-col gap-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <h3 className="text-sm font-medium text-white/70 flex items-center gap-2">
              <Music size={14} /> 音源リスト
            </h3>
            <div className="relative w-full min-w-0 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
              <input
                value={searchQuery || ''}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="音源を検索..."
                className="w-full bg-black/40 border border-white/10 rounded-lg min-h-[44px] pl-9 pr-3 text-base text-white/60 outline-none focus:border-white/30 transition-all"
              />
            </div>
          </div>
          <button
            onClick={addSound}
            className="flex items-center gap-2 min-h-[44px] shrink-0 px-3 bg-white/5 border border-white/10 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <Plus size={14} /> 音源を追加
          </button>
        </div>

        <div className="flex overflow-x-auto gap-3 pb-3 scrollbar-thin scrollbar-thumb-white/10">
          {filteredSounds.map((sound) => (
            <div key={sound.id} className="w-56 shrink-0">
              <SoundListItem
                sound={sound}
                isSelected={selectedSoundId === sound.id}
                onClick={() => handleSelectSound(sound.id)}
                onRemove={() => removeSound(sound.id)}
                onMove={(dir) => moveSound(sounds.findIndex(item => item.id === sound.id), dir)}
                isFirst={sounds[0]?.id === sound.id}
                isLast={sounds[sounds.length - 1]?.id === sound.id}
              />
            </div>
          ))}
          {filteredSounds.length === 0 && (
            <div className="flex-1 py-4 text-center text-[11px] font-cinzel text-white/10 uppercase tracking-widest border border-dashed border-white/5 rounded-xl">
              音源が見つかりません
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Settings */}
      <div className="flex-1 min-w-0 border-t border-white/5 pt-4 relative">
        {isChangingSound && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
             <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
          </div>
        )}
        {selectedSound ? (
          <SoundSettingsPanel
            key={`${scenario.id}:${selectedSound.id}`}
            sound={selectedSound}
            scenarioId={scenario.id}
            user={user}
            onSourceChange={() => onStopPreview?.(selectedSound.id)}
            onUpdate={(updates) => updateSound(selectedSound.id, updates)}
            onRemove={() => removeSound(selectedSound.id)}
            previewingSoundId={previewingSoundId}
            onTogglePreview={onTogglePreview}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center bg-zinc-900/20 border border-dashed border-white/5 rounded-2xl text-white/10">
            <Music size={48} strokeWidth={1} className="mb-4 opacity-20" />
            <p className="text-[11px] font-cinzel uppercase tracking-[0.3em]">音源を選択して編集</p>
          </div>
        )}
      </div>
    </div>
  );
});
