import { useReducer, useCallback, useMemo } from 'react';
import { AppState, Scenario } from '../types';

export type AppAction = 
  | { type: 'SET_STATE'; payload: Partial<AppState> }
  | { type: 'RESET_SCENARIO'; scenario: Scenario }
  | { type: 'UPDATE_STATE_PARTIAL'; payload: Partial<AppState> };

function appReducer(state: AppState, action: AppAction | ((prev: AppState) => AppState)): AppState {
  if (typeof action === 'function') {
    return action(state);
  }
  
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    case 'UPDATE_STATE_PARTIAL':
      return { ...state, ...action.payload };
    case 'RESET_SCENARIO':
       return {
        ...state,
        currentScenario: action.scenario,
        currentPhaseId: action.scenario.phases[0]?.id || '',
        previewPhaseId: action.scenario.phases[0]?.id || '',
        isPlaying: {},
        isPaused: false,
        phaseResults: {},
        phaseDurations: {},
        usedSounds: new Set(),
      };
    default:
      return state;
  }
}

export function useAppState(initialState: AppState) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  const setState = useCallback((update: Partial<AppState> | ((prev: AppState) => AppState)) => {
    if (typeof update === 'function') {
        dispatch(update);
    } else {
        dispatch({ type: 'SET_STATE', payload: update });
    }
  }, [dispatch]);
  
  const updateScenario = useCallback((scenario: Scenario) => {
      dispatch({ type: 'UPDATE_STATE_PARTIAL', payload: { currentScenario: scenario } });
  }, [dispatch]);

  return useMemo(() => ({ state, setState, dispatch, updateScenario }), [state, setState, updateScenario]);
}
