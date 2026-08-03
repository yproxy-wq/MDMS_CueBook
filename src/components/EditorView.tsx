
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Scenario, SoundConfig } from '../types';
import { 
  Palette, Music, Users, FileText, Fingerprint, Image as ImageIcon, Undo2, Redo2, Camera, Check, Keyboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { audioService } from '../services/AudioService';
import { User } from 'firebase/auth';

// Import sub-components
import { ScenarioTab } from './editor/ScenarioTab';
import { CharactersTab } from './editor/CharactersTab';
import { PhasesTab } from './editor/PhasesTab';
import { SoundTab } from './editor/SoundTab';
import { IdentityTab } from './editor/IdentityTab';
import { MediaTab } from './editor/MediaTab';
import { SnapshotsTab } from './editor/SnapshotsTab';
import { ShortcutsGuideModal } from './modals/ShortcutsGuideModal';

interface EditorViewProps {
  scenario: Scenario;
  user: User | null;
  onUpdate: (updated: Scenario) => void;
  currentPhaseId: string;
  onExport?: () => void;
  onImport?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

const EditorView: React.FC<EditorViewProps> = React.memo(({ 
  scenario, user, onUpdate, canUndo = false, canRedo = false, onUndo, onRedo 
}) => {
  const [activeTab, setActiveTab] = useState<'phases' | 'sounds' | 'characters' | 'scenario' | 'identity' | 'media' | 'snapshots'>('phases');
  const [previewingSoundId, setPreviewingSoundId] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [showSavedToast, setShowSavedToast] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);
  const isInitialMount = useRef(true);
  const prevScenarioRef = useRef(scenario);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevScenarioRef.current = scenario;
      return;
    }

    if (prevScenarioRef.current !== scenario) {
      prevScenarioRef.current = scenario;
      const showTimer = setTimeout(() => {
        setShowSavedToast(true);
      }, 0);
      const hideTimer = setTimeout(() => {
        setShowSavedToast(false);
      }, 2200);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [scenario]);

  const phases = useMemo(() => scenario.phases || [], [scenario.phases]);

  const updateScenario = useCallback((updates: Partial<Scenario>) => {
    onUpdate({ ...scenario, ...updates });
  }, [onUpdate, scenario]);

  const togglePhaseCollapse = useCallback((id: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const setAllCollapsed = useCallback((collapsed: boolean) => {
    if (collapsed) {
      setCollapsedPhases(new Set(phases.map(p => p.id)));
    } else {
      setCollapsedPhases(new Set());
    }
  }, [phases]);

  const togglePreview = useCallback(async (sound: SoundConfig) => {
    if (previewingSoundId && previewingSoundId !== sound.id) {
      audioService.stop(previewingSoundId);
    }
    
    await audioService.play(sound, () => setPreviewingSoundId(null));
    setPreviewingSoundId(sound.id);
  }, [previewingSoundId]);

  const toolbarPos = scenario.editorToolbarPosition || 'left';

  return (
    <div className={`flex h-full bg-[#050505] z-20 w-full overflow-hidden ${toolbarPos === 'bottom' ? 'flex-col' : 'flex-row'}`}>
      {/* Sidebar / Toolbar */}
      <div className={`
        bg-black shrink-0 shadow-2xl flex items-center
        ${toolbarPos === 'bottom' ? 'w-full h-16 border-t border-white/5 order-last flex-row px-8 gap-8 justify-center' : `w-16 h-full border-white/5 flex-col py-6 gap-6 ${toolbarPos === 'right' ? 'border-l order-last' : 'border-r'}`}
      `}>
        <button onClick={() => setActiveTab('scenario')} className={`p-3 rounded-lg transition-all ${activeTab === 'scenario' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`} title="デザイン設定"><Palette size={20} /></button>
        <button onClick={() => setActiveTab('characters')} className={`p-3 rounded-lg transition-all ${activeTab === 'characters' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`} title="登場人物"><Users size={20} /></button>
        <button onClick={() => setActiveTab('phases')} className={`p-3 rounded-lg transition-all ${activeTab === 'phases' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`} title="進行・台本"><FileText size={20} /></button>
        <button onClick={() => setActiveTab('sounds')} className={`p-3 rounded-lg transition-all ${activeTab === 'sounds' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`} title="演出音響"><Music size={20} /></button>
        <button onClick={() => setActiveTab('media')} className={`p-3 rounded-lg transition-all ${activeTab === 'media' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`} title="画像リソース"><ImageIcon size={20} /></button>
        <button onClick={() => setActiveTab('snapshots')} className={`p-3 rounded-lg transition-all ${activeTab === 'snapshots' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`} title="シナリオスナップショット"><Camera size={20} /></button>
        <button onClick={() => setActiveTab('identity')} className={`p-3 rounded-lg transition-all ${activeTab === 'identity' ? 'bg-white/10 text-white' : 'text-white/20 hover:text-white/40'}`} title="プロジェクトID"><Fingerprint size={20} /></button>
        
        {/* Undo/Redo & Shortcuts Section */}
        <div className={`flex ${toolbarPos === 'bottom' ? 'flex-row items-center gap-4 ml-6 border-l pl-6 border-white/10' : 'flex-col items-center gap-4 mt-auto border-t pt-6 border-white/10'}`}>
          <button 
            onClick={() => setShowShortcuts(true)}
            className="p-2.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all cursor-pointer"
            title="ショートカットキー一覧 (Keyboard Shortcuts)"
          >
            <Keyboard size={18} />
          </button>
          <button 
            disabled={!canUndo} 
            onClick={onUndo} 
            className={`p-2.5 rounded-lg transition-all ${canUndo ? 'text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer' : 'text-white/5 cursor-not-allowed'}`} 
            title="元に戻す (Ctrl+Z)"
          >
            <Undo2 size={18} />
          </button>
          <button 
            disabled={!canRedo} 
            onClick={onRedo} 
            className={`p-2.5 rounded-lg transition-all ${canRedo ? 'text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer' : 'text-white/5 cursor-not-allowed'}`} 
            title="やり直す (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 size={18} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-black/40">
        <div className="flex-1 overflow-y-auto p-4 md:p-10 max-w-5xl mx-auto w-full scrollbar-thin">
          
          {activeTab === 'scenario' && (
            <ScenarioTab scenario={scenario} onUpdate={updateScenario} />
          )}

          {activeTab === 'characters' && (
            <CharactersTab scenario={scenario} onUpdate={updateScenario} />
          )}

          {activeTab === 'sounds' && (
            <SoundTab 
              scenario={scenario} 
              onUpdate={onUpdate} 
              previewingSoundId={previewingSoundId} 
              onTogglePreview={togglePreview} 
            />
          )}

          {activeTab === 'phases' && (
            <PhasesTab 
              scenario={scenario} 
              onUpdate={updateScenario} 
              collapsedPhases={collapsedPhases}
              onToggleCollapse={togglePhaseCollapse}
              onSetAllCollapsed={setAllCollapsed}
              onTabChange={setActiveTab}
            />
          )}

          {activeTab === 'media' && (
            <MediaTab 
              scenario={scenario} 
              onUpdate={updateScenario} 
            />
          )}

          {activeTab === 'snapshots' && (
            <SnapshotsTab 
              scenario={scenario} 
              onUpdate={updateScenario} 
            />
          )}

          {activeTab === 'identity' && (
            <IdentityTab scenario={scenario} user={user} onUpdate={updateScenario} />
          )}
        </div>

        {/* Changes Saved Toast Indicator */}
        <AnimatePresence>
          {showSavedToast && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute bottom-6 right-6 z-50 flex items-center gap-2 px-3.5 py-2 bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-mono font-medium shadow-2xl backdrop-blur-md pointer-events-none select-none"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Check size={14} className="text-emerald-400 shrink-0" />
              <span>Changes Saved</span>
            </motion.div>
          )}
        </AnimatePresence>

        <ShortcutsGuideModal
          isOpen={showShortcuts}
          onClose={() => setShowShortcuts(false)}
          themeColor={scenario.themeColor || '#f59e0b'}
          customShortcuts={scenario.customShortcuts}
          isEditorMode={true}
        />
      </div>
    </div>
  );
});

export default EditorView;
