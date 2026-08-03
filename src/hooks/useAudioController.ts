
import { useCallback, useEffect } from 'react';
import { audioService } from '../services/AudioService';
import { SoundConfig, AppState } from '../types';

export function useAudioController(
  state: AppState, 
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  activateAudioWithPrefs: () => void
) {
  useEffect(() => { 
    audioService.setVolume(state.volume); 
  }, [state.volume]);

  useEffect(() => { 
    audioService.setDucking(state.isDucking); 
  }, [state.isDucking]);

  const handleStopSound = useCallback((soundId: string) => {
    audioService.stop(soundId);
    setState(prev => ({ ...prev, isPlaying: { ...prev.isPlaying, [soundId]: false } }));
  }, [setState]);

  const handlePlaySound = useCallback(async (sound: SoundConfig) => {
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
      await audioService.play(sound, () => {
        setState(prev => ({ ...prev, isPlaying: { ...prev.isPlaying, [sound.id]: false } }));
      });
      setState(prev => {
        const newUsedSounds = new Set(prev.usedSounds || []);
        newUsedSounds.add(sound.id);
        return {
          ...prev,
          isPlaying: updatedIsPlaying,
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

  return { handleStopSound, handlePlaySound, handleToggleSound };
}
