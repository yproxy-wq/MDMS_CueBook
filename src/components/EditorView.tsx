import { getR2AssetIdFromUrl } from '../services/R2AssetService';
import { resolveR2Sound } from '../services/R2AudioPlayback';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Scenario, SoundConfig } from '../types';
import {
  Palette, Music, Users, FileText, Fingerprint, Image as ImageIcon, Undo2, Redo2, Camera, Keyboard
} from 'lucide-react';

import { audioService } from '../services/AudioService';
import { User } from 'firebase/auth';

// Import sub-components
import { ScenarioTab } from './editor/ScenarioTab';
import { CharactersTab } from './editor/CharactersTab';
import { PhasesTab } from './editor/PhasesTab';
import { SoundTab } from './editor/SoundTab';
import type { AudioLibrarySyncStatus } from '../services/AudioLibrarySession';
import { IdentityTab } from './editor/IdentityTab';
import { MediaTab } from './editor/MediaTab';
import { SnapshotsTab } from './editor/SnapshotsTab';
import { ShortcutsGuideModal } from './modals/ShortcutsGuideModal';

interface EditorViewProps {
  scenario: Scenario;
  audioLibraryStatus?: AudioLibrarySyncStatus;
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
  scenario, user, onUpdate, audioLibraryStatus, canUndo = false, canRedo = false, onUndo, onRedo
}) => {
  const [activeTab, setActiveTab] = useState<'phases' | 'sounds' | 'characters' | 'scenario' | 'identity' | 'media' | 'snapshots'>('phases');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewingSoundId, setPreviewingSoundId] = useState<string | null>(null);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);

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

  const previewRevision = useRef(0);
  const previewIdRef = useRef<string | null>(null);
  useEffect(() => () => {
    previewRevision.current += 1;
    if (previewIdRef.current) audioService.stop(previewIdRef.current);
    previewIdRef.current = null;
  }, [scenario.id]);

  useEffect(() => {
    if (previewingSoundId && !scenario.sounds.some(sound => sound.id === previewingSoundId)) {
      previewIdRef.current = null;
      previewRevision.current += 1;
    }
  }, [previewingSoundId, scenario.sounds]);

  const togglePreview = useCallback(async (sound: SoundConfig) => {
    if (previewingSoundId && previewingSoundId !== sound.id) {
      audioService.stop(previewingSoundId);
    }

    setPreviewError(null);
    const revision = ++previewRevision.current;
    previewIdRef.current = sound.id;
    try {
      if (getR2AssetIdFromUrl(sound.url)) {
        void audioService.activateAudio();
        setPreviewingSoundId(sound.id);
      }
      const resolved = getR2AssetIdFromUrl(sound.url) ? await resolveR2Sound(sound) : sound;
      if (revision !== previewRevision.current) return;
      const played = await audioService.playPreview(resolved, () => {
        if (previewIdRef.current === sound.id) setPreviewingSoundId(null);
      });
      if (revision === previewRevision.current) setPreviewingSoundId(played ? sound.id : null);
    } catch (error) {
      if (revision === previewRevision.current) {
        setPreviewingSoundId(null);
        setPreviewError(error instanceof Error ? error.message : '音声の読み込みに失敗しました。');
      }
      console.warn('音源の試聴に失敗しました。', error);
    }
  }, [previewingSoundId]);

  const toolbarPos = scenario.editorToolbarPosition || 'left';

  return (
    <div className={`flex h-full bg-[#050505] z-20 w-full overflow-hidden ${toolbarPos === 'bottom' ? 'flex-col' : 'flex-row'}`}>
      {/* Sidebar / Toolbar */}
      <div className={`
        editor-navigation bg-black shrink-0 flex items-center
        ${toolbarPos === 'bottom' ? 'w-full border-t border-white/10 order-last flex-row px-2 gap-2 overflow-x-auto' : `w-[104px] h-full border-white/10 flex-col py-3 gap-2 overflow-y-auto ${toolbarPos === 'right' ? 'border-l order-last' : 'border-r'}`}
      `}>
        {([
          ['scenario', 'デザイン', Palette], ['characters', '登場人物', Users], ['phases', '進行・台本', FileText],
          ['sounds', '演出音響', Music], ['media', '画像', ImageIcon], ['snapshots', '履歴', Camera], ['identity', 'プロジェクト', Fingerprint],
        ] as const).map(([tab, label, Icon]) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} aria-pressed={activeTab === tab}
          className={activeTab === tab ? 'flex shrink-0 flex-col items-center gap-1 rounded-lg bg-emerald-300/10 px-2 py-2 text-emerald-200' : 'flex shrink-0 flex-col items-center gap-1 rounded-lg px-2 py-2 text-white/60 hover:bg-white/5 hover:text-white'}>
          <Icon size={18} /><span className="text-[11px]">{label}</span>
        </button>)}

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
        <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-6xl mx-auto w-full scrollbar-thin">

          {activeTab === 'scenario' && (
            <ScenarioTab scenario={scenario} onUpdate={updateScenario} />
          )}

          {activeTab === 'characters' && (
            <CharactersTab scenario={scenario} onUpdate={updateScenario} />
          )}

          {activeTab === 'sounds' && (
            <>
            {previewError && <p role="alert" className="mb-3 rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{previewError}</p>}
            <SoundTab
              syncStatus={audioLibraryStatus}
              user={user}
              scenario={scenario}
              onUpdate={onUpdate}
              previewingSoundId={scenario.sounds.some(sound => sound.id === previewingSoundId) ? previewingSoundId : null}
              onTogglePreview={togglePreview}
              onStopPreview={soundId => {
                if (previewIdRef.current === soundId || previewingSoundId === soundId) {
                  previewRevision.current += 1;
                  previewIdRef.current = null;
                  setPreviewingSoundId(null);
                }
              }}
            />
            </>
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
              user={user}
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
