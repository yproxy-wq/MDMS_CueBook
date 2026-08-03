import React, { useState, useEffect } from 'react';
import { Phase } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  phases: Phase[];
  currentPhaseId: string;
  phaseResults: Record<string, number>;
  scenarioName: string;
  phaseStartTime?: number;
}

const formatSeconds = (totalSeconds: number) => {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatMinutes = (minutes: number) => {
  const m = Math.floor(minutes);
  const s = Math.round((minutes - m) * 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const ScenarioMapModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  phases, 
  currentPhaseId, 
  phaseResults, 
  scenarioName,
  phaseStartTime 
}) => {
  const [now, setNow] = useState(() => Date.now());

  // モーダルが開いており、アクティブなフェーズが進行中の場合のみ、ローカルタイマーで高精度に時刻を更新する
  useEffect(() => {
    if (!isOpen || !currentPhaseId || !phaseStartTime) return;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => clearInterval(timer);
  }, [isOpen, currentPhaseId, phaseStartTime]);

  const getPhaseTargetMin = (p: Phase) => {
    return p.targetDurationMinutes || 
      (((p.timers || []).reduce((acc, t) => acc + (t.durationMinutes || 0), 0)) + (p.bufferDurationMinutes || 0));
  };

  const handleExportJSON = () => {
    const report = {
      scenarioName,
      exportedAt: new Date().toISOString(),
      phases: phases.map(p => {
        const expectedMin = getPhaseTargetMin(p);
        const isCurrent = p.id === currentPhaseId;
        const currentElapsedSec = (phaseResults[p.id] || 0) + (isCurrent && phaseStartTime ? Math.floor((Date.now() - phaseStartTime) / 1000) : 0);
        return {
          name: p.name,
          targetDurationMinutes: expectedMin,
          actualDurationMinutes: currentElapsedSec / 60
        };
      })
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenarioName.replace(/\s+/g, '_')}_report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const csvRows = [
      ['Scenario Name', scenarioName],
      ['Exported At', new Date().toISOString()],
      [],
      ['Phase Index', 'Phase Name', 'Expected Duration (Minutes)', 'Actual Duration (Minutes)', 'Actual Duration (Seconds)', 'Difference (Minutes)']
    ];

    phases.forEach((p, index) => {
      const expectedMin = getPhaseTargetMin(p);
      const isCurrent = p.id === currentPhaseId;
      const actualSec = (phaseResults[p.id] || 0) + (isCurrent && phaseStartTime ? Math.floor((Date.now() - phaseStartTime) / 1000) : 0);
      const actualMin = actualSec / 60;
      const diffMin = expectedMin > 0 ? (actualMin - expectedMin) : 0;
      
      csvRows.push([
        String(index + 1),
        p.name,
        expectedMin ? String(expectedMin) : '---',
        actualMin.toFixed(2),
        String(actualSec),
        expectedMin ? diffMin.toFixed(2) : '---'
      ]);
    });

    const BOM = '\uFEFF';
    const csvContent = BOM + csvRows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scenarioName.replace(/\s+/g, '_')}_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-zinc-900 border border-white/20 p-6 rounded-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-white text-xl font-cinzel tracking-widest">{scenarioName}</h2>
              <div className="flex gap-2 shrink-0">
                <button 
                  onClick={handleExportJSON}
                  className="text-white/70 hover:text-white px-2.5 py-1 rounded bg-white/10 text-[10px] font-mono tracking-wider hover:bg-white/20 transition-all"
                >
                  JSON
                </button>
                <button 
                  onClick={handleExportCSV}
                  className="text-white/70 hover:text-white px-2.5 py-1 rounded bg-white/10 text-[10px] font-mono tracking-wider hover:bg-white/20 transition-all"
                >
                  CSV
                </button>
                <button onClick={onClose} className="text-white/50 hover:text-white text-sm ml-2">x</button>
              </div>
            </div>
            
            <div className="grid gap-3">
              {phases.map((phase, index) => {
                const isActive = phase.id === currentPhaseId;
                const baseElapsed = phaseResults[phase.id] || 0;
                const elapsed = baseElapsed + (isActive && phaseStartTime ? Math.floor((now - phaseStartTime) / 1000) : 0);
                const targetMin = getPhaseTargetMin(phase);
                
                return (
                  <div 
                    key={phase.id} 
                    className={`p-4 rounded-xl border transition-all ${isActive ? 'bg-white/10 border-white/40 shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-black/20 border-white/10'}`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <div className={`text-[10px] font-mono ${isActive ? 'text-white' : 'text-white/40'}`}>PHASE {index + 1}</div>
                      {targetMin > 0 && (
                        <div className="text-[10px] font-mono text-white/50">
                          {formatSeconds(elapsed)} / {formatMinutes(targetMin)}
                        </div>
                      )}
                    </div>
                    <div className={`text-sm font-bold ${isActive ? 'text-white' : 'text-white/70'}`}>{phase.name}</div>
                    
                    {targetMin > 0 && (
                      <div className="w-full bg-black/40 h-1 mt-3 rounded-full overflow-hidden">
                        <motion.div 
                          className={`h-full ${isActive ? 'bg-white' : 'bg-white/20'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (elapsed / 60 / targetMin) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ScenarioMapModal;
