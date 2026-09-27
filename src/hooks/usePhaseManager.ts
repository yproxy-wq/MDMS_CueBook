import { useCallback } from 'react';
import { AppState } from '../types';
import { browsePhase } from '../utils/timerNavigation';

export function usePhaseManager(
  setState: React.Dispatch<React.SetStateAction<AppState>>,
) {
  const handlePhasePreview = useCallback((phaseId: string) => {
    setState(prev => browsePhase(prev, phaseId));
  }, [setState]);

  // Legacy next/previous/search callers navigate only; phase lifecycle stays frozen.
  const handleStopPhase = useCallback(() => {}, []);
  const handleCancelPhase = useCallback(() => {}, []);
  return { handlePhasePreview, handlePhaseTransition: handlePhasePreview, handleStopPhase, handleCancelPhase };
}
