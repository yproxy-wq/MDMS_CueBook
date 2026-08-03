import React, { useState, useEffect, useCallback, useRef } from 'react';
import { syncService, TimerSyncData } from '../services/SyncService';
import { Clock, AlertTriangle, Loader2, Maximize2, RotateCcw, Video, FolderOpen, Film, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../lib/firebase';
import { audioService } from '../services/AudioService';
import { NetworkToast } from './NetworkToast';
import { transformDropboxUrl, getFallbackMediaUrl } from '../utils/mediaHelper';
import { parseSessionId } from '../utils/syncHelper';

interface TimerShareViewProps {
  sessionId: string;
  themeColor: string;
}

const saveLocalVideosMeta = (map: Record<string, { url: string; name: string }>) => {
  try {
    const uniqueMetas: { id: string; name: string; type: 'video' }[] = [];
    const seenNames = new Set<string>();

    Object.entries(map).forEach(([key, value]) => {
      if (key.startsWith('vid-')) {
        const cleanId = key;
        if (!seenNames.has(value.name.toLowerCase())) {
          uniqueMetas.push({
            id: cleanId,
            name: value.name,
            type: 'video'
          });
          seenNames.add(value.name.toLowerCase());
        }
      } else if (!key.includes('.')) {
        // Skip fuzzy keys without extension
      } else {
        const cleanId = `vid-${key.replace(/[^a-zA-Z0-9]/g, '-')}`;
        if (!seenNames.has(value.name.toLowerCase())) {
          uniqueMetas.push({
            id: cleanId,
            name: value.name,
            type: 'video'
          });
          seenNames.add(value.name.toLowerCase());
        }
      }
    });

    localStorage.setItem('cuebook_local_videos', JSON.stringify(uniqueMetas));
    window.dispatchEvent(new Event('storage'));

    // Broadcast to other windows/tabs
    try {
      const bc = new BroadcastChannel('cuebook_video_sync');
      bc.postMessage({ type: 'local_videos_updated' });
      bc.close();
    } catch {
      // Ignore if BroadcastChannel is not supported/allowed in the sandbox
    }
  } catch (e) {
    console.error('Failed to save local videos metadata to localStorage', e);
  }
};

const TimerShareView: React.FC<TimerShareViewProps> = ({ sessionId, themeColor }) => {
  const [data, setData] = useState<TimerSyncData | null>(null);
  const [loading, setLoading] = useState(true);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  const triggeredLaps = useRef<Set<number>>(new Set());
  const [activeLapHighlight, setActiveLapHighlight] = useState<number | null>(null);
  const [fallbackImageUrls, setFallbackImageUrls] = useState<Record<string, string>>({});

  const lapTimes = data?.lapTimes;

  // Re-evaluation function
  const reevaluateLaps = useCallback((currentSeconds: number) => {
    triggeredLaps.current.clear();
    
    if (currentSeconds <= 0) {
      setActiveLapHighlight(null);
      return;
    }

    let activeLap: number | null = null;
    if (lapTimes) {
      const sortedLaps = [...lapTimes].sort((a, b) => b - a);
      sortedLaps.forEach((lap) => {
        if (currentSeconds <= lap * 60) {
          triggeredLaps.current.add(lap);
          activeLap = lap;
        }
      });
    }

    const mode = data?.lapDisplayMode || 'overlay';
    if (mode === 'persistent' && activeLap !== null) {
      setActiveLapHighlight(activeLap);
    } else {
      setActiveLapHighlight(null);
    }
  }, [lapTimes, data?.lapDisplayMode]);

  // Re-evaluate on initial sync data load or sync updates
  useEffect(() => {
    if (data) {
      Promise.resolve().then(() => {
        reevaluateLaps(data.remainingSeconds);
      });
    }
  }, [data, reevaluateLaps]);

  const checkLapTriggers = useCallback((currentSeconds: number) => {
    if (!lapTimes) return;
    
    // Auto-clear active highlights when timer is 00:00
    if (currentSeconds <= 0) {
      setActiveLapHighlight(null);
      return;
    }

    lapTimes.forEach((lap) => {
      const lapSeconds = lap * 60;
      if (currentSeconds > 0 && currentSeconds <= lapSeconds && !triggeredLaps.current.has(lap)) {
        triggeredLaps.current.add(lap);
        
        // Play high-fidelity double-tone crystal chime on player side
        try {
          audioService.playLapChime();
        } catch (e) {
          console.warn('Player lap chime failed:', e);
        }
        
        const mode = data?.lapDisplayMode || 'overlay';
        if (mode !== 'hidden') {
          setActiveLapHighlight(lap);
          
          if (mode === 'overlay') {
            // Display beautiful broadcast overlay for 8 seconds
            setTimeout(() => {
              setActiveLapHighlight(prev => prev === lap ? null : prev);
            }, 8000);
          }
        }
      }
    });
  }, [lapTimes, data?.lapDisplayMode]);

  useEffect(() => {
    return auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
  }, []);

  const session = parseSessionId(sessionId);
  const isOwnerOrAdmin = !!(
    currentUser
    && ((session.isSecure && session.userId === currentUser.uid) || currentUser.email === "yproxy@gmail.com")
  );

  // Local Video Registry to avoid Firestore 1MB limits
  const [localVideoMap, setLocalVideoMap] = useState<Record<string, { url: string; name: string }>>({});
  const [showMapPanel, setShowMapPanel] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const dataRef = useRef<TimerSyncData | null>(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const lastKnownVideoTimeRef = useRef(0);
  const lastKnownSystemTimeRef = useRef(0);
  const lastReportTimeRef = useRef(0);
  const isApplyingSyncRef = useRef(false);
  const syncAppliedTimeRef = useRef(0);

  const queryParams = new URLSearchParams(window.location.search);
  const syncTimerEnabled = data ? ((data.syncTimerEnabled ?? true) && !data.timerForceHidden) : (queryParams.get('syncTimer') !== 'false');
  const syncContentEnabled = data ? (data.syncContentEnabled ?? true) : (queryParams.get('syncContent') !== 'false');

  const getActiveVideoSrc = useCallback(() => {
    if (!data) return '';
    const idKey = data.activeImageId ? String(data.activeImageId).toLowerCase() : '';
    const nameKey = data.activeImageName ? String(data.activeImageName).toLowerCase() : '';
    
    if (idKey && localVideoMap[idKey]) {
      return localVideoMap[idKey].url;
    }
    if (nameKey && localVideoMap[nameKey]) {
      return localVideoMap[nameKey].url;
    }
    
    // Check if filename without extension is registered
    const cleanNameKey = nameKey.replace(/\.[^/.]+$/, "");
    if (cleanNameKey && localVideoMap[cleanNameKey]) {
      return localVideoMap[cleanNameKey].url;
    }

    return data.activeImageUrl || '';
  }, [data, localVideoMap]);

  const processFiles = useCallback((files: FileList) => {
    const newMappings: Record<string, { url: string; name: string }> = {};
    Array.from(files).forEach(file => {
      if (file.type.startsWith('video/')) {
        const url = URL.createObjectURL(file);
        const nameLower = file.name.toLowerCase();
        
        // Map exact filename
        newMappings[nameLower] = { url, name: file.name };
        
        // Map filename without extension for fuzzy matching
        const cleanName = file.name.replace(/\.[^/.]+$/, "").toLowerCase();
        newMappings[cleanName] = { url, name: file.name };
        
        // If there's an active video matching this name, map that ID too
        if (dataRef.current && dataRef.current.activeResourceType === 'video' && dataRef.current.activeImageName) {
          if (dataRef.current.activeImageName.toLowerCase() === nameLower || 
              dataRef.current.activeImageName.replace(/\.[^/.]+$/, "").toLowerCase() === cleanName) {
            if (dataRef.current.activeImageId) {
              newMappings[dataRef.current.activeImageId.toLowerCase()] = { url, name: file.name };
            }
          }
        }
      }
    });

    setLocalVideoMap(prev => {
      const next = {
        ...prev,
        ...newMappings
      };
      saveLocalVideosMeta(next);
      return next;
    });
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleClearMap = () => {
    Object.values(localVideoMap).forEach(item => {
      try {
        URL.revokeObjectURL(item.url);
      } catch (e) {
        console.error(e);
      }
    });
    setLocalVideoMap({});
    localStorage.removeItem('cuebook_local_videos');
    window.dispatchEvent(new Event('storage'));
  };

  useEffect(() => {
    let unsubscribe: () => void;
    
    const setupListener = () => {
      unsubscribe = syncService.subscribeToTimer(sessionId, (update) => {
        setData(update);

        if (!update) {
          setDisplaySeconds(0);
          setLoading(false);
          return;
        }
        
        if (update.isRunning && update.startTime) {
          const now = Date.now();
          const elapsed = (now - update.startTime) / 1000;
          const remains = Math.max(0, update.remainingSeconds - elapsed);
          setDisplaySeconds(Math.ceil(remains));
        } else {
          setDisplaySeconds(update.remainingSeconds);
        }
        
        setLoading(false);
      });
    };

    setupListener();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [sessionId]);

  // Sync PLAY/PAUSE/SEEK changes from Firestore to HTML5 <video> Element
  useEffect(() => {
    const video = document.getElementById('sync-video-player') as HTMLVideoElement | null;
    if (!video || !data || data.activeResourceType !== 'video') return;

    const wasPaused = video.paused;
    const targetPlaying = !!data.videoPlaying;
    const targetProgress = data.videoProgress || 0;
    const diff = Math.abs(video.currentTime - targetProgress);

    // targetPlaying (desired play state) equals wasPaused (current paused state) means the state is changing
    // (e.g. targetPlaying is true but video is currently paused, or targetPlaying is false but video is currently playing)
    const isPlayStateChanging = targetPlaying === wasPaused;
    const isSeekingChanging = diff > 1.5;

    if (isPlayStateChanging || isSeekingChanging) {
      isApplyingSyncRef.current = true;
      syncAppliedTimeRef.current = Date.now();
    }

    if (targetPlaying) {
      if (video.paused) {
        video.play()
          .then(() => {
            lastKnownVideoTimeRef.current = video.currentTime;
            lastKnownSystemTimeRef.current = Date.now();
          })
          .catch(e => console.log("Video auto-play blocked or failed:", e));
      }
    } else {
      if (!video.paused) {
        video.pause();
        lastKnownVideoTimeRef.current = video.currentTime;
        lastKnownSystemTimeRef.current = Date.now();
      }
    }

    if (diff > 1.5) {
      video.currentTime = targetProgress;
      lastKnownVideoTimeRef.current = targetProgress;
      lastKnownSystemTimeRef.current = Date.now();
    }

    if (isPlayStateChanging || isSeekingChanging) {
      const timer = setTimeout(() => {
        isApplyingSyncRef.current = false;
        lastKnownSystemTimeRef.current = Date.now();
        lastKnownVideoTimeRef.current = video.currentTime;
      }, 800);
      return () => clearTimeout(timer);
    } else {
      isApplyingSyncRef.current = false;
    }
  }, [data]);

  // Report video metadata (Duration and Progress) back to Firestore
  useEffect(() => {
    const video = document.getElementById('sync-video-player') as HTMLVideoElement | null;
    if (!video || !dataRef.current || dataRef.current.activeResourceType !== 'video' || !isOwnerOrAdmin) return;

    const handleLoadedMetadata = () => {
      const currentData = dataRef.current;
      if (!currentData) return;
      if (!video.duration || isNaN(video.duration)) return;
      const roundedDuration = Math.round(video.duration);
      if (currentData.videoDuration !== roundedDuration) {
        syncService.setTimerInstant(sessionId, {
          ...currentData,
          videoDuration: roundedDuration
        }).catch(err => console.error("Failed to report video duration:", err));
      }
    };

    const handleTimeUpdate = () => {
      const currentData = dataRef.current;
      if (!currentData) return;

      // Skip processing and updating tracking refs if we are applying a Firestore update
      if (isApplyingSyncRef.current || (Date.now() - syncAppliedTimeRef.current < 1500)) {
        lastKnownVideoTimeRef.current = video.currentTime;
        lastKnownSystemTimeRef.current = Date.now();
        return;
      }

      const now = Date.now();
      const currentVideoTime = video.currentTime;
      
      // Calculate how much real time has passed since our last check
      const elapsedRealTime = (now - lastKnownSystemTimeRef.current) / 1000;
      // Calculate how much video time should have passed (assuming playback speed is 1.0)
      const expectedVideoTime = lastKnownVideoTimeRef.current + (video.paused ? 0 : elapsedRealTime);
      
      // Update local tracking references for the next tick
      lastKnownVideoTimeRef.current = currentVideoTime;
      lastKnownSystemTimeRef.current = now;

      // Only report if there is a deliberate seek (discrepancy > 2.0s between real-time elapsed and play elapsed)
      const isSeeking = Math.abs(currentVideoTime - expectedVideoTime) > 2.0;

      if (isSeeking && (now - lastReportTimeRef.current > 2000)) {
        lastReportTimeRef.current = now;
        const roundedTime = Math.round(currentVideoTime * 10) / 10;
        syncService.setTimerInstant(sessionId, {
          ...currentData,
          videoProgress: roundedTime
        }).catch(err => console.error("Failed to report video progress (seek):", err));
      }
    };

    const handleEnded = () => {
      const currentData = dataRef.current;
      if (!currentData) return;
      syncService.setTimerInstant(sessionId, {
        ...currentData,
        videoPlaying: false,
        videoProgress: 0
      }).catch(err => console.error("Failed to report video ended state:", err));
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    if (video.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [sessionId, isOwnerOrAdmin]);

  const handleForceSync = async () => {
    if (syncing) return;
    setSyncing(true);
    
    try {
      if (currentUser && isOwnerOrAdmin) {
        // If we are logged in as GM, we can indeed force write the state
        if (data) {
          await syncService.setTimerInstant(sessionId, data);
        }
      } else {
        // If we are NOT logged in or not the owner, we can only force a listener reset (re-pull)
        // This helps if the WebSocket is stale
        window.location.reload();
      }
      setTimeout(() => setSyncing(false), 1000);
    } catch (error) {
      console.warn("Force sync attempt finished", error);
      setSyncing(false);
    }
  };

  // Local tick for smooth display
  useEffect(() => {
    if (!data || !data.isRunning) {
      if (data && data.remainingSeconds <= 0) {
        Promise.resolve().then(() => {
          setActiveLapHighlight(null);
        });
      }
      return;
    }

    const update = () => {
      if (data && data.startTime) {
        const elapsed = (Date.now() - data.startTime) / 1000;
        const remains = Math.max(0, data.remainingSeconds - elapsed);
        
        checkLapTriggers(remains);
        
        if (remains <= 0) {
          setActiveLapHighlight(null);
        }
        
        setDisplaySeconds(Math.ceil(remains));
      } else if (data) {
        setDisplaySeconds(data.remainingSeconds);
        if (data.remainingSeconds <= 0) {
          setActiveLapHighlight(null);
        }
      }
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [data, checkLapTriggers]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(Math.max(0, seconds) / 60);
    const s = Math.floor(Math.max(0, seconds) % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#050505] text-white">
        <Loader2 className="animate-spin mb-4" size={48} style={{ color: themeColor }} />
        <p className="font-cinzel tracking-[0.3em] text-white/40">Connecting to Sync Channel...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#050505] text-white p-8">
        <AlertTriangle size={48} className="text-amber-500 mb-4" />
        <h1 className="text-2xl font-cinzel font-bold mb-2">Sync Session Not Found</h1>
        <p className="text-white/40 text-center">The session may have expired or the link is incorrect.</p>
      </div>
    );
  }

  const videoSrc = getActiveVideoSrc();
  const isVideoMissing = data.activeResourceType === 'video' && !videoSrc;
  const hasImage = !!data.activeImageUrl || (data.activeResourceType === 'video' && !!videoSrc);
  const timerSize = data.timerSize || 'small';
  const timerPosition = data.timerPosition || 'bottom';

  const getSizeClasses = () => {
    const isOverlay = syncContentEnabled && hasImage;
    if (timerSize === 'large') {
      return isOverlay ? 'text-8xl md:text-[12rem]' : 'text-[30vw] md:text-[35vw]';
    }
    if (timerSize === 'medium') {
      return isOverlay ? 'text-7xl md:text-[10rem]' : 'text-[25vw] md:text-[30vw]';
    }
    // Small (default)
    return isOverlay ? 'text-5xl md:text-8xl' : 'text-[20vw] md:text-[25vw]';
  };

  const getLapBandSizeClass = (mode: 'overlay' | 'persistent', size?: 'small' | 'medium' | 'large') => {
    if (mode === 'overlay') {
      if (size === 'small') return 'px-4 py-2 md:px-6 md:py-2.5';
      if (size === 'large') return 'px-12 py-5 md:px-16 md:py-7 lg:px-20 lg:py-9';
      return 'px-6 py-3 md:px-10 md:py-4 lg:px-14 lg:py-5'; // medium
    } else {
      if (size === 'small') return 'py-1.5 md:py-2';
      if (size === 'large') return 'py-6 md:py-10 lg:py-12';
      return 'py-3 md:py-5 lg:py-7'; // medium
    }
  };

  const getLapFontSizeClass = (size?: 'small' | 'medium' | 'large') => {
    if (size === 'small') return 'text-xs sm:text-sm md:text-lg lg:text-xl';
    if (size === 'large') return 'text-xl sm:text-3xl md:text-5xl lg:text-6xl';
    return 'text-sm sm:text-xl md:text-3xl lg:text-4xl'; // medium
  };

  const urgentShakeEnabled = data.urgentShakeEnabled ?? true;

  const isUrgent = data.isRunning && displaySeconds <= 60 && displaySeconds > 0;
  const isCritical = data.isRunning && displaySeconds < 30 && displaySeconds > 0;
  
  const shakeIntensity = (isUrgent && urgentShakeEnabled)
    ? Math.max(0, Math.min(6, (60 - displaySeconds) / 10))
    : 0;

  const urgencyDuration = isUrgent
    ? `${Math.max(0.12, 0.12 + (displaySeconds / 60) * 1.38)}s`
    : '1s';

  const animationName = isCritical ? 'critical-pulse' : 'urgency-pulse';

  const animationValue = isUrgent
    ? (urgentShakeEnabled
        ? `${animationName} var(--urgency-duration) infinite ease-in-out, urgency-shake var(--urgency-duration) infinite ease-in-out`
        : `${animationName} var(--urgency-duration) infinite ease-in-out`)
    : undefined;

  const urgencyStyle = isUrgent ? {
    display: 'inline-block',
    animation: animationValue,
    '--urgency-duration': urgencyDuration,
    '--shake-intensity': `${shakeIntensity}px`
  } as React.CSSProperties : {};

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="h-screen w-screen flex flex-col items-center justify-center bg-[#050505] text-white p-4 overflow-hidden relative select-none"
    >
      <NetworkToast />
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        {/* Toggle Local Video mapping drawer */}
        <button
          onClick={() => setShowMapPanel(prev => !prev)}
          className={`p-2 rounded-full backdrop-blur-md border transition-all ${
            showMapPanel 
              ? 'bg-purple-600 border-purple-400 text-white' 
              : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
          }`}
          title="ローカル動画マッピングパネル"
        >
          <Video size={20} />
        </button>

        <button
          onClick={handleForceSync}
          className={`p-2 rounded-full backdrop-blur-md border transition-all ${
            syncing 
              ? 'bg-emerald-500 border-emerald-400 text-white' 
              : 'bg-white/5 border-white/10 text-white/40 hover:text-white hover:bg-white/10'
          }`}
          title={isOwnerOrAdmin ? "Force Re-sync State (GM)" : "Force Refresh (Player)"}
        >
          <RotateCcw size={20} className={syncing ? 'rotate-[-180deg] transition-transform duration-500' : ''} />
        </button>
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen().catch(err => console.error(err));
            } else {
              document.exitFullscreen();
            }
          }}
          className="p-2 text-white/20 hover:text-white transition-colors bg-white/5 backdrop-blur-md border border-white/10 rounded-full"
        >
          <Maximize2 size={24} />
        </button>
      </div>

      {/* Slide-out Local Video Mapper Panel */}
      <AnimatePresence>
        {showMapPanel && (
          <motion.div
            initial={{ opacity: 0, x: 100, y: -20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 100, y: -20 }}
            className="absolute top-16 right-4 w-80 bg-[#0c0c0e]/95 border border-white/10 rounded-2xl p-4 z-50 shadow-2xl backdrop-blur-lg flex flex-col gap-3 max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold font-cinzel text-purple-400 uppercase tracking-widest flex items-center gap-2">
                <Video size={14} /> Local Video Sync
              </span>
              <button 
                onClick={handleClearMap}
                className="text-[10px] text-white/40 hover:text-red-400 flex items-center gap-1 transition-colors"
                title="すべてのマッピングを解除してメモリ解放"
              >
                <Trash2 size={12} /> Clear All
              </button>
            </div>
            
            <p className="text-[10px] text-white/50 leading-relaxed">
              ギガバイト単位の大容量動画でも、ここにあらかじめ登録しておくことでFirestoreの容量制限（1MB）を超えずに1080pや4K動画を同期再生できます。
            </p>

            <div className="border border-dashed border-white/10 rounded-xl p-3 flex flex-col items-center justify-center bg-white/5 hover:bg-white/10 transition-colors">
              <label className="flex items-center gap-1 text-xs text-white/60 hover:text-white cursor-pointer py-1 font-bold">
                <FolderOpen size={14} className="text-purple-400" />
                <span>動画をロード</span>
                <input 
                  type="file" 
                  accept="video/*" 
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      processFiles(e.target.files);
                    }
                  }} 
                  className="hidden" 
                />
              </label>
              <span className="text-[9px] text-white/30 text-center mt-1">
                複数ファイルを選択可能（ドラッグ＆ドロップ可）
              </span>
            </div>

            {/* List of registered local films */}
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                登録済みリスト ({Object.keys(localVideoMap).filter(k => !k.startsWith('vid-')).length})
              </span>
              
              {Object.keys(localVideoMap).length === 0 ? (
                <div className="text-[10px] text-white/30 text-center py-4 bg-white/5 rounded-lg font-mono">
                  No files mapped yet.
                </div>
              ) : (
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                  {Object.entries(localVideoMap)
                    .filter(([key]) => {
                      // Avoid listing duplicates mapped under both lowercase filename and ID
                      return !key.startsWith('vid-');
                    })
                    .map(([key, value]) => {
                      const isActive = data && data.activeResourceType === 'video' && 
                        (data.activeImageId?.toLowerCase() === key || data.activeImageName?.toLowerCase() === key);
                      
                      return (
                        <div 
                          key={key} 
                          className={`p-2 rounded-lg text-xs flex items-center justify-between border ${
                            isActive ? 'bg-purple-950/40 border-purple-500/40' : 'bg-white/5 border-white/5'
                          }`}
                        >
                          <div className="flex flex-col truncate pr-2">
                            <span className="truncate text-white/80 font-mono font-medium text-[11px]">{value.name}</span>
                            <span className="text-[8px] text-white/40 truncate">
                              {isActive ? '● PLAYING / SYNCED' : 'READY'}
                            </span>
                          </div>
                          
                          <button
                            onClick={() => {
                              setLocalVideoMap(prev => {
                                const next = { ...prev };
                                delete next[key];
                                const cleanKey = key.replace(/\.[^/.]+$/, "");
                                if (next[cleanKey]) delete next[cleanKey];
                                saveLocalVideosMeta(next);
                                return next;
                              });
                            }}
                            className="text-white/30 hover:text-red-400 p-1"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Beautiful drag-and-drop overlay indicator */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-purple-950/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center border-4 border-dashed border-purple-500 m-4 rounded-2xl pointer-events-none"
          >
            <Film size={64} className="text-purple-400 mb-4 animate-bounce" />
            <h1 className="text-3xl font-cinzel font-bold tracking-widest text-white mb-2">DROP VIDEOS HERE</h1>
            <p className="text-white/60 text-sm">動画ファイルをここにドロップしてローカルシンクに登録</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Glow (when no image) */}
      {!hasImage && (
        <div 
          className="absolute inset-0 opacity-10 blur-[120px] pointer-events-none transition-all duration-1000"
          style={{ backgroundColor: themeColor }}
        />
      )}

      {/* Sync Image/PDF Display */}
      {syncContentEnabled && (
        <div className="absolute inset-0 z-0 bg-black">
          <AnimatePresence mode="popLayout">
            {(data.activeImageUrl || isVideoMissing || (data.activeResourceType === 'video' && videoSrc)) ? (
                <motion.div
                  key={data.activeImageUrl || (videoSrc ? 'video-active' : 'video-missing')}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className={`absolute inset-0 flex bg-black scrollbar-hide ${
                    data.imageFit === 'width' ? 'overflow-y-auto items-start justify-center pt-0' : 
                    data.imageFit === 'height' ? 'overflow-x-auto items-center justify-start pl-0' : 
                    'overflow-hidden items-center justify-center'
                  }`}
                >
                  <style>{`
                    .scrollbar-hide::-webkit-scrollbar { display: none; }
                    .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                  `}</style>
                  {data.activeResourceType === 'pdf' ? (
                    <div className="w-full h-full relative bg-neutral-900">
                      <iframe 
                        src={data.activeImageUrl?.startsWith('data:') 
                          ? `${data.activeImageUrl}#navpanes=0&view=FitH&page=${data.pdfPage || 1}` 
                          : `https://docs.google.com/viewer?url=${encodeURIComponent(data.activeImageUrl || '')}&embedded=true`} 
                        className="w-full h-full border-none"
                        title="Sync PDF Viewer"
                        key={`${data.activeImageUrl}-${data.pdfPage || 1}`}
                      />
                    </div>
                  ) : data.activeResourceType === 'video' ? (
                    isVideoMissing ? (
                      <div className="w-full h-full relative bg-[#0a0a0c] flex flex-col items-center justify-center p-8 border-2 border-dashed border-red-500/20 rounded-2xl m-4 max-w-4xl max-h-[80vh] transition-colors hover:border-red-500/40">
                        <Film size={48} className="text-red-400 mb-4 animate-pulse" />
                        <h2 className="text-xl font-bold text-white mb-2 font-cinzel tracking-wider">ローカル動画の登録が必要です</h2>
                        <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-lg font-mono text-xs text-red-300 max-w-md text-center mb-6">
                          {data.activeImageName || '動画リソース'}
                        </div>
                        <p className="text-sm text-white/50 text-center max-w-md mb-6 leading-relaxed">
                          GMが指定した動画の同期再生を開始します。ファイルはサーバーへ送信されず、完全にローカル（あなたのPC）で高速に再生されます。
                        </p>
                        
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                          <label className="flex items-center gap-2 bg-red-600/80 hover:bg-red-600 text-white px-6 py-3 rounded-full text-sm font-bold cursor-pointer transition-all active:scale-95">
                            <FolderOpen size={16} />
                            <span>ローカル動画を選択</span>
                            <input 
                              type="file" 
                              accept="video/*" 
                              onChange={(e) => {
                                if (e.target.files) {
                                  processFiles(e.target.files);
                                }
                              }} 
                              className="hidden" 
                            />
                          </label>
                          <span className="text-xs text-white/30">または、ファイルをここにドラッグ＆ドロップ</span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full relative bg-[#050505] flex items-center justify-center">
                        <video 
                          id="sync-video-player"
                          src={videoSrc}
                          className={`${
                            data.imageFit === 'width' ? 'w-full h-auto' : 
                            data.imageFit === 'height' ? 'h-full w-auto' : 
                            data.imageFit === 'contain' ? 'w-full h-full object-contain' :
                            'w-full h-full object-cover'
                          }`}
                          style={{ outline: 'none' }}
                          preload="auto"
                          playsInline
                          muted
                        />
                      </div>
                    )
                  ) : (
                    (() => {
                      const rawUrl = data.activeImageUrl || '';
                      const transformed = transformDropboxUrl(rawUrl);
                      const displayUrl = fallbackImageUrls[rawUrl] || transformed;

                      return (
                        <img 
                          src={displayUrl} 
                          alt="Sync View"
                          className={`${
                            data.imageFit === 'width' ? 'w-full h-auto' : 
                            data.imageFit === 'height' ? 'h-full w-auto' : 
                            data.imageFit === 'contain' ? 'w-full h-full object-contain' :
                            'w-full h-full object-cover'
                          }`}
                          referrerPolicy="no-referrer"
                          onError={() => {
                            if (rawUrl && !fallbackImageUrls[rawUrl]) {
                              const fallback = getFallbackMediaUrl(displayUrl);
                              if (fallback && fallback !== displayUrl) {
                                console.warn('[TimerShareView] Image failed to load, trying fallback:', fallback);
                                setFallbackImageUrls(prev => ({ ...prev, [rawUrl]: fallback }));
                              }
                            }
                          }}
                        />
                      );
                    })()
                  )}
                </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black"
              >
                {/* No content display */}
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Dark overlay for timer readability if needed */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60 pointer-events-none z-10" />
          
          {/* Custom Overlay */}
          {data.overlayType && data.overlayType !== 'none' && (
            <div 
              className="absolute inset-0 z-20 pointer-events-none w-full h-full" 
              style={{ 
                backgroundColor: data.overlayType === 'black' ? 'black' : 'white',
                opacity: data.overlayIntensity ?? 0.5 
              }} 
            />
          )}
        </div>
      )}

      {syncTimerEnabled && (
        <div className={`z-10 flex flex-col items-center w-full max-w-7xl transition-all duration-700 ${
          syncContentEnabled && hasImage 
            ? `${timerPosition === 'top' ? 'mb-auto mt-8' : 'mt-auto mb-8'} scale-75 md:scale-100` 
            : 'gap-8'
        }`}>
          {!hasImage && (
            <div className={`flex flex-col items-center gap-2 ${timerSize === 'large' ? 'scale-150 mb-8' : timerSize === 'medium' ? 'scale-125 mb-4' : ''}`}>
              <span className="text-[12px] font-bold font-cinzel text-white/20 uppercase tracking-[0.5em] flex items-center gap-2">
                <Clock size={14} /> {data.timerLabelText || data.label || 'ACTIVE TIMER'}
              </span>
              <div className="h-px w-24 bg-white/10" />
            </div>
          )}

          <div className="relative flex flex-col items-center justify-center">
            {/* Status badge placed clearly above or inside without blocking the timer digits */}
            {!data.isRunning && (
              <div className="mb-2 transition-all">
                <span className={`px-4 py-1 border rounded-full text-[10px] font-black font-cinzel uppercase tracking-[0.3em] backdrop-blur-md whitespace-nowrap shadow-lg ${
                  displaySeconds <= 0 
                    ? 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse' 
                    : 'bg-white/10 border-white/20 text-white/70'
                }`}>
                  {displaySeconds <= 0 ? 'TIME UP' : 'PAUSED'}
                </span>
              </div>
            )}

            <span 
              className={`font-mono font-black tabular-nums leading-none tracking-tighter transition-all duration-300 ${getSizeClasses()} ${
                displaySeconds <= 0
                  ? 'text-red-500 font-extrabold'
                  : data.isRunning 
                    ? (isUrgent ? 'text-red-500' : (data.timerColor === 'black' ? 'text-black' : 'text-white'))
                    : (data.timerColor === 'black' ? 'text-black/70' : 'text-white/80')
              }`}
              style={{ 
                textShadow: displaySeconds <= 0
                  ? '0 0 25px rgba(239, 68, 68, 0.8)'
                  : data.isRunning 
                    ? (isUrgent 
                        ? '0 0 30px rgba(239, 68, 68, 0.6)' 
                        : (data.timerColor === 'black' 
                            ? '0 0 15px rgba(255, 255, 255, 0.8), 0 0 30px rgba(255, 255, 255, 0.4)'
                            : `0 0 ${syncContentEnabled && hasImage ? '20px' : '40px'} ${themeColor}66`))
                    : 'none',
                ...urgencyStyle
              }}
            >
              {formatTime(Math.max(0, displaySeconds))}
            </span>
          </div>

          {syncContentEnabled && hasImage && (data.timerLabelText || data.label) && (
             <div className="mt-4 flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: themeColor }} />
               <span className="text-[10px] font-bold font-cinzel text-white/40 uppercase tracking-[0.4em]">{data.timerLabelText || data.label}</span>
             </div>
          )}

          {(!syncContentEnabled || !hasImage) && (
            <div className="flex flex-col items-center gap-1 opacity-40">
               <span className="text-[10px] font-bold font-cinzel uppercase tracking-widest">Scenario ID</span>
               <span className="text-[10px] font-mono">{data.scenarioId}</span>
            </div>
          )}
        </div>
      )}

      {/* Dynamic Lap Banner/Overlay Layer */}
      <AnimatePresence>
        {activeLapHighlight !== null && (data.lapDisplayMode || 'overlay') === 'overlay' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: (data.lapDisplayPosition || 'top') === 'top' ? -20 : 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: (data.lapDisplayPosition || 'top') === 'top' ? -20 : 20 }}
            className={`absolute left-1/2 -translate-x-1/2 ${getLapBandSizeClass('overlay', data.lapBandSize)} bg-gradient-to-r from-pink-600 to-rose-600 text-white ${getLapFontSizeClass(data.lapFontSize)} font-black tracking-[0.25em] uppercase rounded-full shadow-[0_0_30px_rgba(236,72,153,0.5)] border border-pink-400/50 flex items-center justify-center text-center gap-2 font-mono whitespace-nowrap z-[600] max-w-[90vw] ${
              (data.lapDisplayPosition || 'top') === 'top' ? 'top-16 md:top-20' : 'bottom-16 md:bottom-20'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
            <span className="truncate text-center">
              {(() => {
                const individualText = activeLapHighlight !== null ? data?.lapTexts?.[activeLapHighlight] : null;
                if (individualText) return individualText;
                return data?.lapNotificationText ? data.lapNotificationText : `LAP REACHED: 残り ${activeLapHighlight} 分`;
              })()}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeLapHighlight !== null && data.lapDisplayMode === 'persistent' && (
          <motion.div
            initial={{ opacity: 0, y: (data.lapDisplayPosition || 'top') === 'top' ? -40 : 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: (data.lapDisplayPosition || 'top') === 'top' ? -40 : 40 }}
            className={`absolute left-0 right-0 ${getLapBandSizeClass('persistent', data.lapBandSize)} bg-black/85 backdrop-blur-md border-pink-500/20 text-center font-mono ${getLapFontSizeClass(data.lapFontSize)} font-black tracking-[0.3em] text-pink-400 flex items-center justify-center text-center gap-2 z-[500] border-t border-b ${
              (data.lapDisplayPosition || 'top') === 'top' ? 'top-0 border-t-0 border-b' : 'bottom-0 border-b-0 border-t'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-pink-500 shadow-[0_0_10px_#ec4899] animate-pulse shrink-0" />
            <span className="text-center">
              {(() => {
                const individualText = activeLapHighlight !== null ? data?.lapTexts?.[activeLapHighlight] : null;
                if (individualText) return individualText;
                return data?.lapNotificationText ? data.lapNotificationText : `LAP BANNER: 残り ${activeLapHighlight} 分経過`;
              })()}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimerShareView;
