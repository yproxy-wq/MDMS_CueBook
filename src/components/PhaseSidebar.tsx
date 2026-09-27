import React from 'react';
import { Scenario } from '../types';
import { Pause, Play } from 'lucide-react';
import { useDisplayNow } from '../hooks/useDisplayNow';
interface PhaseSidebarProps {
  scenario: Scenario;
  activePhaseId: string;
  previewPhaseId: string;
  themeColor: string;
  onPhasePreview: (id: string) => void;
  onPhaseTransition: (id: string) => void;
  onStopPhase: (id: string) => void;
  onCancelPhase: () => void;
  sessionStartTime?: number;
  exitTime?: string;
  onExitTimeChange: (time: string) => void;
  isPaused: boolean;
  phaseResults: Record<string, number>;
  activePhaseStartTime?: number;
  onStartSession: () => void;
  onTogglePause: () => void;
  isCollapsed: boolean;
}
const PhaseSidebar: React.FC<PhaseSidebarProps> = React.memo(({ scenario, previewPhaseId, activePhaseId, onPhasePreview, themeColor, isCollapsed, sessionStartTime, isPaused, onStartSession, onTogglePause }) => {
  const now = useDisplayNow(1000, Boolean(sessionStartTime && !isPaused));
  const elapsed = sessionStartTime ? Math.max(0, (now - sessionStartTime) / 1000) : 0;
  const display = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}`;
  return <aside className="h-full w-full flex flex-col bg-zinc-950 border-r border-white/10 overflow-hidden">
    <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between gap-2">
      {!isCollapsed && <div><span className="block text-[9px] font-cinzel text-white/50">SESSION CLOCK</span><span className="font-mono text-xl text-white">{display}</span></div>}
      <button type="button" className="min-w-11 min-h-11 rounded-full border border-white/15 flex items-center justify-center text-white"
        onClick={sessionStartTime ? onTogglePause : onStartSession} aria-label={!sessionStartTime ? 'セッション時計を開始' : isPaused ? 'セッション時計を再開' : 'セッション時計を一時停止'}>
        {!sessionStartTime || isPaused ? <Play size={16} /> : <Pause size={16} />}
      </button>
    </div>
    <div className="px-3 py-3 text-xs font-sans text-white/60">台本のフェーズ</div>
    <nav aria-label="台本のフェーズ一覧" className="flex-1 overflow-y-auto p-2 space-y-2">
      {(scenario.phases || []).map((phase, index) => (
        <button key={phase.id} type="button" onClick={() => onPhasePreview(phase.id)}
          aria-pressed={phase.id === (previewPhaseId || activePhaseId)} title={phase.name}
          className="w-full min-h-11 text-left p-3 rounded-xl border bg-white/5 text-white font-sans"
          style={{ borderColor: phase.id === (previewPhaseId || activePhaseId) ? (phase.themeColor || themeColor) : '#ffffff20' }}>
          <span className="text-xs text-white/50 font-mono">{index + 1}</span>
          {!isCollapsed && <span className="block mt-1 whitespace-normal text-sm">{phase.name}</span>}
        </button>
      ))}
    </nav>
  </aside>;
});
export default PhaseSidebar;
