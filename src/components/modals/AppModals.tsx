import React from 'react';
import { createPortal } from 'react-dom';
import { LogIn, AlertTriangle, MessageSquare } from 'lucide-react';
import PreferencesModal from '../PreferencesModal';
import PerformanceModal from '../PerformanceModal';
import PerformanceHistoryModal from '../PerformanceHistoryModal';
import HandoutModal from '../HandoutModal';
import SyncWindowModal from './SyncWindowModal';
import { Scenario, Performance, Character, AppState, TimerConfig } from '../../types';
import { User } from 'firebase/auth';

const DUMMY_PERFORMANCES: Performance[] = [
  {
    id: 'dummy-1',
    scenarioId: 'demo-1',
    scenarioTitle: 'サンプル・シナリオ：黒い館の殺人',
    date: '2026-04-10',
    venue: 'オンライン（Discord）',
    cast: [
      { characterId: 'c1', characterName: '探偵', playerName: 'たろう' },
      { characterId: 'c2', characterName: '助手', playerName: 'はなこ' },
      { characterId: 'c3', characterName: '犯人', playerName: 'じろう' }
    ],
    timestamp: Date.now() - 86400000 * 2
  },
  {
    id: 'dummy-2',
    scenarioId: 'demo-2',
    scenarioTitle: '黄昏のラプソディ',
    date: '2026-04-15',
    venue: 'レンタルスペース魔法の箱',
    cast: [
      { characterId: 'ch1', characterName: '吟遊詩人', playerName: 'Alice' },
      { characterId: 'ch2', characterName: '騎士', playerName: 'Bob' }
    ],
    timestamp: Date.now() - 86400000
  }
];

interface AppModalsProps {
  // Preferences Modal
  showPreferences: boolean;
  setShowPreferences: (show: boolean) => void;
  currentScenario: Scenario;
  onUpdateScenario: (scenario: Partial<Scenario>) => void;
  user: User | null;

  // Performance Modal
  performanceModalOpen: boolean;
  setPerformanceModalOpen: (open: boolean) => void;
  onSavePerformance: (perf: Omit<Performance, 'id' | 'timestamp'>) => void;
  themeColor: string;
  phaseResults: Record<string, number>;

  // Error Handling
  lastError: { code: string; message: string } | null;
  setLastError: (err: { code: string; message: string } | null) => void;

  // History Modal
  historyModalOpen: boolean;
  setHistoryModalOpen: (open: boolean) => void;
  performanceHistory: Performance[];
  onRemovePerformance: (id: string) => void;

  // Login Confirmation
  showLoginConfirmation: boolean;
  setShowLoginConfirmation: (show: boolean) => void;
  onConfirmLogin: () => void;

  // Handout Modal
  handoutCharacterId: string | null;
  setHandoutCharacterId: (id: string | null) => void;
  onUpdateCharacter: (charId: string, updates: Partial<Character>) => void;

  // Sync Modal
  showSyncModal: boolean;
  setShowSyncModal: (show: boolean) => void;
  onShareSync: () => string;
  onApplySync: (config: AppState['syncConfig']) => void;
  syncConfig: AppState['syncConfig'];
  activeTimer?: TimerConfig;
  activeTimerState: { seconds: number; isRunning: boolean; startTime?: number | null } | null;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onResetSync: () => void;
  quotaExceeded: boolean;
}

export const AppModals: React.FC<AppModalsProps> = React.memo(({
  showPreferences,
  setShowPreferences,
  currentScenario,
  onUpdateScenario,
  user,
  performanceModalOpen,
  setPerformanceModalOpen,
  onSavePerformance,
  themeColor,
  phaseResults,
  lastError,
  setLastError,
  historyModalOpen,
  setHistoryModalOpen,
  performanceHistory,
  onRemovePerformance,
  showLoginConfirmation,
  setShowLoginConfirmation,
  onConfirmLogin,
  handoutCharacterId,
  setHandoutCharacterId,
  onUpdateCharacter,
  showSyncModal,
  setShowSyncModal,
  onShareSync,
  onApplySync,
  syncConfig,
  activeTimer,
  activeTimerState,
  onToggleTimer,
  onResetTimer,
  onResetSync,
  quotaExceeded,
}) => {
  return (
    <>
      {showPreferences && (
        <PreferencesModal 
          isOpen={showPreferences}
          onClose={() => setShowPreferences(false)}
          scenario={currentScenario}
          onUpdateScenario={onUpdateScenario}
        />
      )}

      {performanceModalOpen && (
        <PerformanceModal 
          scenario={currentScenario}
          phaseResults={phaseResults}
          onSave={onSavePerformance}
          onClose={() => setPerformanceModalOpen(false)}
          themeColor={themeColor}
        />
      )}

      {lastError && createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-red-500/30 p-8 rounded-2xl max-w-lg w-full shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-200" id="error-dialog">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <span className="text-[10px] font-mono text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">{lastError.code}</span>
                <h3 className="text-xl font-cinzel font-bold text-white tracking-widest">システムエラー</h3>
              </div>
              <p className="text-sm text-white/40 leading-relaxed font-mono break-all">{lastError.message}</p>
              <p className="text-[11px] text-white/20 mt-4 leading-relaxed italic animate-pulse">ご不便をおかけして申し訳ありません。<br/>以下のリンクより不具合をご報告いただければ幸いです。</p>
            </div>
            <div className="flex w-full gap-3">
              <button 
                id="close-error-btn"
                onClick={() => setLastError(null)} 
                className="px-6 py-3 rounded-xl bg-white/5 text-white/60 font-bold font-cinzel text-xs border border-white/5 hover:bg-white/10 transition-all active:scale-95"
              >
                CLOSE
              </button>
              <a 
                id="report-issue-link"
                href="https://forms.gle/oQ9mSQaCwPHP6TNA9" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold font-cinzel text-xs shadow-lg shadow-red-900/20 flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all"
              >
                <MessageSquare size={14} />
                <span>不具合を報告する</span>
              </a>
            </div>
          </div>
        </div>,
        document.body
      )}

      {historyModalOpen && (
        <PerformanceHistoryModal 
          history={performanceHistory.length > 0 ? performanceHistory : DUMMY_PERFORMANCES}
          onRemove={onRemovePerformance}
          onClose={() => setHistoryModalOpen(false)}
          themeColor={themeColor}
        />
      )}

      {showLoginConfirmation && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-8 flex flex-col items-center text-center gap-6" id="login-dialog">
            <div className="w-16 h-16 rounded-full bg-sky-500/10 flex items-center justify-center text-sky-500">
              <LogIn size={32} />
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-cinzel font-bold text-white tracking-widest uppercase">SIGN IN WITH GOOGLE</h3>
              <p className="text-[11px] text-white/60 leading-relaxed font-sans text-left bg-white/5 p-4 rounded-lg border border-white/5">
                Googleアカウントを使用してログインすると、<b>公演記録の保存</b>、<b>タイマーのリアルタイム同期(Sync)</b>、および<b>PLへの個別メッセージ送信</b>機能が使用可能になります。<br /><br />
                ログインに際し、CueBook開発者はあなたの表示名(本名やハンドルネーム)や、保存された公演記録などを取得することはなく、それらを確認することもできないことをお約束します。
              </p>
            </div>
            <div className="flex flex-col w-full gap-3">
              <button 
                id="agree-signin-btn"
                onClick={onConfirmLogin} 
                className="w-full py-4 rounded-xl bg-white text-black font-bold font-cinzel text-xs hover:bg-white/90 transition-all shadow-lg shadow-white/5 active:scale-95"
              >
                AGREE & SIGN IN
              </button>
              <button 
                id="cancel-signin-btn"
                onClick={() => setShowLoginConfirmation(false)} 
                className="w-full py-3 rounded-xl bg-white/5 text-white/40 font-bold font-cinzel text-xs border border-white/5 hover:bg-white/10 transition-all active:scale-95"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {handoutCharacterId && (
        <HandoutModal 
          key={handoutCharacterId}
          character={currentScenario.characters.find(c => c.id === handoutCharacterId)!}
          onClose={() => setHandoutCharacterId(null)}
          themeColor={themeColor}
          onUpdateCharacter={onUpdateCharacter}
          scenarioTitle={currentScenario.title}
          sessionId={user?.uid}
        />
      )}

      {showSyncModal && (
        <SyncWindowModal 
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          onShareSync={onShareSync}
          onApplySync={onApplySync}
          syncConfig={syncConfig}
          timerLabel={activeTimer?.label}
          timerSeconds={activeTimerState?.seconds}
          isTimerRunning={activeTimerState?.isRunning}
          timerStartTime={activeTimerState?.startTime}
          onToggleTimer={onToggleTimer}
          onResetTimer={onResetTimer}
          onResetSync={onResetSync}
          availableMedia={currentScenario.playerImages && currentScenario.playerImages.length > 0 ? currentScenario.playerImages : (currentScenario.images || [])}
          quotaExceeded={quotaExceeded}
          isLoggedIn={!!user}
          onLogin={() => setShowLoginConfirmation(true)}
        />
      )}
    </>
  );
});

AppModals.displayName = 'AppModals';
