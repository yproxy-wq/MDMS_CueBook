# CueBook: Comprehensive Specification Sheet (SpecSheet)

## 1. プロジェクト概要
**CueBook**は、マーダーミステリー、TRPG、ストーリープレイングのGM（ゲームマスター）が、セッションの進行、音響、情報管理を統合的に制御するための「デジタル演出台本」プラットフォームである。

---

## 2. ユーザー視点仕様 (User Experience & Features)
*「演出を、呼吸するように。」*

### 2.1 コンセプト
GMが「操作」ではなく「演出」に集中できる環境を提供する。物理的なミキサーや計測器を彷彿とさせる重厚なデザイン（Dark Noir）を採用し、セッションの没入感を高める。

### 2.2 主要機能
- **フェーズ連動型進行管理**: 
  - サイドバーで章（フェーズ）を選択すると、その場面の「台本」「タイマー」「推奨BGM」が瞬時に同期。
  - 目標時間に対する実績時間の超過をリアルタイムで警告。
- **インテリジェント・サウンドボード**:
  - 現在のフェーズに紐付けられた音源が最上部に「発光」して表示。
  - 「VOICE FOCUS」機能により、BGMを瞬時にダッキング（減衰）させ、GMのアナウンスを強調。
- **Dramatis Personae (登場人物管理)**:
  - プレイヤーの調査チップ（トークン）数や、個別フラグ（容疑、生死、秘密等）をリアルタイムに追跡。
- **ARCHITECT (エディタモード)**:
  - プログラミング知識不要で、独自のシナリオ、キャラクター、音響棚を構築可能。
  - **Sound Board Refactor**: 音源リストと詳細設定を分離した2カラムレイアウトを採用。
  - **Timeline Management**: フェーズごの一括展開/折りたたみ機能により、大規模なシナリオでも見通しを確保。
  - 作成したデータはJSON形式でエクスポートし、他のGMと共有可能。

---

## 3. シニアエンジニア視点仕様 (Architecture & Reliability)
*「堅牢なオフライン・ファースト・アーキテクチャ」*

### 3.1 システム構成
- **Runtime**: Client-side SPA (React 19 + Vite 6).
- **Persistence**: IndexedDB を採用。`StorageService` により、ブラウザのリフレッシュや不意の終了時もセッション状態を保護。
- **Audio Engine**: Web Audio API をベースとしたカスタムミキサー。各音源インスタンスに個別の `GainNode` を割り当て、リアルタイムな音量制御を実現。

### 3.2 データフローと状態管理
- **Single Source of Truth**: `App.tsx` の `state` (AppState型) が全コンポーネントの挙動を決定。
- **Service Layer Separation**:
  - `AudioService`: 低レイテンシな音声再生、クロスフェード、ダッキングロジックをカプセル化。
  - `StorageService`: IndexedDB への非同期 I/O を抽象化。
- **Optimistic Updates**: ユーザー操作（トークン増減等）はStateに即時反映し、IndexedDBへの保存は非同期で実行することで、UIの応答性を最大化。

### 3.3 パフォーマンス最適化
- **Memoization**: `useMemo` を用いた音源リストの動的ソート、`useCallback` によるレンダリングコストの削減。
- **Resource Management**: 停止したオーディオノードの明示的なクリーンアップ（`src = ""`）によるメモリリーク防止。

---

## 4. コーダー視点仕様 (Implementation & Styling)
*「ピクセルパーフェクトな実装ガイド」*

### 4.1 スタイリング規約 (Tailwind CSS)
- **Theme**: 
  - 背景: `bg-[#050505]`
  - ボーダー: `border-white/5` (極めて繊細なライン)
  - ブラー: `backdrop-blur-md` (グラスモーフィズム)
- **Typography**:
  - 見出し: `font-cinzel` (Cinzel, serif)
  - 数値: `font-mono` (JetBrains Mono)
  - 本文: `font-sans` (Noto Sans JP)

### 4.2 コンポーネント構造
- **`Header.tsx`**: 
  - グローバルボリューム、ダッキングスイッチ、エディタ切り替え、データ入出力を配置。
- **`PhaseSidebar.tsx`**: 
  - `sessionStartTime` に基づく経過時間の計算。
  - `actualSeconds` と `targetSeconds` の比較ロジック。
- **`ScriptViewer.tsx`**: 
  - `marked` ライブラリによる Markdown パース。
  - キャラクターフラグのトグルロジック。
- **`EditorView.tsx`**:
  - シナリオ、キャラクター、音響、タイムラインの各設定を統合。
  - 音響設定では、選択した音源のフェード時間（デフォルト3.0s、0.5sステップ）、ループ、ボリュームを詳細に調整可能。

### 4.3 音響パイプラインの実装
1. `AudioContext` の初期化（ユーザーインタラクション後）。
2. `createMediaElementSource` による DOM Audio との連携。
3. `GainNode` によるフェードイン/アウトの実装（`linearRampToValueAtTime`）。
4. クラウドストレージURL（Google Drive/Dropbox）の正規表現による直リンク変換。

---

## 5. データスキーマ (JSON Structure)
```typescript
interface AppState {
  currentScenario: Scenario;
  currentPhaseId: string;
  isPlaying: Record<string, boolean>;
  volume: number;
  isDucking: boolean;
  timerStates: Record<string, { seconds: number; isRunning: boolean }>;
  isEditorMode: boolean;
  phaseResults: Record<string, number>; // 各フェーズの実績時間(s)
}
```

## 6. 拡張性とメンテナンス
- **i18n**: 現在は日本語/英語混在だが、テキスト定数化により多言語対応が容易な設計。
- **PWA**: `manifest.json` と Service Worker の追加により、完全なオフラインアプリとして動作可能。
