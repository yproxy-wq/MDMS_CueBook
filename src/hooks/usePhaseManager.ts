
import { useCallback } from 'react';
import { audioService } from '../services/AudioService';
import { SoundConfig, AppState } from '../types';

export function usePhaseManager(
  state: AppState,
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  handleToggleSound: (sound: SoundConfig) => void,
  setActiveScriptTab: (tab: 'guide' | 'characters') => void
) {
  const handlePhasePreview = useCallback((phaseId: string) => {
    setState(prev => ({ 
      ...prev, 
      previewPhaseId: prev.previewPhaseId === phaseId ? '' : phaseId 
    }));
    setActiveScriptTab('guide');
  }, [setState, setActiveScriptTab]);

  const handlePhaseTransition = useCallback((phaseId: string) => {
    const phases = state.currentScenario.phases || [];
    const targetIdx = phases.findIndex(p => p.id === phaseId);
    
    if (targetIdx > 0) {
      const targetPhase = phases[targetIdx];
      if (targetPhase && targetPhase.isLockedByPrevious) {
        const prevPhase = phases[targetIdx - 1];
        if (prevPhase) {
          const results = prevPhase.checklistResults || [];
          const isChecklistComplete = prevPhase.checklists && prevPhase.checklists.length > 0 && 
                            prevPhase.checklists.every((_, i) => results[i] === true);
          if (!isChecklistComplete || !prevPhase.isCompleted) {
            alert(`「${prevPhase.name}」のチェックリストと完了フラグがすべて満たされるまで、このフェーズを開始できません。`);
            return;
          }
        }
      }
    }

    const phase = phases.find(p => p.id === phaseId);
    if (!phase) return;

    // Performance: Preload sounds for current and next phase
    const currentRecommended = (phase.recommendedSounds || []).map(sid => 
      (state.currentScenario.sounds || []).find(s => s.id === sid)
    ).filter(Boolean) as SoundConfig[];
    
    const nextPhase = phases[targetIdx + 1];
    const nextRecommended = nextPhase ? (nextPhase.recommendedSounds || []).map(sid => 
      (state.currentScenario.sounds || []).find(s => s.id === sid)
    ).filter(Boolean) as SoundConfig[] : [];
    
    audioService.preload([...currentRecommended, ...nextRecommended]);

    setActiveScriptTab('guide');
    setState(prev => {
      const now = Date.now();
      const updatedResults = { ...prev.phaseResults };
      if (prev.phaseStartTime) {
        const elapsed = Math.floor((now - prev.phaseStartTime) / 1000);
        updatedResults[prev.currentPhaseId] = (updatedResults[prev.currentPhaseId] || 0) + elapsed;
      }

      // Automatically start the first timer of the activated phase
      const targetPhase = (prev.currentScenario.phases || []).find(p => p.id === phaseId);
      const targetTimer = targetPhase?.timers?.[0];
      const updatedTimerStates = { ...prev.timerStates };

      if (targetTimer) {
        // Pause all other timers
        Object.keys(updatedTimerStates).forEach(tid => {
          const tState = updatedTimerStates[tid];
          if (tid !== targetTimer.id && tState && tState.isRunning && tState.startTime) {
            const elapsed = (now - tState.startTime) / 1000;
            updatedTimerStates[tid] = {
              ...tState,
              isRunning: false,
              startTime: null,
              seconds: Math.max(0, tState.seconds - elapsed)
            };
          }
        });

        // Start target timer (ensuring it is created in state if it doesn't exist yet)
        const tState = updatedTimerStates[targetTimer.id];
        const currentSecs = tState?.seconds ?? (targetTimer.durationMinutes * 60);
        updatedTimerStates[targetTimer.id] = {
          seconds: currentSecs > 0 ? currentSecs : (targetTimer.durationMinutes * 60),
          isRunning: true,
          startTime: now
        };
      }

      return { 
         ...prev, 
         currentPhaseId: phaseId, 
         previewPhaseId: phaseId,
         sessionStartTime: prev.sessionStartTime || now,
         phaseStartTime: now,
         syncSessionId: prev.syncSessionId || Math.random().toString(36).substring(2, 10),
         phaseResults: updatedResults,
         timerStates: updatedTimerStates,
         currentScenario: {
           ...prev.currentScenario,
           phases: (prev.currentScenario.phases || []).map(p => 
             p.id === phaseId ? { ...p, isCompleted: false } : p
           )
         }
      };
    });

    // Tactile confirmation vibration for successful phase transition
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([80, 50, 80]); // Distinct transition pattern: short buzz - pause - short buzz
    }

    if (phase.onEnterSoundId) {
      const entrySound = (state.currentScenario.sounds || []).find(s => s.id === phase.onEnterSoundId);
      if (entrySound) handleToggleSound(entrySound);
    }
  }, [state.currentScenario.phases, state.currentScenario.sounds, handleToggleSound, setState, setActiveScriptTab]);

  const handleStopPhase = useCallback((phaseId: string) => {
    setState(prev => {
      const now = Date.now();
      const updatedResults = { ...prev.phaseResults };
      if (prev.currentPhaseId === phaseId && prev.phaseStartTime) {
        const elapsed = Math.floor((now - prev.phaseStartTime) / 1000);
        updatedResults[phaseId] = (updatedResults[phaseId] || 0) + elapsed;
      }
      return {
        ...prev,
        currentPhaseId: '', 
        phaseStartTime: undefined,
        phaseResults: updatedResults,
        currentScenario: {
          ...prev.currentScenario,
          phases: (prev.currentScenario.phases || []).map(p => 
            p.id === phaseId ? { ...p, isCompleted: true } : p
          )
        }
      };
    });
  }, [setState]);

  const handleCancelPhase = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentPhaseId: '',
      phaseStartTime: undefined
    }));
  }, [setState]);

  return { handlePhasePreview, handlePhaseTransition, handleStopPhase, handleCancelPhase };
}
