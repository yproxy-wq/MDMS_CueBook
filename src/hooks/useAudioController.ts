
import { useCallback, useEffect, useRef } from 'react';
import { audioService } from '../services/AudioService';
import { SoundConfig, AppState } from '../types';

export function useAudioController(
  state: AppState, 
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  activateAudioWithPrefs: () => void
) {
  const stopRevision = useRef(0);
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
    audioService.stop(soundId);
    setState(prev => ({ ...prev, isPlaying: { ...prev.isPlaying, [soundId]: false } }));
  }, [setState, handleStopAllSounds]);

  const handlePlaySound = useCallback(async (sound: SoundConfig) => {
    const revision = stopRevision.current;
    activateAudioWithPrefs();
    const updatedIsPlaying = { ...state.isPlaying, [sound.id]: true };
    if (sound.chokeGroup) {
        (state.currentScenario.sounds || []).forEach(s => {
            if (s.id !== sound.id && s.chokeGroup === sound.chokeGroup) {
                if (state.isPlaying[s.id]) {
                  audioService.stop(s.id);
                  updatedIsPlaying[s.id] = false;
                }
            }
        });
    }
    try {
      const played = await audioService.play(sound, () => {
        setState(prev => ({ ...prev, isPlaying: { ...prev.isPlaying, [sound.id]: false } }));
      });
      if (played === false || revision !== stopRevision.current) return;
      setState(prev => {
        const newUsedSounds = new Set(prev.usedSounds || []);
        newUsedSounds.add(sound.id);
        return {
          ...prev,
          isPlaying: { ...prev.isPlaying, ...Object.fromEntries(Object.entries(updatedIsPlaying).filter(([id]) => id === sound.id || (sound.chokeGroup && state.currentScenario.sounds.some(other => other.id === id && other.chokeGroup === sound.chokeGroup)))) },
          usedSounds: newUsedSounds
        };
      });
    } catch (err) {
      console.error("Playback failed:", err);
      setState(prev => ({ ...prev, isPlaying: { ...prev.isPlaying, [sound.id]: false } }));
    }
  }, [state.isPlaying, state.currentScenario, activateAudioWithPrefs, setState]);

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
