import React from 'react';
import { Scenario } from '../types';
import PhaseCard from './PhaseCard';
interface PhaseProgressNavProps {
  scenario: Scenario;
  activePhaseId: string;
  previewPhaseId: string;
  themeColor: string;
  onPhasePreview: (id: string) => void;
  onPhaseTransition: (id: string) => void;
  timerStates: Record<string, { seconds: number; isRunning: boolean; startTime?: number | null }>;
  onToggleTimer: (id: string) => void;
  onStartSession: () => void;
  onSetCompleted: (id: string, completed: boolean) => void;
  isPaused: boolean;
  sessionStartTime?: number;
  onOpenPhasePopup: () => void;
  position: 'top' | 'bottom';
  onResetTimer?: (id: string) => void;
}
export const PhaseProgressNav: React.FC<PhaseProgressNavProps> = React.memo((props) => (
  <nav aria-label="台本のフェーズ" className="shrink-0 bg-zinc-950 border-y border-white/10 p-2">
    <div className="phase-tab-track flex gap-2 overflow-x-auto">
      {(props.scenario.phases || []).map((phase, index) => (
        <PhaseCard key={phase.id} phase={phase} index={index} isActive={false}
          isPreview={phase.id === (props.previewPhaseId || props.activePhaseId)} unlocked={true}
          themeColor={props.themeColor} runningSeconds={0} onPreview={props.onPhasePreview}
          onActivate={props.onPhaseTransition} onToggleTimer={props.onToggleTimer}
          onSetCompleted={props.onSetCompleted} onOpenDetails={props.onOpenPhasePopup} />
      ))}
    </div>
  </nav>
));
export default PhaseProgressNav;
