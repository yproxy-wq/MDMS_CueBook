# CueBook Spec-History (仕様変更履歴・変更ログ)

> **運用ルール**: 
> - 新機能追加、UI調整、バグ修正、データ構造の変更を行った場合、本ファイルに日付・バージョン・変更箇所の概要を必ず追記してください。
> - 変更作業の際は、常に `Spec-Sheet.md` と本ファイルを参照しながら作業を進めてください。

---

## 変更履歴一覧 (Change History)

### [2026-08-04] v0.98-dev.3 - `.cuebook` ZIPインポートの修正
- **インポート (`App.tsx`)**: `.cuebook`エクスポートがZIPコンテナであることを考慮し、JSONとして直接解析して`Unexpected token 'P'`になる不具合を修正。ZIP／CUEBOOK／JSONを同じ検証済みパーサーで処理する。

### [2026-08-04] v0.98-dev.2 - 並列進行の見える化とシナリオ専用URL
- **管理UI (`ScenarioManagerModal.tsx`)**: シナリオごとの進行・タイマーが独立して保存されることを並列進行インジケーターで明示。
- **シナリオURL**: 各カードに`scenarioId`付きURLを表示し、コピー、リンクを新しいタブで開く操作を追加。URLにはシナリオファイル本体を含めず、端末側の紐づけ前提を維持。
- **マニュアル**: 並列進行と専用URLの利用方法をMarkdown／Webマニュアルへ追記。

### [2026-08-04] v0.98-dev.1 - シナリオ管理モーダルとシナリオ別進行保存
- **管理UI (`ScenarioManagerModal.tsx`, `Header.tsx`)**: 左飛び出し式だったシナリオ管理を中央モーダルへ集約し、一覧・登録・入出力・編集モード・リセット・端末状態を同一画面で操作できるようにした。
- **クイック切り替え (`useGlobalShortcuts.ts`)**: `Ctrl/Cmd + Shift + 1〜9` をMY SCENARIOSの一覧順切り替えに追加。既存のメディア数字キーとは競合しない。
- **シナリオ別進行 (`StorageService.ts`, `useSyncEngine.ts`)**: IndexedDBの`sessions`を`scenarioId`キーで追加し、フェーズ、タイマー、結果、同期表示をシナリオごとに保存・復元。切り替え前にも明示保存する。
- **マニュアル**: 管理モーダル、ショートカット、シナリオ別進行保持の使い方をMarkdown／Webマニュアルへ追記。

### [2026-08-04] v0.98-dev - マイシナリオと端末ローカルファイル紐づけ
- **シナリオ台帳 (`ScenarioRegistryService.ts`)**: Googleアカウントにはタイトル・設定・fingerprint・更新日時だけを保存し、シナリオ本体やメディアバイナリは保存しない構成を追加。
- **IndexedDB (`StorageService.ts`, `useSyncEngine.ts`)**: シナリオ本体と端末別`scenarioBindings`を分離。既存の固定キーを残したまま、シナリオIDごとの保存へ移行。
- **シナリオ管理 (`Header.tsx`, `App.tsx`)**: 左へ飛び出すMY SCENARIOS一覧、利用可能／紐づけ未完了表示、端末ファイル選択、更新版確認、進行破棄確認、`scenarioId` URL切り替えを追加。
- **安全性**: ID一致・fingerprint差分を分離判定し、別シナリオのファイル選択や未紐づけURLで現在の進行を破棄しないようにした。Firestore rulesに所有者限定のシナリオ台帳ルールを追加。
- **マニュアル**: `MANUAL.md` とWebマニュアルに端末2での初回紐づけ、更新版、未紐づけ時の挙動を追記。

### [2026-08-04] v0.97s.8 - 共有画面とJSZipの遅延ロード
- **初期バンドル (`App.tsx`)**: Timer共有画面、Handout共有画面、シナリオ入出力用JSZipを必要時の動的importへ移行。
- **効果**: production buildの初期メインJSをgzip約503.5KBから約463.7KBへ削減。

### [2026-08-04] v0.97s.7 - 同期永続化の完了保証とTailwindビルド移行
- **Firestore同期 (`SyncService.ts`, `useTimerSync.ts`)**: Timer／Handoutのデバウンス書込みがdurable write完了を返すようにし、失敗時の保留データ保持・再試行、世代の異なる更新の保護を追加。
- **セッション復旧 (`useSessionRecovery.ts`)**: React stateの置換でバックアップスケジュールが再起動しないよう、最新state参照とアイドル時保存の固定スケジュールへ変更。
- **CSSビルド (`index.html`, `src/index.css`, `vite.config.ts`)**: Tailwind CDN／外部import mapを除去し、`@tailwindcss/vite`によるビルド時CSS生成へ移行。既存のインラインデザインCSSは維持。
- **品質**: 型検査、lint、75件のユニットテスト、production buildを通過。

### [2026-08-04] v0.97s.6 - Biz-Xtvブランドマーク右移動
- **XTVロゴ位置 (`Header.tsx`)**: XTVブランドマークを現位置から10px右へ移動。CueBook文字を前面、マークを下層とするスタッキング順は維持。

### [2026-08-04] v0.97s.5 - Biz-Xtvブランドマーク重なり順・位置調整
- **XTVロゴ位置 (`Header.tsx`)**: XTVブランドマークをさらに5px左へ移動し、CueBook文字を`z-index: 10`、マークを`z-index: 0`の同一スタッキングコンテキストへ配置。マークが文字に重なる場合も必ず文字の下層へ描画する。

### [2026-08-04] v0.97s.4 - Biz-Xtvブランドマーク位置調整
- **XTVロゴ位置 (`Header.tsx`)**: CueBookロゴ右側のXTVブランドマークを、従来位置から10px左へ移動。

### [2026-08-04] v0.97s.1 - Biz-Xtvブランドマーク更新
- **XTVロゴアセット (`dot-x.png`)**: Biz-Xtvヘッダーでのみ表示するブランドマークを、最新の提供画像へ差し替え。

### [2026-08-03] v0.97s - ヘッダー調整と同期診断バーの廃止
- **ヘッダーロゴ (`Header.tsx`)**: CueBookロゴをモバイル20px／デスクトップ24pxへ揃え、最終指定の淡いグレー（`#d8d8d8`）へ変更。
- **常駐同期診断バー (`App.tsx`)**: 全ビュー下部の「同期がうまくいかないときは？」バーを削除。未到達になる通知導線も同時に除去し、同期エラーは既存の通知とSystem Recoveryで扱う。

### [2026-08-03] v0.97s - Biz-Xtvヘッダーブランドマーク表示修正
- **XTV専用ロゴ表示 (`Header.tsx`, `deploy-biz.yml`)**:
  - 未使用だった `dot-x.png` をViteアセットとして取り込み、Biz-Xtvビルド時だけCueBookロゴ右側に表示するよう修正。
  - Biz Workflowが許可済み店舗コードを `VITE_CUEBOOK_TENANT` としてビルドへ渡し、Dev／Stable版にブランドマークが混入しないようにした。

### [2026-08-03] Firestore Rulesを含む環境配備
- **Dev／Stable／Biz Workflow**: Firebase Hostingだけでなく、同じリリースの `firestore.rules` を対象プロジェクトへ同時配備するよう変更。新規環境でHostingだけが更新され、Firestoreが既定拒否のまま残る事故を防止する。
- **IAM要件**: 環境ごとの配備サービスアカウントには `Firebase Hosting Admin` に加えて `Firebase Rules Admin` を付与する。

### [2026-08-03] Codex経由の配備確認プロトコル
- **操作窓口**: `gh` CLIのworkflow権限を確認し、Dev／Stable／Bizの配備WorkflowをCodexから起動・監視できることを確認した。
- **安全策**: Devは明示的な配備指示で実行可能とし、Stable／Bizは対象タグ、Firebase project、店舗コード、受入確認、ロールバックタグを提示したチャット上の最終承認後にだけWorkflowを起動する。GitHub EnvironmentのRequired reviewerは独立して維持する。

### [2026-08-03] Stable／店舗別Bizの手動昇格Workflow
- **Stable (`deploy-stable.yml`)**: Dev受入確認済みのバージョンGitタグを指定してのみ実行できる、`cuebook-stable` 向けの手動配備Workflowを追加。GitHub Environment `stable` の承認と環境別Firebase設定を必須化した。
- **Biz (`deploy-biz.yml`)**: Gitタグと許可済み店舗コードを指定してのみ実行できる、店舗別手動配備Workflowを追加。初期許可店舗 `xtv` は `cuebook-biz-xtv` と `biz-xtv` Environmentへ固定し、任意のHosting projectへの誤配備を防止する。
- **再発防止**: Bizは店舗ごとにFirebaseプロジェクト、OIDC認証、GitHub Environmentを分離する。全環境で短期OIDCトークンを使用し、IAM Service Account Credentials APIの有効化、実ブラウザによる受入確認、タグ指定ロールバックを運用要件とした。

### [2026-08-03] v0.97s - タブレット台本の背景透過修正
- **2カラムレイアウト (`App.tsx`)**: 台本コンテナに加え、その親で背景画像を覆っていた不透明なタブレット用レイアウト背景を透明化。PC中央パネルと同じ半透明暗色レイヤーと `backdrop-blur` の合成比に揃え、背景画像の控えめな透けと台本文字の視認性を両立した。モバイルの不透明背景は維持する。

### [2026-08-03] v0.97s - リリース表記統一
- **アプリ内表示**: ヘッダー、ヘルプ、初期ガイド、Update Logの表示を `v0.97s` に統一した。
- **内部定義**: `src/config/version.ts` の `APP_VERSION` を表示用の単一の正とし、`package.json` はツール互換のSemVer `0.97.0` を使用する。

### [2026-08-03] Firebase Hosting配備時のOIDC認証引き継ぎ修正
- **GitHub Actions (`.github/workflows/deploy-dev.yml`)**: Google Cloud OIDC認証後に短期アクセストークンを発行し、Firebase CLIの `--token` へ明示的に渡すよう変更。ADCだけではFirebase CLIが未ログイン扱いになるRunner環境に対応。
- **再発防止**: 認証アクションの成功だけでなく、後続CLIが実際に利用できるアクセストークンを取得できることを配備ステップで検証する。

### [2026-08-03] CIのFirebase設定ファイル解決エラー修正
- **TypeScript／Vite検証**: `src/lib/firebase.ts` の静的フォールバック設定をCIでも解決できるよう、公開Web SDK設定のみを含む `firebase-applet-config.json` を管理対象に戻した。
- **運用**: 本番・Devのビルドは引き続き `VITE_FIREBASE_*` 環境変数を優先する。サービスアカウント鍵、OIDC情報などの秘密情報はファイルへ追加しない。

### [2026-08-03] Dev用GitHub Actions配備Workflow
- **自動検証・配備 (`.github/workflows/deploy-dev.yml`)**:
  - `main`へのPushまたは手動実行をトリガーに、依存関係インストール、`npm run verify`、開発モードBuild、`cuebook-dev` Hosting配備を実行。
  - GitHub Environment `development` のVariables／SecretsからFirebase設定とGoogle Cloud認証情報を注入する。
  - GitHub OIDC／Workload Identity Federationを使用し、長期Firebaseトークンを保管しない。
  - Stable／Bizへは自動配備せず、既定の昇格順序と手動承認ルールを維持。

### [2026-08-03] Dev／Stable／Biz リリース運用規定
- **環境の役割**:
  - Dev (`cuebook-dev`) は新機能を頻繁に投入するテスト環境、Stable (`cuebook-stable`) は安定版のみを提供する一般公開環境、Biz (`cuebook-biz`) は特定利用者・店舗向け商用環境と定義。
- **昇格条件**:
  - 標準の昇格順序を Dev → Stable → Biz とし、Stableでの互換性・安定動作検証および対象利用者による事前確認後にBizを更新する。
  - 緊急時を除き、Biz更新の少なくとも1か月前に変更内容、確認対象、予定日、影響範囲を通知する。
  - Stable／Bizの配備は品質ゲート成功後の手動承認を必須とし、Bizへの直接配備を禁止。緊急例外は理由、検証結果、影響範囲、ロールバック方法を履歴へ記録する。

### [2026-08-03] v0.97 - 進行／編集ウィンドウのURLパス対応
- **メイン画面ルーティング (`App.tsx`, `appRoute.ts`)**:
  - `/` と `/session` を進行ウィンドウ、`/edit` を編集ウィンドウとして直接表示するパス規約を追加。
  - ヘッダー、シナリオメニュー、ショートカット、クイック操作からの切替をHistory APIと同期し、ブラウザの戻る／進むにも追従。
  - セッション復旧時も現在のURLを画面モードの正として維持する。
- **再発防止 (`appRoute.test.ts`)**:
  - ルート、末尾スラッシュ、不明パスのfallback、正規パス、検索文字列・ハッシュ保持を回帰試験化。

### [2026-08-03] v0.97 - Dropbox推奨メディア登録UI
- **メディア登録導線 (`MediaTab.tsx`)**:
  - GM台本マテリアル／プレイヤー共有画像の両タブで、Dropbox共有リンクを標準の追加方法としてリソース一覧より前に常時表示。
  - Dropbox URL入力を開閉操作なしで使えるシンプルな構成にし、端末からの直接アップロードは「小容量向け」の補助導線へ縮小。
  - 共有URLの直リンク自動変換、複数URL入力、任意名入力を同一のコンパクトなカード内へ集約。
  - 見出しを「Dropboxから追加（推奨）」に変更し、直リンク変換の説明をURL入力ラベルへ集約。容量アドバイザーのFirestore説明文を削除。
- **案内精度**:
  - 外部リンクの消費量を厳密に0KBと断定せず、「実ファイルを埋め込まずURL情報分に抑える」と説明する表現へ修正。

### [2026-08-03] v0.97 - Firestore未定義値エラー修正
- **同期書込み境界 (`SyncService.ts`)**:
  - `imageConfigs: undefined` を含むTimer同期データが `setDoc` で拒否される不具合を修正。
  - Firestore書込み直前にオブジェクト・ネスト・配列内の `undefined` を除去する共通サニタイズを追加し、TimerとHandoutへ適用。
- **再発防止 (`SyncService.test.ts`)**:
  - トップレベル／ネスト／配列の未定義値除去と、`imageConfigs` がFirestoreへ送られないことを回帰試験化。

### [2026-08-03] v0.97 - 子ウィンドウ画像ショートカット修正
- **同期メディア参照の統一 (`App.tsx`, `mediaHelper.ts`)**:
  - Sync Studioが番号表示するプレイヤー共有画像と、数字／前後移動ショートカットが参照する配列の不一致を修正。
  - プレイヤー共有画像を優先し、未登録時のみ通常画像・ローカル映像を利用する単一の選択関数へ統一。番号、選択状態、URL同期を同じ順序で処理する。
- **再発防止 (`mediaHelper.test.ts`)**:
  - プレイヤー共有画像の優先順位とfallback動作をユニットテスト化。

### [2026-08-03] cuebook-dev - 初期同期購読のFirestore rules修正
- **同期セッション初期化 (`firestore.rules`)**:
  - 新規Timer／Handoutドキュメントが未作成の段階で、所有者の `get`（リアルタイム購読開始）が拒否される不具合を修正。
  - 所有者または管理者だけが安全なIDの未作成ドキュメントを取得可能とし、公開閲覧は従来どおり既存ドキュメントのcapability一致を必須とする。

### [2026-08-03] Firebase Hosting 環境エイリアス
- **配備先 (`.firebaserc`)**:
  - 開発環境 `development` (`cuebook-dev`)、安定版 `stable` (`cuebook-stable`)、商用 `business` (`cuebook-biz`) のプロジェクトエイリアスを定義。default は安全な開発環境 `cuebook-dev` とする。
  - 安定版・商用へは、開発環境での同期・認証・ショートカット受入確認後に対象エイリアスを明示して配備する。
- **配備対象 (`firebase.json`)**:
  - Hostingに加え `firestore.rules` をFirebase CLIの配備対象として明示。同期機能を含む環境は `hosting,firestore:rules` を同時指定する。
  - `development` mode は `.env.development` の `cuebook-dev` Web設定を使用する。従来のAI Studio設定をfallbackとして維持し、別環境は専用のVite modeで追加する。

### [2026-08-03] v0.97 - 表示用Update Logの整理
- **表示バージョンと更新案内 (`Header.tsx`, `HelpModal.tsx`, `constants.ts`, `updateLogs.ts`)**:
  - アプリ内の表示バージョンを v0.97 に統一し、更新ログをショートカットキーの追加・改善と細かな安定化修正の案内へ変更。
  - 表示用Update Logから v1.08 / v1.09 を除外。過去の技術・配備履歴は本ファイルに保存し、利用者向けログには表示しない。

### [2026-08-03] v1.10 - ACID/UNIX境界の堅牢化
- **永続化の原子性・耐久性 (`src/services/StorageService.ts`)**:
  - IndexedDB の request 成功ではなく transaction 完了を保存成功条件に変更。abort/error を呼び出し元へ返す。
  - DB 初期化を共有 Promise に集約し、同時初期化による複数接続競合を防止。シナリオ単位の書込みを直列化して最新順を保証。
- **同期書込みの耐久性 (`src/services/SyncService.ts`)**:
  - タイマーの保留データを Firestore の durable write 成功まで保持し、失敗時の再試行対象を失わないよう修正。
  - WriteBloatGuardian の集約書込みを Promise 化し、呼び出し元が実際の集約処理完了／失敗を待てるよう変更。
- **再発防止**:
  - 保存 API は transaction 完了、ネットワーク API は durable write 完了を契約とする。
  - 集約・デバウンスを導入する場合は、acknowledgement と実処理完了を分離しない回帰テストを必ず追加する。

### [2026-08-02] v1.09 - 同期 capability セキュリティ移行・ショートカット回帰試験
- **共有同期のアクセス境界 (`src/utils/syncHelper.ts`, `App.tsx`, `SyncService.ts`, `firestore.rules`)**:
  - Timer / Handout の共有 URL を `crypto.getRandomValues` で生成する 256-bit capability ID に移行。旧来の `uid_scenario` 形式はクライアントと Firestore rules の双方で読書き拒否する。
  - Firestore は capability ID とドキュメント ID の一致を検証し、`list` を全面拒否する。公開閲覧は URL を知る利用者の単一 `get` のみに限定する。
  - 同期ドキュメントから平文 PIN と更新者 UID を除去。キャラクター別 Handout も独立した capability ID を永続化し、旧リンクには再発行を促す。
- **ショートカットの検証可能性 (`useGlobalShortcuts.ts`, `useGlobalShortcuts.test.ts`)**:
  - Sync Studio、メディア番号／前後、BGM、SE、タイマー開始停止・リセット、フェーズ、クイック操作、検索、利用者定義キーのルーティングを副作用のない dispatcher に集約。
  - 重点ショートカットのコールバック到達と `preventDefault` を Vitest で回帰試験化した。
- **Handout の競合・在席通知エッジケース (`SyncService.ts`, `SyncService.test.ts`)**:
  - 在席通知だけを同期した際に `setDoc` が既存の配布内容を置換し得る不具合を検出。Handout の全書込みを merge 更新へ統一した。
  - secure capability の Timer 書込み、旧 URL 拒否、Handout の在席通知単独更新をサービス結合テストで検証し、全60ユニットテストを通過した。
- **初期ガイドのリリース表示 (`constants.ts`, `constants.test.ts`)**:
  - 新規作成・アプリリセットで使う初期シナリオの更新情報を v1.09 に更新し、既存の利用者シナリオは書き換えない方針とした。
  - 初期データの更新フェーズが v1.09 を表示する限定テストを追加した。
- **配備上の注意**:
  - Hosting と `firestore.rules` は同じリリースで反映し、配備後に GM が新 URL を発行する。旧 QR / URL は意図的に利用不可となる。
  - `npm run verify` は lint、型検査、57 ユニットテスト、本番 build を通過した。実ブラウザでの Firestore rules 受入は preview channel 配備後に実施する。

### [2026-08-02] v1.08 - Firebase Hosting 配備健全性・型安全性・描画更新の是正
- **品質ゲートと依存関係 (`package.json`, `package-lock.json`)**:
  - lockfile を現行依存定義と整合させ、`npm ci` が成功する状態へ修正。
  - `typecheck` と `verify`（lint / typecheck / test / build）を追加し、`npm audit fix` 後のクリーンインストールで 0 vulnerabilities を確認。
- **型契約と既存データ互換 (`src/types.ts` と関連コンポーネント)**:
  - image 台本ブロック、旧フェーズ名、旧ショートカット、snapshot の `rules` / `outline`、画像更新時刻、同期画像 overlay 強度を正しい型へ反映。
  - 呼び出し側と Header / PhaseCard / Quick Actions / Troubleshooter / Modal の props 契約を一致させ、Quick Actions から検索・設定へ到達できるよう修復。
- **タイマー描画の局所化 (`App.tsx`, `useAppTimer.ts`, `PhaseCard.tsx`, `Header.tsx`, `PhaseSidebar.tsx`)**:
  - `App` の毎秒再描画を廃止。既存 Header の timer props 契約は維持し、wrapper と leaf component が `startTime` と残秒数から表示を算出する方式へ移行した。
  - タイムアップ検出は最短期限への one-shot timeout とし、終了時だけグローバル timer state を更新する。
- **Firebase Hosting と秘密情報 (`firebase.json`, `.firebaserc`, `vite.config.ts`, `README.md`)**:
  - SPA rewrite、アプリシェル／asset のキャッシュ方針、Firebase project alias、preview / production 配備手順を追加。
  - ブラウザ bundle へ `GEMINI_API_KEY` を埋め込む Vite 定義を削除し、README から不要な key 設定を除去。
- **リリース表示の整合 (`updateLogs.ts`, `Header.tsx`, `HelpModal.tsx`, `manual-a.html`)**:
  - 利用者に見える current version を v1.08 に統一し、今回の配備・型安全性・性能・残存セキュリティ注意を UPDATE LOG に追加。
- **残存する要承認セキュリティ改修**:
  - 公開同期ドキュメントの推測可能 session ID と平文 PIN は、Sync Studio / Firestore のイミュータブル・コアに関わるため未変更。`修正指示書_2026-08-02.md` の CB-029 に従い、所有者承認後に別変更として移行・rules test・preview 検証を行う。

### [2026-08-02] v1.07 - 画像・タイマー文字色・中間レイヤーのセット設定保持 & ショートカットアトミック連動 & ACID/UNIXリファクタリング
- **画像単位での「タイマー文字色（黒系/白系）」＆「中間レイヤー（黒/白/なし）」セット化 (`SyncConfig`, `MediaItem`, `SyncWindowModal.tsx`)**:
  - `ImageResource` および `SyncConfig.imageConfigs` に画像ごとのタイマー文字色・オーバーレイタイプを個別に保存するデータ構造を拡張。
  - 子画面設定モーダル (`SyncWindowModal.tsx`) で、選択中画像に対するタイマー文字色・レイヤー設定の保存トグルを実装。画像ギャラリーカード上に `T:白 | L:黒` バッジを表示。
- **ショートカットキー連動 & アトミック状態同期 (`App.tsx`, `useGlobalShortcuts.ts`)**:
  - 数字キー (`1`〜`9`)、ブラケット (`]`/`[` )、`Ctrl+Alt+I` 等による画像切り替え時に、選択された画像に紐づけられた `timerColor` と `overlayType` を自動抽出し、`SyncConfig` と `TimerSyncData` (Firestore) へアトミックに同期更新するロジックを追加。
- **ACID原則 & UNIX哲学に基づくリファクタリング**:
  - **Atomicity (原子性)**: 画像変更・文字色変更・レイヤー変更を単一の非分割状態更新・伝播処理としてアトミック化。
  - **Consistency (一貫性)**: 未設定画像や未選択時のフォールバック処理を純粋関数でカプセル化。
  - **Isolation (独立性)**: キーイベントハンドラとモーダル UI が同一の同期ディスパッチャを共有する疎結合構造。
  - **Durability (永続性)**: ローカル state と Firestore Channel への同期書き込み。

---

### [2026-08-02] v1.06 - 残り1分未満の緊急振動（ぷるぷる）エフェクト設定化 & 同期設定モーダルでの画像インデックス/ショートカット番号バッジ追加
- **残り1分未満の緊急振動エフェクトの ON/OFF 設定化 (`SyncConfig`, `TimerShareView.tsx`, `SyncWindowModal.tsx`)**:
  - `SyncConfig` および `TimerSyncData` に `urgentShakeEnabled` プロパティを追加。
  - 子画面設定モーダル (`SyncWindowModal.tsx`) のレイアウト設定エリアに「残り1分未満の振動エフェクト」の ON (振動あり) / OFF (静止) 切り替えトグルを配置。
  - `TimerShareView.tsx` で `urgentShakeEnabled` が `false` の場合、タイマー数字の `urgency-shake` アニメーションを無効化し、静止表示（パルス色変化のみ）にする制御を実装。
- **Sync Studio モーダルにおける画像番号 & キーバッジの視覚表示 (`SyncWindowModal.tsx`)**:
  - 画像ギャラリーの各サムネイル左上に、番号（`#1`, `#2`, ...）およびショートカットキー（`Key:1` 〜 `Key:9`）のハイコントラストなバッジを表示。
  - どの番号の画像がキーボードショートカット (`1`〜`9` / `Ctrl+Alt+1`〜`9`) で切り替わるかを直感的に視認可能に改善。

---

### [2026-08-02] v1.05 - グローバルキーボードショートカット (`Ctrl+Alt+I`, `]`, `[`, `1`〜`9`, `Ctrl+Alt+1`〜`9`) の動かない前提・原因根本解明と完全修正
- **`App.tsx` の認証非依存化（ローカルステート即時更新対応）**:
  - `handleControlVideo` 内で `if (!user) return;` によりユーザー非ログイン時や認証処理待ち時にショートカット経由の画像切替が一切動作しなかった根本原因を解除。
  - `user` がヌルの場合でも `setState` によるローカル表示画像・`syncConfig` 更新を即座に行い、`user` が存在する場合のみ Firebase への即時送信を行う堅牢な構造へリファクタリング。
- **ID欠落対策のフォールバック取得 (`triggerControlVideo`)**:
  - `combinedImages` 内のオブジェクトに `id` プロパティが存在しない・空の場合に `undefined` が `onControlVideo` に渡され無効化されていた問題を解消。
  - `item.id || item.url || item.name` を優先順位に従ってIDとして抽出し送信する `triggerControlVideo` ヘルパーを導入。
- **JIS配列・OS別キーイベント判定の強化 (`matchesKey`, `useGlobalShortcuts.ts`)**:
  - `]` (`BracketRight`) および `[` (`BracketLeft`) の判定を `matchesKey` 内で明示的にサポート。
  - モディファイアキーなしの数字キー `1`〜`9` および `Ctrl+Alt+1`〜`9` の `e.code` / `e.key` マッチングを整理し、テンキーや各種キーボード配列で確実に発火するよう強化。

---

### [2026-08-02] v1.04 - 子画面リアルタイム画像切替の即時同期 & タイムアップ時(00:00)表示保持機能の強化
- **Sync Studio モーダル (`SyncWindowModal.tsx`) 内での画像選択即時反映**:
  - モーダル内の画像ギャラリーで画像をクリックした際に、`onApplySync` を即座に発火させるように修正。「構成を同期」ボタンを押さなくても、画像選択の一発クリックで直ちに子画面にリアルタイム投影されるUXを実現。
- **子画面 (`TimerShareView.tsx`) でのタイムアップ時 (00:00) タイマー表示保持**:
  - カウントダウンが 00:00 に達した際、タイマー表示を非表示化・非活性化せず、鮮やかな赤色 (`text-red-500`) およびドロップシャドウで可視度の高い `00:00` 表示を維持。
  - `TIME UP` バッジのレイアウトをタイマー文字の上部に配置し、`00:00` の数字に重なって見えなくなる問題を解消。
- **媒体種別（`activeResourceType`）およびショートカット連動の修復 (`App.tsx`, `useGlobalShortcuts.ts`)**:
  - `App.tsx` の `handleControlVideo` 内で `activeResourceType` が一律 `'video'` に固定されていた不具合を修正し、`mediaItem.type` (`image` / `video`) に連動するように修復。
  - ショートカット (`]` / `[` / `Ctrl+Alt+I` / `1`〜`9`) における `activeImageId` の柔軟なID・名称一致判定ヘルパー (`findCurrentIdx`) を導入し、画像の「ひとつ右（次）」「ひとつ左（前）」およびダイレクト切替が確実に動作するよう最適化。

---

### [2026-08-02] v1.03 - グローバルキーボードショートカット (`Ctrl+Alt+1~9`, `Ctrl+Alt+W`, `Ctrl+Alt+I` 等) の完全バインド・ダイレクト画像送出拡張
- **ダイレクト画像送出ショートカット (`Ctrl + Alt + 1` 〜 `9`) の実装**:
  - キーボードから `Ctrl + Alt + 1` 〜 `Ctrl + Alt + 9` (および数字単体 `1` 〜 `9`) を押すことで、登録メディアリストの1〜9番目の指定画像へ直接ジャンプし、即時子画面へ投影・同期させる機能を実装。
- **グローバルショートカットフック (`useGlobalShortcuts.ts`) の強化**:
  - `e.code` (e.g. `Digit1`~`Digit9`, `Numpad1`~`Numpad9`, `KeyW`, `KeyI`, `KeyE`, `KeyG`, `KeyB`, `KeyS`, `KeyR`, `KeyN`, `KeyP`, `KeyQ`) および `e.key` の両方を確実にチェックする判定ロジックを実装。
  - `Ctrl + Alt + W` (子画面 Sync Studio 開閉) および `Ctrl + Alt + I` (連動メディア送り / Shift併用で戻り) の未実装・動作不全を解決。
  - `Ctrl + Alt + N` (次フェーズ), `Ctrl + Alt + P` (前フェーズ), `Ctrl + Alt + B` (BGM再生/停止), `Ctrl + Alt + S` (SE再生), `Ctrl + Alt + R` (タイマーリセット) 等の各種コンビネーション操作を完全補完。
- **イベントハンドラーの集約・競合排除 (`App.tsx`)**:
  - `App.tsx` 内で重複していた古いキーリスナーと重複フック呼出を削除・1箇所に統合し、イベント競合を完全にクリア。
  - 入力要素 (input / textarea / select / contenteditable) フォーカス中の誤誤爆防止ガードを保持。
- **ヘルプガイド・Web総合マニュアルの同期 (`ShortcutsGuideModal.tsx`, `public/manual-a.html`)**:
  - アプリ内ヘルプダイアログおよびWeb総合マニュアルに `Ctrl+Alt+1~9` / `1~9` のダイレクト画像送出ショートカット説明を追加掲載。

---

### [2026-08-02] v1.02 - Web総合マニュアルへのキーボードショートカット一覧 & カスタマイズガイド統合
- **Web総合マニュアル (`public/manual-a.html`) の拡張**:
  - 進行ウィンドウマニュアル（RUN SECTION 09）に爆速セッション進行のためのデフォルト・ショートカットキー早見表（`m`: BGM再生/停止, `k`: SE一括停止, `[`/`]`: 子画面メディア切り替え, `Space`: タイマー一括操作, `Ctrl+Alt+Q`: クイックパレット 等）を追加。
  - 編集ウィンドウマニュアル（EDIT SECTION 08）にショートカットガイドモーダルの起動・環境設定（Preferences）での自由なキーバインド再登録および入力衝突防止（テキストフォーカスガード）の解説セクションを追加。
  - 目次（TOC `tocRun`, `tocEdit`）に「09. キーボード操作」「08. キーボード操作」のアンカーリンクを追加。

---

### [2026-08-02] v1.01 - ヘッダー・進行エリア・全UI要素の完全不透明（ソリッドダーク）背景統一
- **赤枠内エリア（ヘッダー・進行ナビゲーション・サイドバー・メインエリア）の完全ソリッド背景化**:
  - ご指定に基づき、ヘッダー (`Header.tsx`)、フェーズナビゲーション (`PhaseProgressNav.tsx`)、タイマーヘッダー、および2-columnトップバー (`App.tsx`) を背景が透けない完全不透明な黒・ダークソリッド背景 (`bg-[#0a0a0b]`, `bg-zinc-950`) に復元。
  - テキストおよびUIエレメントの最高水準のコントラストと可読性を確保。

---

### [2026-08-02] v1.00 - 上部進行エリア・ヘッダー黒半透明レイヤー統合
- **最上部エリア（ヘッダー/フェーズナビ）への黒半透明オーバーレイ適用**:
  - `Header.tsx`, `PhaseProgressNav.tsx`, `App.tsx` の背景色指定を不透明黒 (`bg-black/90` / `bg-zinc-950/95`) から背景が綺麗に透ける黒半透明 (`bg-black/60`〜`bg-black/75`) ＋ `backdrop-blur-xl` へ再定義。
  - 最背面背景画像 (`App.tsx`) の `opacity-35` への微調整により、進行ウィンドウ全体で木目調/背景画像がほんのり透ける深みのあるダークデザインに統一。
- **z-index 体系の取得・評価・全階層保持**:
  - レイヤー構造（`z-0` 背景画像、`z-10` メイン、`z-40` プログレスバー、`z-50` ヘッダー、`z-[100]` タイマー、`z-[450]` ドロワー、`z-[1000]` モーダル、`z-[9999]` トースト）の重複・破綻がないことを検証し安全に適用。

---

### [2026-08-02] v0.99 - Webマニュアルの子ウィンドウ（Sync Studio）対応 & 3モード体系化
- **Web総合マニュアルの拡張 (`public/manual-a.html`)**:
  - 用語の統一とシンプル化（「進行ウィンドウ」「編集ウィンドウ」「子ウィンドウ」）。
  - マニュアル切替トグルを「進行（RUN）」「編集（EDIT）」「子画面（SYNC）」の3モード切り替え構造にアップデート。
  - 子ウィンドウ専用マニュアルセクションを新設。リアルタイム接続、集中制御パネル、動的メディア連動（`[[image_id]]` タグ）の詳細記述を追加。
  - **環境別構成例の整理**:
    - 【構成1】1台PCで完結（マルチディスプレイ / OBSキャプチャ）
    - 【構成2】ネットワーク接続端末（タブレット / スマートフォン / 別PC）
    - 【構成3】単機能液晶 / 外部モニター（Miracast / AirPlay / 映像伝送）
  - 各説明セクションに明確なテキスト記述入りの画像プレースホルダーを設置。

---

### [2026-08-02] v0.98 - クオリティゲート強化・セキュリティ/セッション堅牢化・Tailwind CSS統合
- **P0系 重大障害・脆弱性の完全修復**:
  - `lastAutoSnapshotTimeRef` 未定義参照エラーによるクラッシュを修正 (`App.tsx`)。
  - 高精度同期タイマー `useAppTimer` の `now` 変数の定義を復元し、コンポーネントレンダリング時の `now is not defined` 実行時エラーを修正 (`App.tsx`)。
  - `EasyEditorBlock.tsx` における `DOMPurify` を用いた XSS サニタイズ処理の徹底導入。
  - `firestore.rules` における機密サブコレクション (`private/gm`, `private/{docId}`) のセキュリティ境界の強化。
- **P1系 コア機能・データ整合性の修復**:
  - セッション一時停止 (`handleTogglePause`) 時の高精度タイマー経過時間補正の追加 (`App.tsx`)。
  - Firestore `SyncService` における非同期フラッシュ書き込み同期の修正。
  - IndexedDB (`StorageService.ts`) における `VersionError` 自動回復フォールバックの追加。
  - シナリオデータ移行・正規化パイプライン (`scenarioValidator.ts`) の調整およびテスト全通。
  - `eslint` (エラー0/警告0)・`tsc` (型エラー0)・`vitest` (45/45 テスト全通) のクオリティゲート達成。
- **P2系 ビルド・アセット最適化**:
  - Tailwind CSS (`tailwindcss`, `@tailwindcss/vite`) のローカル npm パッケージ化とビルド最適化。

---

### [2026-08-01] v0.97 - GM向けクイックアクションメニューの追加
- **GMタスク効率化 (`QuickActionsModal.tsx`)**:
  - 音声の一括停止 (Stop All Audio) やタイマーの即時リセット (Reset Current Timer) を行える `QuickActionsModal` を追加。
  - `Ctrl+Alt+Q` で起動可能。
  
---

### [2026-08-01] v0.96 - ショートカットキーの競合防止および堅牢化対応
- **ショートカットキーのブラウザ標準競合回避 (`PreferencesModal.tsx`, `useGlobalShortcuts.ts`)**:
  - ブラウザの標準ショートカット（`Ctrl+S`, `Ctrl+P`, `Space`スクロールや矢印キーなど）と重複・競合しないよう、デフォルトのショートカットキーを安全なキー（BGM: `m`, SE: `k`, 画像次へ: `]`, 画像前へ: `[`, タイマー: `Space`（特殊ハンドリング））に見直し。
  - 大文字小文字の差異を吸収し、確実に動作するケースインセンシティブ判定および `preventDefault()` を強化。

---

### [2026-08-01] v0.95 - 万年筆ロゴのサイズ拡大 (+20%) および左方向へのシフト調整
- **ヘッダーロゴ装飾の調整 (`Header.tsx`)**:
  - 万年筆ペン先画像のサイズをさらに20%拡大 (`w-14 h-14 md:w-20 md:h-20`)。
  - 画像の配置位置を「C」の文字サイズ分さらに左にシフト (`-left-5 md:-left-8`)。

---

### [2026-08-01] v0.94 - バグ修正（scenario未定義対策）および万年筆ロゴ角度の微調整
- **グローバルショートカットの安全性向上 (`useGlobalShortcuts.ts`)**:
  - `scenario` が未定義の場合に `TypeError` が発生する不具合を修正するため、ガード節 (`if (!scenario) return;`) を追加。
- **ヘッダーロゴの万年筆画像角度調整 (`Header.tsx`)**:
  - 万年筆ペン先画像の回転角度を右に10度 (`rotate-[10deg]`) に変更。

---

### [2026-08-01] v0.93 - ロゴ装飾（文字群のオフセット・万年筆画像の拡大と回転）の調整
- **ヘッダーロゴ装飾の微調整 (`Header.tsx`)**:
  - 「CueBook」の文字群全体をCの文字サイズ程度右にシフト (`pl-2 md:pl-3`)。
  - 万年筆のペン先画像 (`nib.png`) を3割拡大し、見出しに合わせた角度 (`rotate-[10deg]` へ調整) に回転させて配置を最適化。

---

### [2026-08-01] v0.92 - 左上ロゴへの万年筆画像装飾の追加
- **ヘッダーロゴ装飾 (`Header.tsx`)**:
  - 左上の「CueBook」ロゴの「C」の文字の背後に万年筆のペン先画像 (`nib.png`) を重ね合わせ、より洗練されたブラッシュアップされたデザインを実現。

---

### [2026-08-01] v0.91 - トースト表示時間の拡張 (9秒化対応)
- **トースト・コピー完了通知の延長 (`NetworkToast.tsx`, `SyncWindowModal.tsx`, `HandoutModal.tsx`, `SyncTroubleshooter.tsx`, `ErrorBoundary.tsx`)**:
  - 各種トーストおよびコピー完了通知の自動非表示時間を、ユーザの要望に合わせて9秒（9000ms）に拡張。

---

### [2026-07-31] v0.90 - コードレビュー・重大デバッグ修正の完了 (CB-001 〜 CB-019 準拠)
- **フローティングタイマー修正 (`useFloatingTimer.ts`, `App.tsx`)**:
  - `isNearDock` および `handleDockedDragStart` の未定義起因による初期表示 System Recovery クラッシュを完全解消。
- **XSS セキュリティ強化 (`markdown.ts`)**:
  - `marked.parse()` の出力に対して `DOMPurify.sanitize()` を適用し、悪意あるスクリプトインジェクションを防止。
- **Firestore セキュリティルール改修 (`firestore.rules`)**:
  - `timerSessions` および `handouts` コレクションにおける無制限な一括 `list` クエリを制限し、セキュリティとプライバシーを向上。
- **データ移行・シナリオ検証の堅牢化 (`scenarioValidator.ts`)**:
  - フェーズ内複数タイマー、サウンドプロパティ (`description`, `color`, `triggerMode`)、キャラクター追加属性 (`playerName`, `secretHandout` 等) の移行時のデータ損失を完全防止。
- **差分スナップショットキーの拡張 (`snapshotHelper.ts`)**:
  - `soundClusters`, `syncConfig`, `timerDisplayPosition`, `audioPreferences` などの設定キーを `keysToDiff` に追加し、自動/手動スナップショットにおける設定保持率を100%に向上。
- **ヘッダータイマー操作の結線 (`Header.tsx`)**:
  - ヘッダー内の各種タイマーボタン (`onToggleTimer`, `onResetTimer`, `onAdjustTimer`, `onPrevTimer`, `onNextTimer`) のプロップス配送とハンドラ呼び出しを正常化。
- **フォント・スタイリング最適化 (`index.html`)**:
  - `Inter` および `JetBrains Mono` フォントを導入し、デザインガイドラインに完全準拠。

---

### [2026-07-31] v0.89 - メディアカードインタラクション (.product__media) 強化
- **インタラクションアニメーション (`MediaTab.tsx`)**:
  - メディア要素カード (`.product__media`) に対して、ホバー時に繊細な拡大効果 (`hover:scale-[1.02]`) とスムーズなイージング・トランジション (`transition-all duration-300`) を実装。

---

### [2026-07-31] v0.88 - ショートカットガイドUI幅の広幅化 & 非途切れタイポグラフィ最適化
- **ショートカットガイドモーダル拡張 (`ShortcutsGuideModal.tsx`)**:
  - モーダルの最大横幅を `max-w-2xl` から `max-w-4xl` へ拡大し、各キー項目と説明文の可読性を大幅に向上。
- **UI折り返し防止（Anti-wrapping & Hallmark Spec）**:
  - ボタンラベル、タブスイッチ、キーコードバッジ（`<kbd>`）、タイトル等において不意な単語途中改行が発生しないよう `whitespace-nowrap` および `shrink-0` を徹底適用。

---

### [2026-07-31] v0.87 - ショートカットキーガイド強化 & メディア番号順序並び替え機能の実装

#### 1. モード別ショートカットガイドの統合 (`ShortcutsGuideModal.tsx`)
- **概要**: 進行画面 (Play) と編集画面 (Editor) のそれぞれの操作に特化したショートカットキー一覧を、テキストベースでタブ切り替え表示できるよう刷新。
- **UI表示箇所の拡張**:
  - **進行画面**: ヘッダーのアクションエリアおよびハンバーガーメニュー内から「ショートカット一覧」をワンタップ起動可能に設定。
  - **編集画面**: エディタツールバーに `Keyboard` アイコンを配置し、編集用ガイドへ直ちにアクセス可能。

#### 2. 画像の自動番号付与および順序並び替え機能 (`MediaTab.tsx`)
- **概要**: メディア管理画面内の全カードに配列インデックスに基づいた番号バッジ (`#1`, `#2`, `#3`...) を付与。
- **操作性向上**: カード右上に `ChevronUp` (↑) / `ChevronDown` (↓) ボタンを追加し、1クリックで画像の移動・順番の入れ替えを可能に改善。

#### 3. 数字キー 1〜9 によるワンキー画像投影連携 (`useGlobalShortcuts.ts`)
- **概要**: 進行モード時、入力フォーカス外において数字キー `1` 〜 `9` を押下することで、登録順序の `#1` 〜 `#9` の画像を直接子ウィンドウ (Sync Window) に投影するロジックを確立。
- **循環ショートカット**: `Ctrl + Alt + I` (次へ) / `Ctrl + Alt + Shift + I` (前へ) による画像の順次巡回機能を維持・統一。

---

### [2026-07-30] v0.86 - UI 最適化、タイマーポーズ安定化 & レスポンシブ修正
- **ハイブリッド・サイドバー**: SyncWindowModal において QR コード・URL・小型 Live Preview を集約。
- **高精度タイマーポーズ処理**: 内部変数のスコープ修飾子を正しく修正し、一時停止時のドリフト補正誤差を排除。
- **画像ロード安定化**: 空の `src` 属性による不要なネットワークリクエストをシャットアウト。

---

### [2026-07-28] v0.85 - 音響クラスター (Sound Clusters) ＆ インプットデバウンス導入
- **Sound Clusters**: BGM/SE のマルチ発動プリセット機能、および「再生中を保存」ボタンの導入。
- **入力デバウンス**: `Sound Name` や `URL` 入力時の過剰な全体再描画を防ぐため、400ms デバウンス処理を適用。
