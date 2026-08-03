# CueBook v0.84 完全技術仕様書 (Master Blueprint)

## 1. プロジェクト概要
CueBook は、マーダーミステリー（マダミス）やTRPGの進行（GM/MC）を、音響・進行管理・プレイヤー同期の3点から統合的にサポートする「ナラティブ・インテリジェンス・システム」である。

### 1.1 デザインフィロソフィー
- **Mood**: Dark, Technical, Brutalist, Elegant.
- **Master UI**: マスターボリュームはヘッダーに常駐。
- **Typography**: 
  - UI/General: `Inter`
  - Numbers/Stats: `JetBrains Mono`
  - Accents: `Cinzel`

---

## 2. ファイル構成 (File Structure)
プロジェクトは React + Vite + TypeScript で構成されている。

```text
/
├── public/                 # 静的資産
├── src/
│   ├── components/         # UIコンポーネント
│   │   ├── editor/         # エディタ専用コンポーネント (Sidebar, Toolbar等)
│   │   ├── modals/         # 各種モーダル (UpdateLog, SyncWindow等)
│   │   ├── ui/             # 汎用UIパーツ
│   │   ├── Header.tsx      # マスターヘッダー
│   │   ├── ScriptViewer.tsx# 台本表示・進行管理コア
│   │   ├── SoundBoard.tsx  # 音響制御ボード
│   │   └── Timer.tsx       # タイマーコンポーネント
│   ├── services/           # ロジック・シングルトン
│   │   ├── AudioService.ts # Web Audio API 制御
│   │   ├── StorageService.ts # ローカル保存・JSON処理
│   │   └── SyncService.ts  # Firebase/Firestore 通信
│   ├── hooks/              # カスタムフック
│   │   ├── useAppTimer.ts  # グローバル時刻管理
│   │   ├── useAudioController.ts # UIとAudioServiceのブリッジ
│   │   ├── useTimerSync.ts # Firestore同期ロジック
│   │   └── usePhaseManager.ts # フェーズ遷移管理
│   ├── lib/
│   │   └── firebase.ts     # Firebase初期化
│   ├── data/
│   │   └── updateLogs.ts   # 更新履歴データ
│   ├── types.ts            # 全型の定義
│   ├── constants.ts        # 初期シナリオ・定数
│   ├── App.tsx             # メインレイアウト・グローバルステート
│   └── main.tsx            # エントリポイント
├── firestore.rules         # データベースセキュリティルール
└── package.json            # 依存関係管理
```

---

## 3. コア・データモデル (`types.ts`)

### 3.1 `Scenario` (メインデータ構造)
シナリオ全体の情報を保持する。
- `phases: Phase[]`: 進行フェーズの配列。
- `sounds: SoundConfig[]`: 音源リスト（BGM, SE）。
- `characters: Character[]`: キャラクター情報（個別配布物含む）。
- `images: ImageResource[]`: 同期用画像・PDFリソース。

### 3.2 `AppState` (ルートステート)
`App.tsx` で保持される、セッション中の動的な状態。
- `currentPhaseId`: 現在の進行フェーズ。
- `timerStates`: 各タイマーの残り時間、動作フラグ、基準時刻。
- `isPlaying`: 各音源の再生状態。
- `isEditorMode`: 編集モードかセッションモードか。
- `syncConfig`: 同期表示の設定（サイズ、フィット等）。

---

## 4. コア・アルゴリズム

### 4.1 高精度同期タイマー (Drift-Free Sync)
- **原理**: `setInterval` ではなく、開始時の Unix MS (`startTime`) を保存し、描画のたびに `Date.now()` との差分から残り時間を算出する。
- **同期**: `startTime` が全端末で共有されるため、ミリ秒単位で完全に同期する。
- **一時停止**: 経過時間を `remainingSeconds` から差し引き、`startTime` をクリアすることで再開可能な状態で停止する。

### 4.2 Sync Engine v2 (通信最適化)
- **冗長性チェック**: `useTimerSync.ts` にてローカル状態と Firestore データを比較。完全一致なら更新をスキップ。
- **デバウンス (2000ms)**: ユーザーの操作（音量、フェーズ切り替え等）が落ち着いてから Firestore へ書き込み。
- **フォールバック**: Data URI 画像が 1MB を超える場合、URL を送信せず ID のみを共有。受信側は自身の `INITIAL_SCENARIO` またはインポート済みデータから画像を復元する。

### 4.3 Audio Engine (`AudioService.ts`)
- **Web Audio API**: `AudioContext` を使用し、非ブロッキングな音響処理を実現。
- **Buffer Pre-loading**: 音源を事前にフェッチし、`decodeAudioData` でバッファ化してメモリ保持。
- **トリガーモード**: `tap` (一瞬) / `toggle` (切替) / `hold` (押しっぱなし) の動作に対応。
- **Ducking**: ボイス（VOICE/SE）再生時に BGM の音量を自動で 30% に下げる演出ロジック。

---

## 5. 基本機能詳解

### 5.1 台本・進行管理 (Script Viewer)
- **フェーズ制**: シナリオを論理的な「フェーズ」に分割し、GM が一つずつ進めていく。
- **アクションタグ**: `[[image_id]]` 等のタグを台本内に記述可能。クリックすると同期モニタに画像が表示される。
- **チェックリスト**: 各フェーズの完了条件（アイテム配布、情報公開等）を GM がチェック可能。

### 5.2 音響制御 (Sound Board)
- **BGM/SE分離**: BGM は排他的（一つを鳴らすと前のがフェードアウト）、SE は同時再生可能。
- **一括管理**: 全ての BGM を止める「ALL STOP」機能。

### 5.3 同期モニタ (Sync Window)
- **QR共有**: GM 画面から発行した URL をプレイヤーが開くことで、GM の操作とタイマー、画像がリアルタイムにプレイヤー端末へ反映される。

---

## 6. サポート機能 (Support Features)

### 6.1 インポート / エクスポート
- **.cuebook**: シナリオ全体を JSON 形式で保存。画像 URL も含まれる。
- **.zip**: 音源ファイルを含む完全パッケージ（将来的拡張）。
- **ドラッグ＆ドロップ**: エディタ画面へのファイルドロップによる即時読み込み。

### 6.2 プレイヤー配布物 (Handouts)
- **個別配布**: キャラクターごとに設定された秘密情報を、Firestore を介してプレイヤーのスマホへ直接送信。
- **既読確認**: プレイヤー側が「受け取り」を完了した時刻を GM 側でリアルタイム確認可能。

### 6.3 公演履歴 (Performance History)
- **Firebase Auth**: Google ログインを必須とし、GM ごとの過去の公演実績（シナリオ名、キャスト、日付）を Firestore に永続化。

---

## 7. Firebase/セキュリティ
- **Firestore Rules**: 
  - `timerSessions/{sessionId}`: オーナー（GM）のみ書き込み可。全員読み取り可。
  - `isValidTimerSession()`: スキーマバリデーションを実施し、不正なデータ（巨大文字列等）を物理的に拒否。

---

## 8. 開発・再現のための重要事項
- **依存ライブラリ**: `motion/react` (アニメーション), `lucide-react` (アイコン), `react-markdown` (台本), `firebase` (DB), `jszip` (インポート/エクスポート).
- **デバウンスの重要性**: GM モードでの入力レスポンス低下を防ぐため、テキストフィールドや Firestore 通信には必ず `DEBOUNCE_MS` を噛ませること。
- **エラーコード**:
  - `FERR_EMPTY`: データなし。
  - `DERR_01`: 音声デコード失敗（形式不備）。

---
**Version**: 0.84  
**Released**: 2026.05.10  
**Status**: Stable Master Build  
**Created by**: Antigravity AI Engine
