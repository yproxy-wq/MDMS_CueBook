
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Share, Copy, Check, ExternalLink, Play, Pause, RotateCcw, Monitor, Image as ImageIcon, Clock, Layout, Maximize2, X, HelpCircle, FileText, Upload, Cloud, Loader2, AlertTriangle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { SyncConfig, ImageResource } from '../../types';
import { isConfigDirty } from '../../utils/syncHelper';
import { transformDropboxUrl } from '../../utils/mediaHelper';
import { getPdfPageStateKey } from '../../utils/pdfAssetHelper';

interface SyncWindowModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShareSync: () => string;
  onApplySync: (config: SyncConfig) => void;
  syncConfig: SyncConfig;
  // Timer info for controls
  timerLabel?: string;
  timerSeconds?: number;
  timerStartTime?: number | null;
  isTimerRunning?: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
  onResetSync: () => void;
  // Media info
  availableMedia: ImageResource[];
  quotaExceeded?: boolean;
  isLoggedIn?: boolean;
  onLogin?: () => void;
  pdfPageStates?: Record<string, number>;
  onSetPdfPage?: (url: string, page: number) => void;
  scenarioId: string;
  onAddPdfAsset?: (asset: ImageResource) => void;
}

// Sub-component for Live Preview to ensure clean updates
const SyncPreview: React.FC<{
  config: SyncConfig;
  availableMedia: ImageResource[];
  timerLabel?: string;
  displaySeconds: number;
  isTimerRunning: boolean;
  formatTime: (s: number) => string;
}> = React.memo(({ config, availableMedia, timerLabel, displaySeconds, isTimerRunning, formatTime }) => {
  // Normalize IDs for matching - use a robust string comparison
  const activeId = config.activeImageId ? String(config.activeImageId).trim() : null;
  const isVisible = config.contentEnabled;

  // Find the current item
  const mediaItem = React.useMemo(() => 
    availableMedia.find(m => m.id && String(m.id).trim() === activeId),
  [availableMedia, activeId]);

  // Keep track of the last valid media to prevent flickering during scenario updates
  const [stickyMedia, setStickyMedia] = React.useState<ImageResource | null>(null);
  
  React.useEffect(() => {
    if (mediaItem) {
      setStickyMedia(mediaItem);
    }
  }, [mediaItem]);

  // Use sticky media if current is missing but we still have an activeId
  // This prevents the image from disappearing if availableMedia is briefly empty
  const displayMedia = mediaItem || (activeId ? stickyMedia : null);

  return (
    <div className="aspect-video w-full bg-[#0a0a0a] rounded-xl border border-white/10 relative overflow-hidden ring-1 ring-white/5 shadow-[0_0_30px_rgba(0,0,0,0.5)] group">
      {/* Background (Solid) */}
      <div className="absolute inset-0 bg-zinc-950" />
      
      {/* Synced Content (Image) with Cross-fade transition */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence>
          {activeId && displayMedia?.url ? (
            <motion.div 
              key={displayMedia.id} // Stable key based on content ID
              initial={{ opacity: 0 }}
              animate={{ opacity: isVisible ? 1 : 0.2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="w-full h-full flex items-center justify-center overflow-hidden relative"
            >
              {displayMedia.assetId ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-sky-950/40 text-sky-100">
                  <FileText size={28} className="text-sky-300" />
                  <span className="text-[8px] font-mono tracking-widest">DROPBOX PDF · {displayMedia.pageCount || '?'} PAGES</span>
                </div>
              ) : (
                <img
                  src={displayMedia.url}
                  alt="Preview"
                  className="w-full h-full pointer-events-none"
                  style={{
                    objectFit: config.imageFit === 'cover' ? 'cover' : (config.imageFit === 'contain' ? 'contain' : 'fill'),
                    width: config.imageFit === 'width' ? '100%' : (config.imageFit === 'height' ? 'auto' : '100%'),
                    height: config.imageFit === 'height' ? '100%' : (config.imageFit === 'width' ? 'auto' : '100%'),
                    margin: 'auto'
                  }}
                  referrerPolicy="no-referrer"
                />
              )}
              {/* Dynamic Live Overlay Preview */}
              {config.overlayType && config.overlayType !== 'none' && (
                <div 
                  className="absolute inset-0 pointer-events-none z-10 transition-all duration-300" 
                  style={{ 
                    backgroundColor: config.overlayType === 'black' ? 'black' : 'white',
                    opacity: config.overlayIntensity ?? 0.5 
                  }} 
                />
              )}
              {!isVisible && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/85 backdrop-blur-[2px] z-20">
                  <Monitor size={20} className="text-pink-500/40 animate-pulse mb-1.5" />
                  <span className="text-[7.5px] font-bold font-mono tracking-widest text-pink-500/60 uppercase">IMAGE MUTED (HIDDEN IN CONFIG)</span>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            >
              <ImageIcon size={24} className="text-white/5" />
              {activeId && !displayMedia && (
                <div className="bg-red-500/10 border border-red-500/20 px-2 py-1 rounded">
                  <p className="text-[6px] text-red-400 font-mono">LOADING OR MEDIA NOT FOUND</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Timer Overlay */}
      <AnimatePresence>
        {config.timerEnabled && !config.timerForceHidden && (
          <motion.div 
            initial={{ opacity: 0, y: config.timerPosition === 'bottom' ? 10 : -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: config.timerPosition === 'bottom' ? 10 : -10 }}
            key={`timer-${config.timerPosition}`}
            className={`absolute left-0 right-0 p-2 pointer-events-none z-20 flex ${config.timerPosition === 'bottom' ? 'bottom-0' : 'top-0'} justify-center`}
          >
            <div className={`
              ${config.timerColor === 'black' ? 'bg-white/80 border-black/10 text-black' : 'bg-black/70 border-white/20 text-white'}
              backdrop-blur-md border rounded-lg px-2 py-1 flex flex-col items-center gap-0.5
              ${config.timerSize === 'small' ? 'min-w-[60px]' : config.timerSize === 'medium' ? 'min-w-[90px]' : 'min-w-[120px]'}
              shadow-[0_0_20px_rgba(0,0,0,0.8)]
              transition-all duration-300
            `}>
              <p className={`text-[4px] font-cinzel ${config.timerColor === 'black' ? 'text-sky-600' : 'text-sky-400/90'} font-bold uppercase tracking-[0.3em] leading-none mb-0.5`}>
                {config.timerLabelText || timerLabel || 'TIMER'}
              </p>
              <p 
                className={`font-mono font-black tabular-nums leading-none ${config.timerSize === 'small' ? 'text-[10px]' : config.timerSize === 'medium' ? 'text-[14px]' : 'text-[18px]'} ${config.timerColor === 'black' ? 'text-black' : 'text-white'}`}
                style={{ 
                  textShadow: isTimerRunning && config.timerColor !== 'black' ? '0 0 10px rgba(14,165,233,0.5)' : 'none',
                  opacity: isTimerRunning ? 1 : 0.4
                }}
              >
                {formatTime(displaySeconds)}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dark gradient for timer readability */}
      {config.timerEnabled && !config.timerForceHidden && isVisible && activeId && (
        <div className={`absolute inset-x-0 h-10 bg-gradient-to-${config.timerPosition === 'bottom' ? 't' : 'b'} from-black/60 to-transparent pointer-events-none ${config.timerPosition === 'bottom' ? 'bottom-0' : 'top-0'}`} />
      )}

      {/* Lap Banner Preview */}
      {config.lapDisplayMode && config.lapDisplayMode !== 'hidden' && (
        <div 
          className={`absolute inset-x-0 py-1 bg-pink-600/90 border-t border-b border-pink-500/50 text-[6px] font-black text-center tracking-[0.2em] text-white uppercase z-30 flex items-center justify-center gap-1 font-mono transition-all ${
            config.lapDisplayMode === 'overlay' 
              ? 'top-1/2 -translate-y-1/2 w-2/3 mx-auto rounded-full shadow-[0_0_15px_#ec4899] border' 
              : `${config.lapDisplayPosition === 'bottom' ? 'bottom-2' : 'top-2'}`
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          ラッププレビュー: {config.lapDisplayMode === 'overlay' ? 'フラッシュ (8秒)' : '常時表示'}
        </div>
      )}

      {/* Live Badge */}
      <div className="absolute bottom-1 right-1 flex items-center gap-1.5 z-20">
        <div className="px-1 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded text-[5px] text-emerald-400 font-bold tracking-widest uppercase">
          ライブプレビュー
        </div>
      </div>
    </div>
  );
});

const SyncWindowModal: React.FC<SyncWindowModalProps> = ({ 
  isOpen, 
  onClose, 
  onShareSync,
  onApplySync,
  syncConfig,
  timerLabel,
  timerSeconds = 0,
  timerStartTime = null,
  isTimerRunning = false,
  onToggleTimer,
  onResetTimer,
  onResetSync,
  availableMedia = [],
  quotaExceeded = false,
  isLoggedIn = false,
  onLogin,
  pdfPageStates = {},
  onSetPdfPage,
  scenarioId,
  onAddPdfAsset,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  
  // Local draft state for Apply logic
  const [draft, setDraft] = useState<SyncConfig>(syncConfig);
  const [synced, setSynced] = useState(false);
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [dropboxConnected, setDropboxConnected] = useState<boolean | null>(null);
  const [dropboxMessage, setDropboxMessage] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ stage: string; currentPage: number; pageCount: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadAbortRef = React.useRef<AbortController | null>(null);
  const pdfUploadInputRef = React.useRef<HTMLInputElement>(null);

  // Adjusted state during render pattern to keep draft synced with incoming configuration updates
  const [prevSyncConfig, setPrevSyncConfig] = useState(syncConfig);
  if (syncConfig !== prevSyncConfig) {
    setPrevSyncConfig(syncConfig);
    setDraft(syncConfig);
  }

  const isDirty = isConfigDirty(draft, syncConfig);
  const selectedMedia = availableMedia.find((media) => String(media.id) === String(draft.activeImageId));
  const selectedPdfPage = selectedMedia?.type === 'pdf' ? (pdfPageStates[getPdfPageStateKey(selectedMedia)] || 1) : null;

  const refreshDropboxConnection = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const { isDropboxConnected } = await import('../../services/DropboxOAuthService');
      setDropboxConnected(await isDropboxConnected());
      setDropboxMessage(null);
    } catch {
      setDropboxConnected(false);
      setDropboxMessage('Dropbox接続状態を確認できませんでした。');
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isOpen || !isLoggedIn) {
      setDropboxConnected(null);
      return;
    }
    void refreshDropboxConnection();
  }, [isOpen, isLoggedIn, refreshDropboxConnection]);

  const handleConnectDropbox = async () => {
    if (!isLoggedIn) {
      onLogin?.();
      return;
    }
    try {
      const { connectDropbox } = await import('../../services/DropboxOAuthService');
      await connectDropbox();
      setDropboxMessage('Dropboxで許可した後、この画面の「接続状態を更新」を押してください。');
    } catch (error) {
      setDropboxMessage(error instanceof Error && error.message === 'DROPBOX_POPUP_BLOCKED'
        ? '認可ポップアップがブロックされました。ブラウザでポップアップを許可してください。'
        : 'Dropbox認可を開始できませんでした。');
    }
  };

  const handlePdfAssetFile = async (file: File | undefined) => {
    if (!file || !onAddPdfAsset) return;
    if (!isLoggedIn) {
      onLogin?.();
      return;
    }
    if (!dropboxConnected) {
      setUploadError('先にDropboxを接続し、接続状態を更新してください。');
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('PDFファイルを選択してください。');
      return;
    }

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setUploadError(null);
    try {
      const { uploadPdfAssetToDropbox } = await import('../../services/DropboxPdfAssetService');
      const result = await uploadPdfAssetToDropbox(scenarioId, file, setUploadProgress, controller.signal);
      const asset: ImageResource = {
        id: result.assetId,
        name: file.name,
        url: `asset://${result.assetId}`,
        type: 'pdf',
        assetId: result.assetId,
        pageCount: result.pageCount,
        updatedAt: Date.now(),
      };
      onAddPdfAsset(asset);
      onSetPdfPage?.(getPdfPageStateKey(asset), 1);
      const nextDraft = { ...draft, activeImageId: asset.id };
      setDraft(nextDraft);
      onApplySync(nextDraft);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.warn('[PDF asset] Upload failed:', error);
        setUploadError('PDFの変換またはDropboxへの保存に失敗しました。接続とファイルを確認して再試行してください。');
      }
    } finally {
      uploadAbortRef.current = null;
      setUploadProgress(null);
      if (pdfUploadInputRef.current) pdfUploadInputRef.current.value = '';
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadPdfMetadata = async () => {
      if (selectedMedia?.type !== 'pdf' || !selectedMedia.url) {
        setPdfPageCount(null);
        setPdfError(null);
        return;
      }
      if (selectedMedia.assetId) {
        setPdfPageCount(selectedMedia.pageCount || null);
        setPdfError(null);
        setPdfLoading(false);
        return;
      }
      if (/dropbox\.com/i.test(selectedMedia.url)) {
        setPdfPageCount(null);
        setPdfError('公開Dropbox PDFはブラウザからページ一覧を取得できません。Dropbox PDFページ画像として追加してください。');
        setPdfLoading(false);
        return;
      }
      setPdfLoading(true);
      setPdfError(null);
      try {
        const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ]);
        GlobalWorkerOptions.workerSrc = workerModule.default;
        const loadingTask = getDocument({ url: transformDropboxUrl(selectedMedia.url), disableAutoFetch: true, disableStream: true });
        const pdf = await loadingTask.promise;
        if (!cancelled) setPdfPageCount(pdf.numPages);
        await loadingTask.destroy();
      } catch {
        if (!cancelled) {
          setPdfPageCount(null);
          setPdfError('ページ一覧を取得できません。Dropboxの公開設定またはCORSを確認してください。');
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    };
    void loadPdfMetadata();
    return () => { cancelled = true; };
  }, [selectedMedia?.type, selectedMedia?.url, selectedMedia?.assetId, selectedMedia?.pageCount]);
  
  // Adjusted state during render pattern to avoid useEffect warnings and cascading renders
  const [displaySeconds, setDisplaySeconds] = useState(timerSeconds);
  const [prevTimerSeconds, setPrevTimerSeconds] = useState(timerSeconds);

  if (timerSeconds !== prevTimerSeconds && !isTimerRunning) {
    setPrevTimerSeconds(timerSeconds);
    setDisplaySeconds(timerSeconds);
  }

  // Update display seconds in real-time when running
  useEffect(() => {
    if (!isTimerRunning || !timerStartTime) {
      return;
    }

    const update = () => {
      const elapsed = (Date.now() - timerStartTime) / 1000;
      setDisplaySeconds(Math.max(0, timerSeconds - elapsed));
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [isTimerRunning, timerStartTime, timerSeconds]);

  const handleApply = () => {
    onApplySync(draft);
    setSynced(true);
    setTimeout(() => setSynced(false), 9000);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(Math.max(0, s) / 60);
    const secs = Math.floor(Math.max(0, s) % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (typeof document === 'undefined' || !isOpen) return null;

  const shareUrl = onShareSync();

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-zinc-950 border border-white/10 rounded-[32px] w-full max-w-[960px] shadow-2xl overflow-hidden flex flex-col h-full max-h-[95vh] md:max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 w-full">
          {/* Left Side: Preview & Login (matches screenshot) */}
          <div className="w-full md:w-[240px] lg:w-[280px] bg-white/5 border-b md:border-b-0 md:border-r border-white/10 p-5 md:p-6 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
            {/* Title / Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-cinzel font-bold text-white tracking-widest uppercase">Child Window</h3>
                <p className="text-[8px] text-white/30 uppercase tracking-[0.2em] font-cinzel">子ウィンドウ設定</p>
              </div>
            </div>
            
            {/* Preview Area */}
            <SyncPreview 
              config={draft}
              availableMedia={availableMedia}
              timerLabel={timerLabel}
              displaySeconds={displaySeconds}
              isTimerRunning={isTimerRunning}
              formatTime={formatTime}
            />

                        {/* Login / Auth */}
            {!isLoggedIn ? (
               <div className="mt-6 w-full bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col items-center text-center gap-3">
                  <span className="text-[10px] font-mono text-amber-400 font-extrabold uppercase tracking-widest">ログインが必要です</span>
                  <p className="text-[10px] text-white/60 leading-relaxed font-sans">
                    画面共有・同期機能を利用するには、サインインによるセッションの作成が必要です。
                  </p>
                  {onLogin && (
                    <button
                      onClick={onLogin}
                      className="px-3 py-2.5 w-full rounded-xl bg-white text-black text-[10px] font-bold font-sans hover:bg-white/90 active:scale-95 transition-all shadow-md cursor-pointer"
                    >
                      ログインする
                    </button>
                  )}
                </div>
            ) : (
              <div className="mt-8 flex flex-col gap-6">
                <div className="bg-white p-3 rounded-2xl shadow-xl mx-auto w-full max-w-[160px] aspect-square flex items-center justify-center shrink-0">
                  <QRCodeSVG
                    value={shareUrl}
                    size={136}
                    level="H"
                    fgColor="#000000"
                    className="w-full h-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-[9px] font-bold text-white/50 font-cinzel tracking-widest uppercase">ACCESS URL</span>
                    <button 
                      className="text-white/30 hover:text-white transition-colors"
                      title="Viewer URL"
                    >
                      <HelpCircle size={10} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-1.5 pl-3">
                    <span className="text-[9px] font-mono text-white/40 truncate flex-1 leading-none pt-0.5">
                      {shareUrl}
                    </span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 9000);
                      }}
                      className={`p-2 rounded-lg transition-all shrink-0 ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'}`}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                  
                  <button
                    onClick={() => { window.open(shareUrl, '_blank'); }}
                    className="w-full py-2.5 mt-2 rounded-xl bg-white/5 text-white/60 hover:bg-white/10 hover:text-white font-bold font-cinzel text-[10px] tracking-[0.1em] flex items-center justify-center gap-2 transition-all border border-white/10"
                  >
                    <ExternalLink size={12} /> NEW TAB
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Right Side: Main Controls */}
          <div className="flex-1 flex flex-col min-h-0 bg-[#06070a]/30">
            {/* Header Area */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <Layout size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-cinzel font-bold text-white tracking-widest uppercase">Sync Studio</h4>
                  <p className="text-[8px] font-medium text-white/30 uppercase tracking-widest">リアルタイム制御</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className={`px-3 py-1.5 rounded-full border flex items-center gap-2 transition-all ${synced ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/10 text-white/40'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${synced ? 'bg-emerald-500' : 'bg-white/20 shadow-[0_0_8px_rgba(14,165,233,0.3)]'}`} />
                  <span className="text-[9px] font-bold font-cinzel tracking-widest">{synced ? 'SYNCED' : 'READY'}</span>
                </div>
                <button 
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8 custom-scrollbar">
              {/* Top Row: Timer Controls & Visibility */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 md:gap-6">
                {/* Left Column: Timer & Lap Settings */}
                <div className="space-y-5 md:space-y-6">
                  {/* Timer Controls */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-sky-500" />
                        <span className="text-[10px] font-bold text-white/60 font-cinzel tracking-widest uppercase">タイマー制御</span>
                      </div>
                      <button
                        onClick={() => setDraft(prev => ({ ...prev, timerEnabled: !prev.timerEnabled }))}
                        className={`px-3 py-1 rounded-full text-[8px] font-bold font-cinzel transition-all border ${draft.timerEnabled ? 'bg-sky-500/20 border-sky-400/50 text-sky-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                      >
                        {draft.timerEnabled ? '表示' : '非表示'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-black/40 p-3 md:p-4 rounded-xl border border-white/5">
                      <div className="space-y-1">
                        <p className="text-[10px] text-white/40 font-cinzel tracking-widest font-bold uppercase">{timerLabel || 'タイマー'}</p>
                        <p className="text-2xl font-mono font-bold text-white tracking-tighter tabular-nums">
                          {formatTime(displaySeconds)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={onResetTimer}
                          className="p-3 rounded-xl bg-white/5 text-white/40 hover:text-white transition-all border border-white/10"
                        >
                          <RotateCcw size={18} />
                        </button>
                        <button
                          onClick={onToggleTimer}
                          className={`p-3 px-6 rounded-xl transition-all border ${isTimerRunning ? 'bg-amber-500/20 border-amber-400/50 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-emerald-500 text-white border-emerald-400'}`}
                        >
                          {isTimerRunning ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {(['small', 'medium', 'large'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setDraft(prev => ({ ...prev, timerSize: s }))}
                          className={`py-2 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${draft.timerSize === s ? 'bg-purple-500/20 border-purple-500/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                        >
                          {s === 'small' ? '小' : s === 'medium' ? '中' : '大'}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2 pt-1">
                      <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">タイマー名表示カスタム（上書き）</label>
                      <input
                        type="text"
                        value={draft.timerLabelText || ''}
                        onChange={(e) => setDraft(prev => ({ ...prev, timerLabelText: e.target.value }))}
                        placeholder="（未入力時は現在のタイマー名を表示）"
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder-white/20 transition-all font-mono"
                      />
                    </div>
                  </div>

                  {/* Lap Display Settings */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-pink-500" />
                        <span className="text-[10px] font-bold text-white/60 font-cinzel tracking-widest uppercase">ラップタイム表示設定</span>
                      </div>
                      <div className="px-1.5 py-0.5 rounded text-[5px] font-bold bg-pink-500/10 border border-pink-500/20 text-pink-400 font-mono uppercase tracking-widest">
                        v0.96md ラップ同期
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Lap Display Mode */}
                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">ラップ通知表示モード</label>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, lapDisplayMode: 'hidden' }))}
                            className={`py-1.5 md:py-2 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${draft.lapDisplayMode === 'hidden' ? 'bg-pink-500/20 border-pink-500/50 text-white shadow-[0_0_10px_rgba(236,72,153,0.15)]' : 'bg-white/5 border-white/10 text-white/40'}`}
                          >
                            非表示
                          </button>
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, lapDisplayMode: 'overlay' }))}
                            className={`py-1.5 md:py-2 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${draft.lapDisplayMode === 'overlay' || !draft.lapDisplayMode ? 'bg-pink-500/20 border-pink-500/50 text-white shadow-[0_0_10px_rgba(236,72,153,0.15)]' : 'bg-white/5 border-white/10 text-white/40'}`}
                          >
                            フラッシュ (8秒)
                          </button>
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, lapDisplayMode: 'persistent' }))}
                            className={`py-1.5 md:py-2 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${draft.lapDisplayMode === 'persistent' ? 'bg-pink-500/20 border-pink-500/50 text-white shadow-[0_0_10px_rgba(236,72,153,0.15)]' : 'bg-white/5 border-white/10 text-white/40'}`}
                          >
                            常時表示
                          </button>
                        </div>
                      </div>

                      {/* Lap Display Position */}
                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">ラップバナー表示位置</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, lapDisplayPosition: 'top' }))}
                            disabled={draft.lapDisplayMode === 'hidden'}
                            className={`py-1.5 md:py-2 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${draft.lapDisplayMode === 'hidden' ? 'opacity-30 cursor-not-allowed' : ''} ${draft.lapDisplayPosition === 'top' || !draft.lapDisplayPosition ? 'bg-amber-500/20 border-amber-500/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                          >
                            上部
                          </button>
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, lapDisplayPosition: 'bottom' }))}
                            disabled={draft.lapDisplayMode === 'hidden'}
                            className={`py-1.5 md:py-2 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${draft.lapDisplayMode === 'hidden' ? 'opacity-30 cursor-not-allowed' : ''} ${draft.lapDisplayPosition === 'bottom' ? 'bg-amber-500/20 border-amber-500/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                          >
                            下部
                          </button>
                        </div>
                      </div>

                      {/* Lap Band Size */}
                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">ラップバナー帯のサイズ</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['small', 'medium', 'large'] as const).map((sz) => (
                            <button
                              key={sz}
                              onClick={() => setDraft(prev => ({ ...prev, lapBandSize: sz }))}
                              disabled={draft.lapDisplayMode === 'hidden'}
                              className={`py-1.5 md:py-2 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${draft.lapDisplayMode === 'hidden' ? 'opacity-30 cursor-not-allowed' : ''} ${draft.lapBandSize === sz || (sz === 'medium' && !draft.lapBandSize) ? 'bg-pink-500/20 border-pink-500/50 text-white shadow-[0_0_10px_rgba(236,72,153,0.15)]' : 'bg-white/5 border-white/10 text-white/40'}`}
                            >
                              {sz === 'small' ? '小' : sz === 'medium' ? '中' : '大'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Lap Font Size */}
                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">ラップバナー文字サイズ</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['small', 'medium', 'large'] as const).map((sz) => (
                            <button
                              key={sz}
                              onClick={() => setDraft(prev => ({ ...prev, lapFontSize: sz }))}
                              disabled={draft.lapDisplayMode === 'hidden'}
                              className={`py-1.5 md:py-2 rounded-lg border text-[8px] font-bold font-cinzel transition-all ${draft.lapDisplayMode === 'hidden' ? 'opacity-30 cursor-not-allowed' : ''} ${draft.lapFontSize === sz || (sz === 'medium' && !draft.lapFontSize) ? 'bg-pink-500/20 border-pink-500/50 text-white shadow-[0_0_10px_rgba(236,72,153,0.15)]' : 'bg-white/5 border-white/10 text-white/40'}`}
                            >
                              {sz === 'small' ? '小' : sz === 'medium' ? '中' : '大'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Layout & Preview */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 flex flex-col gap-3 md:gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor size={14} className="text-emerald-500" />
                      <span className="text-[10px] font-bold text-white/60 font-cinzel tracking-widest uppercase">レイアウト設定</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 flex-1">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">タイマー配置位置</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, timerPosition: 'top' }))}
                            className={`flex-1 py-1.5 md:py-2 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${draft.timerPosition === 'top' ? 'bg-amber-500/20 border-amber-500/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                          >
                            上部
                          </button>
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, timerPosition: 'bottom' }))}
                            className={`flex-1 py-1.5 md:py-2 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${draft.timerPosition === 'bottom' ? 'bg-amber-500/20 border-amber-500/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                          >
                            下部
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">タイマー表示</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, timerEnabled: true }))}
                            className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${draft.timerEnabled ? 'bg-sky-500/20 border-sky-400/50 text-sky-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                          >
                            表示
                          </button>
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, timerEnabled: false }))}
                            className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${!draft.timerEnabled ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                          >
                            非表示
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">残り1分未満の振動（ぷるぷる）エフェクト</label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, urgentShakeEnabled: true }))}
                            className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${(draft.urgentShakeEnabled ?? true) ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                          >
                            ON (振動)
                          </button>
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, urgentShakeEnabled: false }))}
                            className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${!(draft.urgentShakeEnabled ?? true) ? 'bg-zinc-700 border-zinc-500 text-zinc-300' : 'bg-white/5 border-white/10 text-white/30'}`}
                          >
                            OFF (静止)
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between pl-1">
                          <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel">クライアント強制非表示</label>
                          <span className="text-[6px] text-pink-500/80 font-bold font-mono tracking-widest">シークレット表示</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, timerForceHidden: false }))}
                            className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${!draft.timerForceHidden ? 'bg-emerald-500/20 border-emerald-500/35 text-emerald-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                          >
                            標準表示
                          </button>
                          <button
                            onClick={() => setDraft(prev => ({ ...prev, timerForceHidden: true }))}
                            className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${draft.timerForceHidden ? 'bg-orange-500/20 border-orange-500/35 text-orange-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                          >
                            強制非表示
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* New: Overlay & Timer Color Settings */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="space-y-2">
                         <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">オーバーレイ設定 (選択中画像に保存)</label>
                         <div className="flex gap-2">
                           <button 
                             onClick={() => {
                                const nextType: NonNullable<SyncConfig['overlayType']> = 'none';
                               setDraft(prev => {
                                 const activeId = prev.activeImageId;
                                 const nextConfigs = activeId ? {
                                   ...(prev.imageConfigs || {}),
                                   [activeId]: { ...(prev.imageConfigs?.[activeId] || {}), overlayType: nextType }
                                 } : prev.imageConfigs;
                                 const updated = { ...prev, overlayType: nextType, imageConfigs: nextConfigs };
                                 onApplySync(updated);
                                 return updated;
                               });
                             }} 
                             className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${draft.overlayType === 'none' || !draft.overlayType ? 'bg-zinc-500/20 border-zinc-500/50 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                           >
                             なし
                           </button>
                           <button 
                             onClick={() => {
                                const nextType: NonNullable<SyncConfig['overlayType']> = 'black';
                               setDraft(prev => {
                                 const activeId = prev.activeImageId;
                                 const nextConfigs = activeId ? {
                                   ...(prev.imageConfigs || {}),
                                   [activeId]: { ...(prev.imageConfigs?.[activeId] || {}), overlayType: nextType }
                                 } : prev.imageConfigs;
                                 const updated = { ...prev, overlayType: nextType, imageConfigs: nextConfigs };
                                 onApplySync(updated);
                                 return updated;
                               });
                             }} 
                             className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${draft.overlayType === 'black' ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                           >
                             黒
                           </button>
                           <button 
                             onClick={() => {
                                const nextType: NonNullable<SyncConfig['overlayType']> = 'white';
                               setDraft(prev => {
                                 const activeId = prev.activeImageId;
                                 const nextConfigs = activeId ? {
                                   ...(prev.imageConfigs || {}),
                                   [activeId]: { ...(prev.imageConfigs?.[activeId] || {}), overlayType: nextType }
                                 } : prev.imageConfigs;
                                 const updated = { ...prev, overlayType: nextType, imageConfigs: nextConfigs };
                                 onApplySync(updated);
                                 return updated;
                               });
                             }} 
                             className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${draft.overlayType === 'white' ? 'bg-white border-white text-black' : 'bg-white/5 border-white/10 text-white/40'}`}
                           >
                             白
                           </button>
                         </div>
                         {draft.overlayType && draft.overlayType !== 'none' && (
                           <input 
                             type="range" min="0" max="1" step="0.1" value={draft.overlayIntensity ?? 0.5} 
                             onChange={(e) => {
                               const val = parseFloat(e.target.value);
                               setDraft(prev => {
                                 const activeId = prev.activeImageId;
                                 const nextConfigs = activeId ? {
                                   ...(prev.imageConfigs || {}),
                                   [activeId]: { ...(prev.imageConfigs?.[activeId] || {}), overlayIntensity: val }
                                 } : prev.imageConfigs;
                                 const updated = { ...prev, overlayIntensity: val, imageConfigs: nextConfigs };
                                 onApplySync(updated);
                                 return updated;
                               });
                             }}
                             className="w-full accent-cyan-500"
                           />
                         )}
                      </div>
                      
                      <div className="space-y-2">
                         <label className="text-[8px] font-bold text-white/20 uppercase tracking-widest font-cinzel pl-1">タイマー文字色 (選択中画像に保存)</label>
                         <div className="flex gap-2">
                           <button 
                             onClick={() => {
                                const nextColor: NonNullable<SyncConfig['timerColor']> = 'black';
                               setDraft(prev => {
                                 const activeId = prev.activeImageId;
                                 const nextConfigs = activeId ? {
                                   ...(prev.imageConfigs || {}),
                                   [activeId]: { ...(prev.imageConfigs?.[activeId] || {}), timerColor: nextColor }
                                 } : prev.imageConfigs;
                                 const updated = { ...prev, timerColor: nextColor, imageConfigs: nextConfigs };
                                 onApplySync(updated);
                                 return updated;
                               });
                             }} 
                             className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${draft.timerColor === 'black' ? 'bg-zinc-800 border-zinc-600 text-white' : 'bg-white/5 border-white/10 text-white/40'}`}
                           >
                             黒系
                           </button>
                           <button 
                             onClick={() => {
                                const nextColor: NonNullable<SyncConfig['timerColor']> = 'white';
                               setDraft(prev => {
                                 const activeId = prev.activeImageId;
                                 const nextConfigs = activeId ? {
                                   ...(prev.imageConfigs || {}),
                                   [activeId]: { ...(prev.imageConfigs?.[activeId] || {}), timerColor: nextColor }
                                 } : prev.imageConfigs;
                                 const updated = { ...prev, timerColor: nextColor, imageConfigs: nextConfigs };
                                 onApplySync(updated);
                                 return updated;
                               });
                             }} 
                             className={`flex-1 py-1.5 rounded-lg border text-[9px] font-bold font-cinzel transition-all ${draft.timerColor === 'white' || !draft.timerColor ? 'bg-white border-white text-black' : 'bg-white/5 border-white/10 text-white/40'}`}
                           >
                             白系
                           </button>
                         </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>

              {/* Middle: Image Selection Gallery */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ImageIcon size={14} className="text-pink-500" />
                    <span className="text-[10px] font-bold text-white/60 font-cinzel tracking-widest uppercase">コンテンツ選択 (画像)</span>
                  </div>
                  <button
                    onClick={() => setDraft(prev => ({ ...prev, contentEnabled: !prev.contentEnabled }))}
                    className={`px-3 py-1 rounded-full text-[8px] font-bold font-cinzel transition-all border ${draft.contentEnabled ? 'bg-pink-500/20 border-pink-400/50 text-pink-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                  >
                    {draft.contentEnabled ? '表示' : '非表示'}
                  </button>
                </div>

                <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-sky-200">
                      <Cloud size={13} />
                      <span>Dropbox PDFページ画像</span>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[8px] ${dropboxConnected ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-black/20 text-white/40'}`}>
                        {dropboxConnected ? '接続済み' : '未接続'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => void refreshDropboxConnection()} disabled={!isLoggedIn} className="rounded-md border border-white/10 bg-black/30 px-2 py-1 text-[8px] font-bold text-white/60 hover:text-white disabled:opacity-40">接続状態を更新</button>
                      <button type="button" onClick={() => void handleConnectDropbox()} className="rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[8px] font-bold text-sky-200 hover:bg-sky-500/20">Dropboxを接続</button>
                    </div>
                  </div>
                  <p className="text-[9px] leading-relaxed text-white/45">PDFはこの端末で1ページずつWebP化し、あなたのDropbox Appフォルダへ直接保存します。子ウィンドウにはページ画像の短期URLだけが渡ります。</p>
                  {dropboxMessage && <p className="text-[9px] text-amber-200/80">{dropboxMessage}</p>}
                  {uploadError && <p className="flex items-center gap-1 text-[9px] text-rose-300"><AlertTriangle size={11} />{uploadError}</p>}
                  {uploadProgress ? (
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-black/30 px-2.5 py-2 text-[9px] text-sky-100">
                      <span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin" />{uploadProgress.stage === 'inspecting' ? 'PDFを確認中' : uploadProgress.stage === 'creating' ? '保存先を準備中' : uploadProgress.stage === 'verifying' ? '保存を確認中' : `ページを変換・送信中 ${uploadProgress.currentPage}/${uploadProgress.pageCount}`}</span>
                      <button type="button" onClick={() => uploadAbortRef.current?.abort()} className="text-rose-300 hover:text-rose-200">中止</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => pdfUploadInputRef.current?.click()} disabled={!isLoggedIn || !dropboxConnected} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-sky-400/30 bg-sky-500/[0.06] px-3 py-2 text-[9px] font-bold text-sky-200 hover:bg-sky-500/[0.14] disabled:cursor-not-allowed disabled:opacity-40">
                      <Upload size={13} />PDFを追加してページ画像化
                    </button>
                  )}
                  <input ref={pdfUploadInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => void handlePdfAssetFile(event.target.files?.[0])} />
                </div>

                {selectedMedia?.type === 'pdf' && onSetPdfPage && (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-500/20 bg-sky-500/5 px-3 py-2">
                    <div className="flex items-center gap-2 text-[9px] font-bold text-sky-300 uppercase tracking-widest">
                      <FileText size={12} />
                      <span>PDFページ</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white/30 font-mono">P</span>
                      <input
                        type="number"
                        min={1}
                        value={selectedPdfPage || 1}
                        onChange={(event) => {
                          const page = Number.parseInt(event.target.value, 10);
                          if (Number.isFinite(page) && page >= 1) onSetPdfPage(getPdfPageStateKey(selectedMedia), page);
                        }}
                        className="w-16 rounded-md border border-sky-500/30 bg-black/50 px-2 py-1 text-center text-xs font-mono font-bold text-sky-200 outline-none focus:border-sky-400"
                        aria-label="表示するPDFページ番号"
                      />
                      <span className="text-[9px] text-white/30">ページを直接表示</span>
                    </div>
                  </div>
                )}

                {selectedMedia?.type === 'pdf' && onSetPdfPage && (
                  <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest">
                      <span className="text-white/50">ページ一覧</span>
                      <span className="text-sky-300 font-mono">
                        {pdfLoading ? '読込中…' : pdfPageCount ? `${pdfPageCount}ページ` : '未取得'}
                      </span>
                    </div>
                    {pdfError ? (
                      <p className="text-[9px] leading-relaxed text-amber-300/80">{pdfError}</p>
                    ) : pdfPageCount ? (
                      <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 max-h-32 overflow-y-auto pr-1">
                        {Array.from({ length: pdfPageCount }, (_, index) => {
                          const page = index + 1;
                          const active = page === selectedPdfPage;
                          return (
                            <button
                              key={page}
                              type="button"
                              onClick={() => onSetPdfPage(getPdfPageStateKey(selectedMedia), page)}
                              className={`rounded-md border px-1 py-1.5 text-[10px] font-mono font-bold transition-colors ${active ? 'border-sky-400 bg-sky-500/30 text-white' : 'border-white/10 bg-white/5 text-white/50 hover:border-sky-500/50 hover:text-sky-200'}`}
                              aria-label={`PDF ${page}ページを表示`}
                            >
                              P{page}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[9px] text-white/30">PDFを解析できた場合、ここにページ番号が表示されます。</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 lg:grid-cols-8">
                  {/* None Option */}
                  <button
                    onClick={() => {
                      const nextDraft = { ...draft, activeImageId: null };
                      setDraft(nextDraft);
                      onApplySync(nextDraft);
                    }}
                    className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all group relative overflow-hidden ${!draft.activeImageId ? 'bg-zinc-800 border-zinc-400 shadow-lg' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                  >
                    <Maximize2 size={16} className={!draft.activeImageId ? 'text-zinc-300' : 'text-white/20'} />
                    <span className={`text-[8px] font-bold font-cinzel ${!draft.activeImageId ? 'text-zinc-300' : 'text-white/20'}`}>なし</span>
                    {!draft.activeImageId && (
                      <div className="absolute top-1 right-1">
                        <Check size={10} className="text-emerald-400" />
                      </div>
                    )}
                  </button>

                  {availableMedia.map((media, idx) => {
                    const isSelected = draft.activeImageId !== null && String(draft.activeImageId) === String(media.id);
                    const itemConfig = draft.imageConfigs?.[media.id] || media;
                    const itemTimerColor = itemConfig.timerColor || 'white';
                    const itemOverlay = itemConfig.overlayType || 'black';

                    return (
                      <button
                        key={media.id}
                        onClick={() => {
                          const nextId = isSelected ? null : media.id;
                          let nextTimerColor = draft.timerColor;
                          let nextOverlayType = draft.overlayType;

                          if (nextId) {
                            const savedConfig = draft.imageConfigs?.[nextId] || media;
                            nextTimerColor = savedConfig.timerColor || draft.timerColor || 'white';
                            nextOverlayType = savedConfig.overlayType || draft.overlayType || 'black';
                          }

                          const nextDraft = { 
                            ...draft, 
                            activeImageId: nextId,
                            timerColor: nextTimerColor,
                            overlayType: nextOverlayType
                          };
                          setDraft(nextDraft);
                          onApplySync(nextDraft);
                        }}
                        className={`aspect-square rounded-xl border-2 overflow-hidden transition-all group relative ${isSelected ? 'border-sky-500 shadow-xl scale-95 shadow-sky-500/20' : 'border-white/10 hover:border-white/20'}`}
                      >
                        {/* Image Index & Key Shortcut Badge */}
                        <div className="absolute top-1 left-1 bg-black/85 backdrop-blur-md px-1 py-0.5 rounded text-[8px] font-mono font-black text-amber-300 border border-amber-500/40 shadow-md z-10 flex items-center gap-0.5">
                          <span>#{idx + 1}</span>
                          {idx < 9 && (
                            <span className="text-[7px] text-amber-400/90 font-mono font-bold bg-amber-500/20 px-0.5 rounded border border-amber-500/30">
                              K:{idx + 1}
                            </span>
                          )}
                        </div>

                        {/* Set Config Badge (Timer Color & Layer Overlay) */}
                        <div className="absolute bottom-1 right-1 bg-black/85 backdrop-blur-md px-1 py-0.5 rounded text-[7px] font-mono font-semibold text-cyan-300 border border-cyan-500/30 z-10 flex items-center gap-1">
                          <span className={itemTimerColor === 'black' ? 'text-zinc-400 font-bold' : 'text-white font-bold'}>
                            T:{itemTimerColor === 'black' ? '黒' : '白'}
                          </span>
                          <span className="text-white/20">|</span>
                          <span className={itemOverlay === 'white' ? 'text-white font-bold' : itemOverlay === 'black' ? 'text-zinc-400 font-bold' : 'text-zinc-500'}>
                            L:{itemOverlay === 'white' ? '白' : itemOverlay === 'black' ? '黒' : '無'}
                          </span>
                        </div>

                        {media.assetId ? (
                          <div className="w-full h-full bg-sky-950/50 flex flex-col items-center justify-center gap-1">
                            <FileText size={20} className="text-sky-300" />
                            <span className="text-[7px] font-mono text-sky-200">{media.pageCount || '?'} PAGES</span>
                          </div>
                        ) : media.url ? (
                          <img 
                            src={media.url} 
                            alt={media.name}
                            className={`w-full h-full object-cover transition-all ${isSelected ? 'opacity-100' : 'opacity-40 group-hover:opacity-60'}`}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                            <ImageIcon size={12} className="text-white/10" />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-black/80 p-1 opacity-0 group-hover:opacity-100 transition-all">
                          <p className="text-[7px] text-white font-medium truncate">{media.name}</p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-1 right-1 bg-sky-500 rounded-full p-0.5 z-10">
                            <Check size={8} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

                </div>

        {/* Footer Area with Apply button (Sleek Cyan Synced Panel) */}
        <div className="p-4 md:p-5 bg-[#031d24]/95 border-t border-cyan-500/30 shadow-[0_-4px_30px_rgba(6,182,212,0.15)] shrink-0 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 z-10 transition-all duration-300 w-full">
          <div className="flex-1 flex flex-col gap-1.5 justify-center">
            {quotaExceeded ? (
              <div className="flex flex-col gap-1.5 items-start">
                <div className="flex items-center gap-2 text-red-400 animate-pulse">
                   <X size={14} />
                   <span className="text-[10px] font-bold font-cinzel tracking-widest uppercase">
                     Firestore Quota Exceeded - Sync Paused
                   </span>
                </div>
                <a
                  href="https://console.firebase.google.com/project/gen-lang-client-0664666169/firestore/databases/ai-studio-1c8987be-d77f-408f-bc92-262abe57f70d/data?openUpgradeDialog=true"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] text-sky-400 hover:text-sky-300 hover:underline font-mono pl-5"
                >
                  Open Firebase Console ↗ (Upgrade Database)
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10.5px] font-cinzel uppercase tracking-[0.05em] leading-normal ${isDirty ? 'text-amber-400 font-bold animate-pulse' : 'text-cyan-400/70'}`}>
                    {isDirty ? '未適用の変更があります。「構成を同期」を押して反映してください。' : '適用するまでは同期ウィンドウには反映されません。'}
                  </span>
                  <div className={`px-1.5 py-0.5 rounded text-[6px] font-bold uppercase tracking-widest ${isDirty ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400'}`}>
                    {isDirty ? 'UNSAVED' : 'Sync Engine v2'}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex flex-row items-center gap-3 w-full md:w-auto justify-stretch md:justify-end">
            <button
              onClick={() => {
                if (window.confirm("現在すべての閲覧端末で表示されている同期ウィンドウを待機状態に戻しますか？\n(Firestore上のセッションデータが物理的に抹消されます)")) {
                  onResetSync();
                }
              }}
              className="flex-1 md:flex-initial px-5 py-3 md:py-3.5 rounded-xl bg-red-950/30 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all font-bold font-cinzel text-[10px] md:text-[11px] tracking-[0.15em] flex items-center justify-center gap-2 shrink-0"
              title="Invalidate all active sync windows"
            >
              <X size={15} /> RESET
            </button>
            
            <button
              onClick={handleApply}
              className={`flex-1 md:w-[220px] py-3 md:py-3.5 rounded-xl font-bold font-cinzel text-[10px] md:text-[11px] tracking-[0.15em] transition-all flex items-center justify-center gap-2.5 overflow-hidden group border-2 ${
                synced 
                  ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/40' 
                  : isDirty
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 border-amber-400 shadow-lg text-white hover:from-amber-500 hover:to-amber-400 shadow-amber-500/30 active:scale-95 animate-pulse'
                    : 'bg-gradient-to-r from-cyan-600 to-cyan-500 border-cyan-400 shadow-lg text-white hover:from-cyan-500 hover:to-cyan-400 shadow-cyan-500/20 active:scale-95'
              }`}
            >
              <div className="flex items-center gap-2 group-active:translate-y-10 transition-transform">
                {synced ? <Check size={16} /> : <Share size={16} />}
                {synced ? 'SYNCED' : isDirty ? '構成を強制同期' : '構成を同期'}
              </div>
            </button>
          </div>
        </div>

        {/* Mobile-only QR Code Popup Modal */}
        <AnimatePresence>
          {showQrModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQrModal(false)}
              className="fixed inset-0 z-[120000] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 15 }}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-zinc-950 border border-white/10 rounded-[28px] p-6 w-full max-w-[320px] shadow-2xl flex flex-col items-center gap-5 text-center"
              >
                <button
                  onClick={() => setShowQrModal(false)}
                  className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all"
                >
                  <X size={18} />
                </button>

                <div className="flex flex-col items-center gap-1.5 mt-2">
                  <h4 className="text-xs font-cinzel font-bold text-white tracking-widest uppercase">Sync QR Code</h4>
                  <p className="text-[8px] text-white/30 uppercase tracking-[0.2em] font-cinzel">閲覧端末でスキャンの上、同期してください。</p>
                </div>

                <div className="p-4 bg-white rounded-2xl shadow-xl flex items-center justify-center aspect-square w-full max-w-[180px] mx-auto shrink-0">
                  <QRCodeSVG
                    value={shareUrl}
                    size={150}
                    level="H"
                    fgColor="#000000"
                    className="w-full h-full"
                  />
                </div>

                <div className="w-full space-y-3">
                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-1.5 pl-3">
                    <span className="text-[8px] font-mono text-white/30 truncate flex-1 leading-none text-left">
                      {shareUrl}
                    </span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 9000);
                      }}
                      className={`p-2 rounded-lg transition-all shrink-0 ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40'}`}
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>

                  <button
                    onClick={() => { window.open(shareUrl, '_blank'); }}
                    className="w-full py-2.5 rounded-xl bg-sky-500 text-white font-bold font-cinzel text-[10px] tracking-[0.1em] flex items-center justify-center gap-2 hover:bg-sky-400 transition-all shadow-md active:scale-95"
                  >
                    <ExternalLink size={14} /> OPEN NEW TAB
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>,
    document.body
  );
};

export default SyncWindowModal;
