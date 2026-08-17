import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppState } from '../types';
import { buildAppWindowUrl, getAppWindowMode } from '../utils/appRoute';

export const getRequestedScenarioId = (search: string): string | null =>
  new URLSearchParams(search).get('scenarioId');

/** Keeps the browser URL and CueBook's window mode in one place. */
export function useAppWindowRouting(setState: Dispatch<SetStateAction<AppState>>) {
  const [requestedScenarioId, setRequestedScenarioId] = useState(() => getRequestedScenarioId(window.location.search));

  const setEditorMode = useCallback((isEditor: boolean, navigation: 'push' | 'replace' = 'push') => {
    const mode = isEditor ? 'edit' : 'session';
    const nextUrl = buildAppWindowUrl(mode, window.location.search, window.location.hash);

    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== nextUrl) {
      const historyState = { ...window.history.state, cuebookWindow: mode };
      if (navigation === 'replace') window.history.replaceState(historyState, '', nextUrl);
      else window.history.pushState(historyState, '', nextUrl);
    }

    setState(previousState => previousState.isEditorMode === isEditor
      ? previousState
      : { ...previousState, isEditorMode: isEditor });
  }, [setState]);

  useEffect(() => {
    const handlePopState = () => {
      const isEditor = getAppWindowMode(window.location.pathname) === 'edit';
      setRequestedScenarioId(getRequestedScenarioId(window.location.search));
      setState(previousState => previousState.isEditorMode === isEditor
        ? previousState
        : { ...previousState, isEditorMode: isEditor });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setState]);

  return { requestedScenarioId, setEditorMode };
}
