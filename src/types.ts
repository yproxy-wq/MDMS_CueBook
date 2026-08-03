
/**
 * ============================================================================
 * CUEBOOK CORE DATA STRUCTURES (IMMUTABLE)
 * ============================================================================
 * 以下のデータ構造は、既存ユーザーの設定ファイル（JSON）との互換性を維持するため、
 * 破壊的な変更（フィールドの削除や名前の変更）は厳禁です。
 * 拡張が必要な場合は、オプショナルなフィールド（?）を追加してください。
 * ============================================================================
 */

export enum SoundType {
  BGM = 'BGM',
  SE = 'SE'
}

export interface SoundConfig {
  id: string;
  name: string;
  url: string; 
  type: SoundType;
  chokeGroup?: string;
  color?: string; 
  fadeInDuration?: number;
  fadeOutDuration?: number;
  fadeInEnabled?: boolean;  
  fadeOutEnabled?: boolean; 
  loopEnabled?: boolean;    
  description?: string;
  volume?: number; 
  
  startTime?: number; 
  endTime?: number;
  loopStart?: number;
  loopEnd?: number;
  
  /** 
   * 再生トリガーモード:
   * - tap: 1回押しでON/OFF
   * - hold: 押している間だけ再生
   * - toggle: BGM等の切り替え特化（現在の挙動に近い）
   */
  triggerMode?: 'tap' | 'hold' | 'toggle';
}

export interface SoundCluster {
  id: string;
  name: string;
  phaseId?: string;
  soundIds: string[];
  volumes?: Record<string, number>;
  color?: string;
  description?: string;
}

export interface TimerConfig {
  id: string;
  label: string;
  durationMinutes: number;
  lapTimes?: number[];
  lapNotificationText?: string;
  lapTexts?: Record<number, string>; // 各ラップタイムに対応するPL向け個別表示テキスト
}

export enum CharacterType {
  PC = 'PC',
  NPC = 'NPC'
}

export interface Character {
  id: string;
  name: string;
  role: CharacterType;
  comment: string;
  color?: string;
  tokens: number;
  flags: boolean[]; 
  playerName?: string;
  secretHandout?: string; // 個別配布情報
  handoutHistory?: string[]; // 送信履歴
  /** 個別ハンドアウト公開用のランダム capability ID。シナリオ所有者だけが保持する。 */
  handoutShareId?: string;
}

export interface Performance {
  id: string;
  scenarioId: string;
  scenarioTitle: string;
  date: string;
  venue: string;
  cast: {
    characterId: string;
    characterName: string;
    playerName: string;
  }[];
  timestamp: number;
  phaseResults?: Record<string, number>;
  phases?: Phase[];
}

export interface ScriptBlock {
  id: string;
  type: 'markdown' | 'outline' | 'pdf' | 'image';
  content: string;
  label?: string;
}

export interface ImageResource {
  id: string;
  name: string;
  url: string;
  updatedAt: number;
  type?: 'image' | 'pdf' | 'video';
  duration?: number;
  timerColor?: 'black' | 'white';
  overlayType?: 'black' | 'white' | 'none';
}

export type MediaResource = ImageResource;
export type MediaItem = ImageResource;

export interface Phase {
  id: string;
  name: string;
  /** @deprecated 旧形式のフェーズ名。読込互換性のため残す。 */
  title?: string;
  description: string;
  /** @deprecated 互換性維持のため残していますが、現在は scriptBlocks を推奨 */
  script: string; 
  scriptBlocks?: ScriptBlock[]; // ブロック形式
  checklists: string[];
  checklistResults?: boolean[]; 
  isCompleted?: boolean; 
  timers: TimerConfig[];
  onEnterSoundId?: string;
  recommendedSounds: string[];
  targetDurationMinutes?: number; 
  bufferDurationMinutes?: number; 
  tokenDistribution?: Record<string, number>; 
  isLockedByPrevious?: boolean; 
  themeColor?: string; 
  timeMinutes?: number;
}

export interface ScenarioSnapshot {
  id: string; // uuid
  label: string;
  timestamp: number;
  scenarioData: Scenario; // スナップショット時点のシナリオ全体
}

export interface KeyboardShortcuts {
  bgmPlayPause: string;
  sePlay: string;
  syncImageNext: string;
  syncImagePrev: string;
  timerStartPause: string;
  syncItemNext?: string;
  syncItemPrev?: string;
  nextSyncImage?: string;
  toggleSyncWindow?: string;
  toggleTimer?: string;
  resetTimer?: string;
  toggleBgm?: string;
  playSe?: string;
  nextPhase?: string;
  prevPhase?: string;
}

export type CustomShortcuts = KeyboardShortcuts;

export interface Scenario {
  id: string;
  title: string;
  author: string;
  backgroundImage?: string;
  themeColor?: string;
  subThemeColor?: string;
  checklistPosition?: 'top' | 'bottom' | 'both'; 
  masterVolumePosition?: 'top' | 'right-center' | 'right-bottom'; 
  editorToolbarPosition?: 'left' | 'right' | 'bottom';
  columnLayoutMode?: '1-column' | '2-column' | '3-column' | 'auto';
  layoutPreset?: 'auto' | 'pc' | 'tablet' | 'mobile' | 'manual';
  uiScaleMode?: 'small' | 'medium' | 'large';
  popupTimerPosition?: 'top-right' | 'bottom-right' | 'disabled';
  narrowAudioPanel?: boolean; 
  timerDisplayPosition?: 'header' | 'tab' | 'both';
  progressNavPosition?: 'sidebar' | 'top' | 'bottom';
  timerEndSoundEnabled?: boolean;
  timerEndSoundUrl?: string;
  timerFlashOnPauseEnabled?: boolean;
  phaseAutoScrollEnabled?: boolean;
  scriptFontSize?: number;
  
  /** 音響設定の優先事項 */
  audioPreferences?: {
    preventSleepMode?: 'silent-wav' | 'white-noise' | 'disabled';
  };

  phases: Phase[];
  sounds: SoundConfig[];
  soundClusters?: SoundCluster[];
  characters: Character[];
  images?: ImageResource[];
  playerImages?: ImageResource[];
  lastUpdated?: number;
  /** 
   * シナリオIDの枝番（複数卓を同時に回す場合などに使用）
   */
  branchId?: string;
  /** スナップショット機能 */
  snapshots?: ScenarioSnapshot[];
  /** 子ウィンドウ（同期画面）の初期・デフォルト設定 */
  syncConfig?: SyncConfig;
  /** 同期画面公開用のランダム capability ID。公開 URL 以外には露出させない。 */
  syncShareId?: string;
  /** キーボードショートカット設定 */
  keyboardShortcuts?: KeyboardShortcuts;
  /** @deprecated keyboardShortcuts への移行中に旧保存データを読込むため残す。 */
  customShortcuts?: KeyboardShortcuts;
  /** 旧形式のルール本文。スナップショット互換性のため保持する。 */
  rules?: string;
  /** 旧形式のアウトライン本文。スナップショット互換性のため保持する。 */
  outline?: string;
}

export interface SyncConfig {
  timerEnabled: boolean;
  contentEnabled: boolean;
  timerSize: 'small' | 'medium' | 'large';
  timerPosition: 'top' | 'bottom';
  imageFit: 'contain' | 'cover' | 'fill' | 'width' | 'height';
  activeImageId: string | null;
  timerForceHidden?: boolean;
  
  // Video playback synchronization fields
  videoPlaying?: boolean;
  videoProgress?: number;
  videoDuration?: number;
  videoVolume?: number;
  videoLoop?: boolean;

  // Lap display synchronization fields
  lapDisplayMode?: 'hidden' | 'overlay' | 'persistent';
  lapDisplayPosition?: 'top' | 'bottom';
  lapNotificationText?: string;

  // New要求: オーバーレイと文字色
  overlayType?: 'black' | 'white' | 'none';
  overlayIntensity?: number; // 0.0 - 1.0
  timerColor?: 'black' | 'white';

  // New要求 (v0.86): ラップバナーの帯の大きさ、文字サイズ、タイマー名の文字
  lapBandSize?: 'small' | 'medium' | 'large';
  lapFontSize?: 'small' | 'medium' | 'large';
  timerLabelText?: string;
  urgentShakeEnabled?: boolean;
  imageConfigs?: Record<string, { timerColor?: 'black' | 'white'; overlayType?: 'black' | 'white' | 'none'; overlayIntensity?: number }>;
}

export interface AppState {
  currentScenario: Scenario;
  currentPhaseId: string; 
  previewPhaseId: string; 
  isPlaying: Record<string, boolean>;
  volume: number;
  isDucking: boolean;
  timerStates: Record<string, { seconds: number; isRunning: boolean; startTime?: number | null }>;
  isEditorMode: boolean;
  isPaused?: boolean;
  sessionStartTime?: number;
  phaseStartTime?: number;
  phaseDurations: Record<string, number>;
  usedSounds: Set<string>;
  phaseResults: Record<string, number>; 
  exitTime?: string; 
  syncSessionId?: string;
  activeImageId?: string | null;
  gmActiveImageId?: string | null;
  syncConfig?: SyncConfig;
  pdfPageStates?: Record<string, number>; // URL/ID -> PageNumber
  isQuotaExceeded?: boolean; // Firestore クォータ超過フラグ
}
