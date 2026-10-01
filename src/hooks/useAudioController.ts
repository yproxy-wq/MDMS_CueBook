import { getR2AssetIdFromUrl } from '../services/R2AssetService';
import { resolveR2Sound } from '../services/R2AudioPlayback';

import { useCallback, useEffect, useRef } from 'react';
import { audioService } from '../services/AudioService';
import { SoundConfig, AppState } from '../types';

export function useAudioController(
  state: AppState, 
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  activateAudioWithPrefs: () => void,
  onPlaybackError?: (message: string) => void
) {
  const stopRevision = useRef(0);
  const requestVersions = useRef(new Map<string, number>());
  const currentScenarioId = useRef(state.currentScenario.id);
  useEffect(() => {
    currentScenarioId.current = state.currentScenario.id;
    return () => { stopRevision.current += 1; };
  }, [state.currentScenario.id]);
  useEffect(() => { 
    audioService.setVolume(state.volume); 
  }, [state.volume]);

  useEffect(() => { 
    audioService.setDucking(state.isDucking); 
  }, [state.isDucking]);

  const handleStopAllSounds = useCallback(() => {
    stopRevision.current += 1;
    audioService.stopAll();
    setState(prev => ({ ...prev, isPlaying: {} }));
  }, [setState]);

  const handleStopSound = useCallback((soundId: string) => {
    if (soundId === 'all') { handleStopAllSounds(); return; }
    requestVersions.current.set(soundId, (requestVersions.current.get(soundId) || 0) + 1);
    audioService.stop(soundId);
    setState(prev => ({ ...prev, isPlaying: { ...prev.isPlaying, [soundId]: false } }));
  }, [setState, handleStopAllSounds]);

  const handlePlaySound = useCallback(async (sound: SoundConfig) => {
    const revision = stopRevision.current;
    const scenarioId = state.currentScenario.id;
    const requestVersion = (requestVersions.current.get(sound.id) || 0) + 1;
    requestVersions.current.set(sound.id, requestVersion);
    activateAudioWithPrefs();
    const updatedIsPlaying: Record<string, boolean> = { [sound.id]: true };
    if (sound.chokeGroup) {
        (state.currentScenario.sounds || []).forEach(s => {
            if (s.id !== sound.id && s.chokeGroup === sound.chokeGroup) {
                requestVersions.current.set(s.id, (requestVersions.current.get(s.id) || 0) + 1);
                audioService.stop(s.id);
                updatedIsPlaying[s.id] = false;
            }
        });
    }
    try {
      if (getR2AssetIdFromUrl(sound.url) || sound.chokeGroup) setState(prev => ({ ...prev, isPlaying: { ...prev.isPlaying, ...updatedIsPlaying } }));
      const resolved = getR2AssetIdFromUrl(sound.url) ? await resolveR2Sound(sound) : sound;
      if (revision !== stopRevision.current || requestVersion !== requestVersions.current.get(sound.id) || scenarioId !== currentScenarioId.current) return;
      const played = await audioService.play(resolved, () => {
        if (revision !== stopRevision.current || requestVersion !== requestVersions.current.get(sound.id) || scenarioId !== currentScenarioId.current) return;
        setState(prev => ({ ...prev, isPlaying: { ...prev.isPlaying, [sound.id]: false } }));
      });
      if (revision !== stopRevision.current || requestVersion !== requestVersions.current.get(sound.id) || scenarioId !== currentScenarioId.current) return;
      if (played === false) {
        setState(prev => ({ ...prev, isPlaying: { ...prev.isPlaying, [sound.id]: false } }));
        return;
      }
      setState(prev => {
        const newUsedSounds = new Set(prev.usedSounds || []);
        newUsedSounds.add(sound.id);
        return {
          ...prev,
          isPlaying: { ...prev.isPlaying, ...updatedIsPlaying },
          usedSounds: newUsedSounds
        };
      });
    } catch (err) {
      if (revision !== stopRevision.current || requestVersion !== requestVersions.current.get(sound.id) || scenarioId !== currentScenarioId.current) return;
      console.error("Playback failed:", err);
      onPlaybackError?.(err instanceof Error ? err.message : '音声の読み込みに失敗しました。もう一度再生してください。');
      setState(prev => ({ ...prev, isPlaying: { ...prev.isPlaying, [sound.id]: false } }));
    }
  }, [state.currentScenario, activateAudioWithPrefs, setState, onPlaybackError]);

  const handleToggleSound = useCallback(async (sound: SoundConfig) => {
    const active = state.isPlaying[sound.id];
    if (active) {
      handleStopSound(sound.id);
    } else {
      handlePlaySound(sound);
    }
  }, [state.isPlaying, handlePlaySound, handleStopSound]);

  return { handleStopSound, handlePlaySound, handleToggleSound, handleStopAllSounds };
}
