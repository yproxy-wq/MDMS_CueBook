import React, { useState } from 'react';
import { Scenario, ScenarioSnapshot } from '../../types';
import { Camera, Trash2, RotateCcw, Plus } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { limitSnapshots, reconstructScenario } from '../../utils/snapshotHelper';

interface SnapshotsTabProps {
  scenario: Scenario;
  onUpdate: (updates: Partial<Scenario>) => void;
}

export const SnapshotsTab: React.FC<SnapshotsTabProps> = ({ scenario, onUpdate }) => {
  const [label, setLabel] = useState('');

  const handleSaveSnapshot = () => {
    if (!label.trim()) return;
    const newSnapshot: ScenarioSnapshot = {
      id: uuidv4(),
      label,
      timestamp: Date.now(),
      scenarioData: JSON.parse(JSON.stringify(scenario)) // Deep copy
    };
    
    const currentSnapshots = scenario.snapshots || [];
    const updatedSnapshots = limitSnapshots(currentSnapshots, newSnapshot);

    onUpdate({
      snapshots: updatedSnapshots
    });
    setLabel('');
  };

  const handleRevert = (snapshot: ScenarioSnapshot) => {
    if (confirm(`本当に「${snapshot.label}」の状態まで復元しますか？（現在の編集内容は保存されません）`)) {
      onUpdate(reconstructScenario(snapshot.scenarioData));
    }
  };

  const handleDelete = (snapshotId: string) => {
    if (confirm('このスナップショットを削除しますか？')) {
      onUpdate({
        snapshots: (scenario.snapshots || []).filter(s => s.id !== snapshotId)
      });
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold font-cinzel text-white tracking-widest uppercase flex items-center gap-2">
        <Camera size={20} /> Scenario Snapshots
      </h2>
      
      <div className="flex gap-2">
        <input 
          type="text" 
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="バージョン名 (例: v1.0 Release)"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500"
        />
        <button 
          onClick={handleSaveSnapshot}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all"
        >
          <Plus size={16} /> 保存
        </button>
      </div>

      <div className="space-y-2">
        {(scenario.snapshots || []).slice().reverse().map(snapshot => (
          <div key={snapshot.id} className="flex items-center justify-between bg-white/[0.02] border border-white/5 p-4 rounded-xl group">
            <div>
              <div className="font-bold text-sm text-white">{snapshot.label}</div>
              <div className="text-[10px] text-white/40 font-mono">{new Date(snapshot.timestamp).toLocaleString()}</div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => handleRevert(snapshot)}
                className="p-2 text-white/40 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                title="復元"
              >
                <RotateCcw size={16} />
              </button>
              <button 
                onClick={() => handleDelete(snapshot.id)}
                className="p-2 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                title="削除"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
