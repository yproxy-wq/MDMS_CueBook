# CueBook Spec-Sheet (システム・機能・データ構造仕様書)

> **注意・運用規定**: 本ドキュメントは CueBook の全体機能一覧および主要データ構造（変数・インターフェース）の「正」となる仕様書です。
> 機能変更や機能追加を行う際は、**必ず事前に本 Spec-Sheet および `Spec-History.md` を参照**し、実装完了時に両ファイルを最新の状態に更新してください。

---

## 1. アプリケーション概要 (Overview)
- **名称**: CueBook
- **用途**: TRPG・マーダーミステリー・リアル体験型ゲーム向け 高精度タイマー・音響・映像・シナリオ一元管理 GM（ゲームマスター）ワークスペース
- **デザインコンセプト**: Dark, technical, brutalist, and elegant.
- **主要動作モード**: 
  - **進行画面 (Play / GM Mode)**: `/` または `/session`。タイマー・演出・BGM/SE・台本同期・子ウィンドウ投影の集中制御画面
  - **編集画面 (Editor Mode)**: `/edit`。シナリオ・フェーズ構成・音響ライブラリ・メディア・キャラクター別ハンドアウトの編集画面
  - 画面切替はHistory APIでURLと同期し、ブラウザの戻る／進むおよび各パスへの直接アクセスから同じモードを復元する。

---

## 2. 主要機能一覧 (Feature List)

### A. 進行・同期・マルチ画面制御 (Sync Studio & Projection)
1. **Sync Studio (同期ウィンドウ管理)**:
   - 子ウィンドウ (プレイヤー向け投影画面) のリアルタイム制御。
   - QRコード表示、アクセスURL発行、Live Preview シミュレーション。
   - 表示要素（Visible/Hidden）、配置（Top/Bottom）、拡縮（FILL/WIDTH/HEIGHT）のリアルタイム反映。
2. **画像・メディア番号指定 & ワンキー投影 & 画像セット設定 (Number Key Projection & Per-Image Set Config)**:
   - 登録された共有画像/メディアに自動的に順番番号 (#1, #2, #3...) を付与。
   - 進行画面でキーボードの数字キー `1` 〜 `9` や `]` / `[` / `Ctrl+Alt+I` を押すことで、該当番号の画像を即時に子ウィンドウへ投影。
   - **画像セット連動設定 (v1.07)**: 各画像に「タイマー文字色（黒系/白系）」および「中間レイヤー（黒/白/なし）」を個別のセットとして保存保持。画像の選択・キー切り替え時に該当設定がアトミックに適用・同期される。
   - Sync Studioの番号表示とショートカットは同じ順序付きメディア一覧を使用する。プレイヤー共有画像が存在する場合はそれを優先し、存在しない場合のみ通常画像／ローカル映像へフォールバックする。
3. **高精度同期タイマーエンジン**:
   - `startTime` (基準時刻) に基づくドリフト補正リアルタイムタイマー。
   - Firebase Firestore (`SyncService`) を介した複数端末・子ウィンドウ間での1秒未満精度同期。
4. **共有 capability セキュリティ (v1.09)**:
   - Timer と Handout の共有 URL は `crypto.getRandomValues` で生成した 256-bit の不透明 ID を capability として用いる。URL を知る端末だけが単一の共有ドキュメントを読める。
   - Firestore rules は capability ID とドキュメント ID の一致を検証し、コレクション `list` と旧来の推測可能 URL を拒否する。平文 PIN と更新者 UID は共有ペイロードに含めない。
   - 所有者は安全な共有IDであればドキュメント作成前から購読できる。公開閲覧は、既存ドキュメントの capability 一致が引き続き必須。
   - capability URL は秘密情報として扱う。誤送信時は対象シナリオ／キャラクターで新しい共有 ID を発行し、既存 URL を使わない。

### B. 音響制御 (Audio Engine & Sound Clusters)
1. **Web Audio API 統合制御 (`AudioService.ts`)**:
   - 単一の Web Audio Context による BGM/SE バッファキャッシュおよび非同期再生。
   - ループ再生、フェードイン/フェードアウト、独立ボリュームコントロール。
2. **音響クラスター (Sound Clusters - プリセット機能)**:
   - 複数の BGM や SE を組み合わせたプリセットの作成・保存。
   - フェーズへのマッピング対応。
   - 1クリック（または `Ctrl + Alt + C`）での一括ワンタップ再生・音響切り替え。
   - 現在再生中の音響から直接クラスターを生成する「再生中を保存」機能。

### C. 台本・進行・メディア編集 (Scenario & Editor)
1. **EasyEditorBlock (リッチエディタ & メディアタグ)**:
   - contentEditable ベースのリッチテキストエディタと Markdown / HTML 相互変換 (`markdown.ts`)。
   - ツールバーショートカット (`Ctrl+B`, `Ctrl+I`, `Ctrl+U`, `Ctrl+K`, `Ctrl+Z`, `Ctrl+Y` 等)。
   - `[[image_id]]` タグ埋め込みによる台本連動メディア同期。
2. **メディア順序変更機能 & インタラクション (`MediaTab.tsx`)**:
   - 登録画像の上下移動 (`↑` / `↓` ボタン) による並び替えおよび自動番号再割り当て (#1, #2...)。
   - メディア要素カード (`.product__media`) におけるホバー時の `scale(1.02)` スムーズイージングアニメーション。
   - GM台本マテリアル／プレイヤー共有画像の両方で「Dropboxから追加（推奨）」を標準の追加方法として先頭に常時表示する。URL入力ラベルで直リンク自動変換を簡潔に案内し、直接アップロードは小容量素材向けの副選択肢とする。
3. **変更検知トースト表示 (EditorView)**:
   - シナリオデータ変更時に右下にアニメーション付き "Changes Saved" インジケーターを自動表示（表示時間は9秒に統一）。
4. **階層的台本進行 & ハンドアウト**:
   - フェーズ管理 (`ScriptViewer`)、アウトライン編集 (`OutlineEditor`)、キャラクター別資料配布 (`HandoutModal`)。

### D. ユーザーインターフェース & アクセシビリティ
1. **不透明ソリッドダークUI設計 (`Header.tsx`, `PhaseProgressNav.tsx`, `App.tsx`)**:
   - ヘッダー (`Header.tsx`)、フェーズナビゲーション (`PhaseProgressNav.tsx`)、およびメインコンソールエリア全体において背景画像が透けない完全不透明なブラックソリッド背景 (`bg-[#0a0a0b]`, `bg-zinc-950`) を適用。
   - レンダリングの視認性およびテキスト可読性を最優先したソリッドレイアウト構成。
2. **アニメーションサイドバー (Framer Motion)**:
   - スムーズなイージング関数を適用した左右パネルの折りたたみ/展開アニメーション。
3. **Web総合マニュアルの3モード化 & キーボード操作ガイド掲載 (`public/manual-a.html`)**:
   - 進行ウィンドウ（RUN）、編集ウィンドウ（EDIT）、子ウィンドウ（SYNC）の3モード切り替え対応。
   - 子ウィンドウ環境別構成例（①1台PC完結/OBS、②ネットワーク接続端末/タブレット/スマホ、③単機能液晶/Miracast/AirPlay）と、手動/自動メディア連動・集中制御ガイドを完備。
   - 進行モード（RUN SECTION 09）および編集モード（EDIT SECTION 08）にキーボードショートカット一覧（`m`, `k`, `[`, `]`, `Space`, `Ctrl+Alt+Q` 等）とカスタマイズ（Preferences）ガイドを統合網羅。
3. **コンテキスト別 ショートカットキーガイド & 統合グローバルキーバインド (`ShortcutsGuideModal.tsx`, `useGlobalShortcuts.ts`)**:
   - 進行画面用 / 編集画面用のショートカットキー一覧をタブ切り替え可能。
   - `e.code` (e.g. `KeyW`, `KeyI`, `Digit1`~`Digit9`, `KeyE`, `KeyG`, `KeyB`, `KeyS`, `KeyR`, `KeyN`, `KeyP`, `KeyQ`) および `e.key` の両方をケースインセンシティブに完全判別。
   - `Ctrl + Alt + 1` 〜 `9`（または数字単体 `1` 〜 `9`）による指定番号画像へのダイレクト送出機能を追加。`Ctrl + Alt + W` (子画面 Sync Studio 開閉)、`Ctrl + Alt + I` (連動メディア順次送り)、`Ctrl + Alt + N / P` (フェーズ進退)、`Ctrl + Alt + B / S` (BGM/SE操作)、`Space` (タイマー操作) などの全キーイベント処理を `useGlobalShortcuts` に一本化する。
   - `dispatchGlobalShortcut` は DOM 非依存の dispatcher として切り出し、同期ウィンドウ、音源、タイマーを含む重点操作をユニットテストで検証する。入力／textarea／select／contenteditable 中は発火しない。
3. **ブランドロゴ装飾 (`Header.tsx`)**:
   - ヘッダー左上の「CueBook」ロゴの「C」の文字背後に万年筆ペン先画像 (`nib.png`) を配置。文字群全体を右にシフトし、ペン先画像をさらに20%拡大 (`w-14 h-14 md:w-20 md:h-20`) および「C」の文字分左へオフセット (`-left-5 md:-left-8`)、見出しに合わせた角度 (`rotate-[10deg]`) で配置してクラシックかつ洗練されたトーンを演出。
4. **GM向けクイックアクション (`QuickActionsModal.tsx`)**:
   - `Ctrl + Alt + Q` で起動可能なクイックアクションダイアログ。全音声即時停止、タイマーリセット、フェーズ検索、同期設定、各種設定へワンタップアクセス。
5. **ネットワーク・同期シューター (`SyncTroubleshooter.tsx`, `NetworkToast.tsx`)**:
   - Firestore クォータ・ネットワーク状態のリアルタイム診断と復旧UI。
6. **利用者向けUpdate Log (v0.97)**:
   - ヘッダー、ヘルプ、初期ガイドの表示バージョンは v0.97。
   - 表示内容はショートカットキーの追加・改善と細かなバグフィックスに限定し、v1.08 / v1.09 の技術履歴はアプリ内のUpdate Logに表示しない。

### E. 配備・品質ゲート (Firebase Hosting)
1. **Firebase Hosting 設定**:
   - `firebase.json` は `dist` を配備し、存在しない任意パスを `/index.html` へ rewrite する SPA 構成。
   - rewrite 前の URL を対象に、アプリシェルは再検証、`/assets/**` はハッシュ付き静的 asset として長期 immutable cache を適用する。
   - `.firebaserc` は AI Studio で使用する Firebase project を default alias として定義する。
   - project aliases は `development` (`cuebook-dev`)、`stable` (`cuebook-stable`)、`business` (`cuebook-biz`) を使用し、default は `development` とする。
   - `npm run build:development` は `.env.development` のFirebase Web設定を使用し、Hostingの `cuebook-dev` と認証・Firestore接続先を一致させる。
2. **配備前品質ゲート**:
   - `npm run verify` は lint、TypeScript 型検査、ユニットテスト、本番 build を順に実行する。
   - 初回および変更配備では Hosting preview channel に対して deep link、認証、同期画面、タイマー、キャッシュ更新を受入確認する。
3. **環境別リリース運用規定**:
   - **Dev (`cuebook-dev`)**: 新機能・修正を頻繁に追加し、開発者および協力者が検証するテスト環境。安定性を保証する一般公開先として扱わない。
   - **Stable (`cuebook-stable`)**: Devで品質ゲートと受入確認を完了した安定版だけを配備する一般公開環境。DevからStableへの昇格は、リリース対象の版を固定して実施する。
   - **Biz (`cuebook-biz`)**: 特定利用者および店舗運用を想定した商用環境。Stableで互換性と安定動作を検証し、対象利用者にもStable版で事前確認を依頼した後に更新する。
   - 緊急修正を除き、Bizの更新予定は少なくとも1か月前までに対象利用者へ連絡する。変更内容、確認対象、予定日および影響範囲を案内に含める。
   - 標準の昇格順序は **Dev → Stable → Biz** とし、Bizへの直接配備は行わない。緊急時に例外対応する場合は、理由、影響範囲、検証結果、ロールバック方法を `Spec-History.md` に記録する。
   - StableおよびBizの本番配備は自動昇格させず、品質ゲート成功後の明示的な手動承認を必須とする。

### F. データ整合性・設計原則 (v1.10)
1. **ACID 境界**:
   - IndexedDB の保存完了は request 成功ではなく transaction `complete` を基準とする。abort/error は失敗として扱う。
   - Firestore のデバウンス／集約書込みは durable write の完了まで保留データを破棄せず、失敗時に再試行可能な状態を維持する。
2. **UNIX 哲学に基づく責務分離**:
   - `StorageService.runTransaction` は IndexedDB トランザクションだけを担当し、シナリオの移行は `scenarioValidator` に委譲する。
   - `WriteBloatGuardian` は書込み頻度の集約と完了通知だけを担当し、Firestore のデータ変換・パス解決とは分離する。

---

## 3. 主要変数・型定義・インターフェース一覧 (Variable & Type Specs)

| 型名 / 変数名 | 定義場所 | 概要・役割 |
|---|---|---|
| `Scenario` | `src/types.ts` | シナリオ全体のルートデータ構造。`keyboardShortcuts` を正規形とし、`syncShareId` に Timer 共有用の 256-bit capability を保持する。旧 `customShortcuts`、`rules`、`outline` も読込互換のため保持する。 |
| `Character` | `src/types.ts` | キャラクター情報。`handoutShareId` に Handout 専用の独立した 256-bit capability を保持する。 |
| `Phase` | `src/types.ts` | シナリオの各進行フェーズ。正規名 `name` と、旧データ読込用 optional `title` を持つ。 |
| `ScriptBlock` | `src/types.ts` | 台本ブロック。`markdown`、`outline`、`pdf`、`image` を扱う。 |
| `SoundConfig` | `src/types.ts` | 音響素材の設定データ（id, name, url, type: BGM/SE, volume, loop, triggerMode） |
| `SoundCluster` | `src/types.ts` | 音響プリセット（id, name, phaseId?, soundIds[], volumes?, color?） |
| `MediaResource` / `ImageResource` | `src/types.ts` | メディア素材（id, name, url, updatedAt, type: image/pdf/video） |
| `SyncConfig` | `src/types.ts` | 同期ウィンドウ制御設定（timer/content 表示、配置、imageFit、画像ごとの文字色・overlay・overlayIntensity）。 |
| `TimerSyncData` | `src/services/SyncService.ts` | Firestore 上にリアルタイム保持される同期ステート（startTime, seconds, isRunning, activeImageId 等）。`shareId` は Firestore path と一致する capability であり、PIN／更新者 UID は持たない。 |
| `sanitizeForFirestore` | `src/services/SyncService.ts` | Timer／Handout書込み直前に、Firestoreが拒否する `undefined` をネスト・配列を含めて除去する共通境界。FieldValue／Timestampは保持する。 |
| `HandoutSyncData` | `src/services/SyncService.ts` | キャラクター別配布の共有ステート。メタデータ・本文・在席通知は常に Firestore merge 更新し、在席通知だけの更新で既存資料を消去しない。 |
| `CustomShortcuts` | `src/types.ts` | ユーザー定義の各種キーボードショートカット設定 |
| `AppState` | `src/types.ts` | GM 画面の操作 state。タイマーは `seconds` と `startTime` の組で保持する。 |

---

## 4. プロジェクト構成ガイドライン (Project File Map)
- `src/App.tsx`: アプリケーションのメインエントリーポイント・レイアウトオーケストレーター
- `src/components/Header.tsx`: マスターUI、タイマー表示、全般メニュー、ショートカットボタン
- `src/components/EditorView.tsx`: シナリオエディタ親コンポーネント（Saved トースト、タブ切替）
- `src/components/SoundBoard.tsx`: BGM/SE/SoundCluster 一括操作ボード
- `src/components/editor/MediaTab.tsx`: 画像/動画の管理、ソート順操作、タグコピー
- `src/components/modals/ShortcutsGuideModal.tsx`: モード別ショートカットキー一覧モーダル
- `src/hooks/useGlobalShortcuts.ts`: キーボード入力監視フックと、テスト可能な `dispatchGlobalShortcut` (1~9 数字キー画像切替、Ctrl系操作)
- `src/hooks/useGlobalShortcuts.test.ts`: Sync Studio、メディア、BGM/SE、タイマー、フェーズ操作のショートカット回帰試験
- `src/services/AudioService.ts`: Web Audio API シングルトン管理クラス
- `src/services/SyncService.ts`: Firebase Firestore リアルタイム同期層
- `src/hooks/useAppTimer.ts`: 既存タイマー互換の 1 秒表示フック
- `src/hooks/useDisplayNow.ts` / `src/components/LiveHeader.tsx`: root state を更新せず leaf component と Header wrapper で表示時刻を更新する層
- `src/components/DebouncedInput.tsx`: 450ms を標準とする textarea 用デバウンス入力
- `firebase.json` / `.firebaserc`: Firebase Hosting の配備先・SPA rewrite・キャッシュ設定
- `修正指示書_2026-08-02.md`: Firebase Hosting 配備前の問題一覧、再発防止策、残存リスク
