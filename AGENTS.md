# CueBook Project Rules & Specs: 2026 Optimization Edition

## 1. デザイン原則 (Design Principles)
- **Mood**: Dark, technical, brutalist, and elegant.
- **Master UI**: マスターボリュームはヘッダーまたはレイアウトに応じた最適な位置に常駐させること。
- **Typography**: インターフェースには `Inter`、数値や統計には `JetBrains Mono`、アクセントには `Cinzel` を使用する。

## 2. 技術仕様 (Technical Specifications)
- **State Management**: 原子的な更新を推奨。アプリ全体を再描画させる定周期タイマー (`setInterval`) は禁止。
- **High-Precision Timing (ドリフト補正タイマー)**: 
  - タイマーは `startTime` (基準時刻) と `seconds` (残秒数) を保持する。
  - 各コンポーネントは `startTime` から表示時間を算出し、ローカルで更新することで、ルートステートの頻繁な更新を避ける。
- **Audio Engine**: `AudioService.ts` シングルトンを介して Web Audio API を制御。バッファをキャッシュし非同期でロード。
- **パフォーマンス最適化 (Performance)**: 
  - エディタのテキスト入力 (Sound Name, URL) は必ずデバウンス (400-500ms) すること。
  - リスト項目 (Sound Card, Script Block) には `React.memo` を適用し、不要な再描画を抑える。
  - `ScriptViewer` はフェーズ切り替え時に完全な再マウント (`key` 更新) を行わず、内部状態の更新で対応する。

## 3. エラーコード定義 (Error Codes)
- `FERR_XXX`: HTTP Fetch Error (例: 404, 403)。
- `FERR_TYPE`: オーディオ形式が不正。
- `FERR_EMPTY`: データが空。
- `DERR_01`: AudioContext デコード失敗。
- `ERR_RUNTIME`: Windowグローバルの実行時エラー。

## 4. 禁止事項 (Prohibitions)
- メインレイアウトに `absolute` を多用しない (Flexbox/Grid 推奨)。
- `AudioService` を介さず直接音声再生を行わない。
- 表示の更新だけを目的としてアプリ全体の `setState` を毎秒呼び出さない。
- ハンバーガーメニューの `UPDATE LOG` を削除しない。

## 5. v0.85 破壊禁止機能 (Immutable Core - 2026/05 Update)
これらの機能は「CueBook v0.85 マイルストーン」であり、イミュータブルなコアスペックです。これらを変更・破壊する際は、いかなる場合もユーザーへの確認が必須です。

- **高精度同期タイマーエンジン**: 
  - `Timer.tsx`, `Header.tsx`, `TimerShareView.tsx`, `SyncThumb.tsx` で共通化されたドリフト補正ロジック。
  - `startTime` (基準時刻) に基づくリアルタイムな秒数算出を各コンポーネントで行い、1秒未満の精度で同期を維持する。
- **Sync Studio (同期ウィンドウ管理システム)**: 
  - `SyncWindowModal.tsx` における、QRコード・アクセスURL管理とリアルタイム制御の統合インターフェース。
  - **Live Preview機能**: モーダル内でタイマーの稼働状態、画像、レイアウト構成をリアルタイムにシミュレートするプレビューウィンドウ。
  - **集中制御パネル**: モーダル内からのタイマー操作（再生/停止/リセット）、表示要素（Visible/Hidden）、配置（Top/Bottom）、拡縮（FILL/WIDTH/HEIGHT）の動的反映。
- **リアルタイム同期プラットフォーム**: 
  - `SyncService` (Firebase Firestore) を介した、タイマー、画像、および設定の完全同期。
  - シナリオ全体のステートと `syncConfig` の原子的な整合性維持。
- **メディア・インタラクション機能 (EasyEditorBlock)**: 
  - エディタ内での `createPortal` および `AnimatePresence` を使用したメディア選択オーバーレイ。
  - `[[image_id]]` 形式のタグによる動的メディア同期のトリガーと、プレビューへの即時反映。
- **階層的台本・進行管理**: 
  - フェーズベースの進行管理 (`ScriptViewer`)、アウトライン編集 (`OutlineEditor`)、および資料配布 (`HandoutModal`)。
- **統合オーディオ制御**: 
  - `AudioService.ts` による一元的な音声素材管理と、複数ブラウザ間での再生整合性の確保。
- **ユーザー体験の永続化**: 
  - ユーザープリファレンスおよびシナリオデータの自動保存と、マルチデバイス間での同期。
- **UI 最適化と安定性 (v0.86 Update)**:
  - **ハイブリッド・サイドバー**: 同期ウィンドウ設定 (`SyncWindowModal`) において、QRコード、URL、および小型ライブプレビューを一画に集約し、設定と確認をシームレスに行えるレイアウト。
  - **堅牢なメディアハンドリング**: 空の `src` 属性による不要なリクエストを排除し、画像ロードの安定性を向上。
  - **高精度タイマー・ポーズ処理**: 変数割り当てミス（const/let）の修正により、一時停止時のドリフト補正を確実に実行。

## 6. 仕様書 (Spec-Sheet) & 変更履歴 (Spec-History) 運用ルール
- **関係性と役割**:
  - `Spec-Sheet.md`: アプリケーションの現時点での機能一覧、変数定義、主要インターフェース構造、ファイルマップを記載した「正」となる仕様書。
  - `Spec-History.md`: バージョンごとの更新内容、変更箇所、新機能追加および修正の履歴概要を追記・蓄積するログファイル。
- **改修・機能開発時の必須ルール**:
  1. AI エージェントおよび開発者は、コード変更を行う前に必ず `Spec-Sheet.md` と `Spec-History.md` を参照し、現行仕様とこれまでの改修経緯を確認すること。
  2. 機能の追加・変更・削除、または変数の追加・変更を行った場合、**作業完了時に必ず `Spec-Sheet.md` を最新状態に書き換え、`Spec-History.md` に変更概要・日付・バージョンを追記**すること。

