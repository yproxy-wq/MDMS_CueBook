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
- **Firebase設定**: デプロイ時は `VITE_FIREBASE_*` 環境変数を優先し、`firebase-applet-config.json` はAI Studio・ローカル実行用の公開Web SDK設定フォールバックとして使用する。サービスアカウント鍵などの秘密情報はリポジトリに保存しない。

### シナリオ切り替えと表示設定の整合性
- 管理モーダルは選択成功を待って閉じる。進行中タイマーの確認が必要な場合は管理モーダルを閉じ、確認画面を前面に出す。待機中は操作を無効化し、未完了・失敗はモーダルを残して案内する。クラウド設定は許可された表示／音響設定だけを適用し、ID・タイトル・本文・音源配列の上書きを禁止する。旧セッションにtimerStatesがない場合は初期タイマーを使用する。
- 内蔵ガイドは初回自動保存完了前でもシナリオ一覧から選択可能とし、保存キーとデータ内IDが異なる旧データは、キーのシナリオIDを保ちながら内容を復元する。
- シナリオ切り替え前に元のセッションを保存し、切り替え先の保存セッションから進行対象／閲覧対象フェーズ・タイマー・進行記録・同期設定を復元する。初回読み込みも同じ復元処理を使用する。稼働中のseconds/startTimeは保持し、削除済みIDと無効な基準時刻は初期値へ補正する。

- タブ間の現在シナリオ連携は `useScenarioChannel` が管理する。接続と初回問い合わせは準備状態・アカウントの変化時のみ行い、シナリオ・台帳・設定変更で再接続しない。受信は最新の状態を参照し、自タブのメッセージと並行した重複切り替えを抑制する。
- クラウド設定の取得中にシナリオやローカル設定が変わった場合、古い応答を現在の設定へ適用しない。

### デフォルトデモシナリオ
- `DEMO_SCENARIO`（ID: `demo-edge-case-cannot-be-swept`）を初回のシナリオ台帳更新時にIndexedDBへ登録する。
- 2フェーズ（概要・GM注意事項／プレイヤー導入・キャラクター）と7名のPCを持ち、「マイシナリオ」の切り替えデモに使用する。
- `DEMO_DARUMA_SCENARIO`（ID: `demo-daruma-san-ga-koroshita`）も同様に初回登録し、2フェーズと5名のPCを持つ。
- 両デモ台本はMarkdownの見出し（H1〜H3）、太字、箇条書き、番号付き手順、引用ブロック、キャラクター表を初期書式として保持する。
- マイシナリオ台帳の表示上限は16件。シナリオ一覧末尾に、現在端末のシナリオを登録する「＋」ボタンを表示する。

---

## 2. 主要機能一覧 (Feature List)

### A. 進行・同期・マルチ画面制御 (Sync Studio & Projection)
- **GM・子画面ラップ通知**: 実際の残時間でラップ到達を判定し、同じタイマーの通常同期・一時停止／再開では各ラップの帯・チャイムを1回だけ通知する。途中参加時の経過済みラップは通知しない。タイマー／フェーズ／ラップ設定切り替え、残時間を増やすリセットで通知履歴を再設定する。オーバーレイは8秒で終了し、古い終了予約は新しい通知・リセット・アンマウント時に解除する。通知履歴は `LapNotificationTracker` が各画面内で保持し、タイマーエンジン・同期形式は変更しない。
1. **Sync Studio (同期ウィンドウ管理)**:
   - 子ウィンドウ (プレイヤー向け投影画面) のリアルタイム制御。
   - 開始／停止／リセットボタンはクリックイベントを引き渡さず、既存タイマーハンドラーを引数なしで呼ぶ。各ボタンに操作名のaria-labelを付与する。
   - QRコード表示、アクセスURL発行、Live Preview シミュレーション。
   - 表示要素（Visible/Hidden）、配置（Top/Bottom）、拡縮（FILL/WIDTH/HEIGHT）のリアルタイム反映。
   - 投影コンテンツは番号付きのプルダウンで即時選択・同期する。従来のサムネイル一覧も同じSync Studio内で「サムネイルで選ぶ」から必要時だけ開け、一覧を閉じた待機中はサムネイルを描画しない。
2. **画像・メディア番号指定 & ワンキー投影 & 画像セット設定 (Number Key Projection & Per-Image Set Config)**:
   - 登録された共有画像/メディアに自動的に順番番号 (#1, #2, #3...) を付与。
   - 進行画面でキーボードの数字キー `1` 〜 `9` や `]` / `[` / `Ctrl+Alt+I` を押すことで、該当番号の画像を即時に子ウィンドウへ投影。
   - **画像セット連動設定 (v1.07)**: 各画像に「タイマー文字色（黒系/白系）」および「中間レイヤー（黒/白/なし）」を個別のセットとして保存保持。画像の選択・キー切り替え時に該当設定がアトミックに適用・同期される。
    - Sync Studioの番号表示とショートカットは同じ順序付きメディア一覧を使用する。プレイヤー共有画像が存在する場合はそれを優先し、存在しない場合のみ通常画像／ローカル映像へフォールバックする。
    - **PDFページ単位投影**: PDFメディアは `pdfPage` をFirestore同期し、子ウィンドウのタイマー下層へ指定ページを1ページ単位・ページフィットで表示する。ローカル/Data URLは子ウィンドウ内でBlob URLへ変換して表示し、外部URLはGoogle PDF Viewerのページ指定を使用する。
    - PDF表示中は画像切替と同じ `[` / `]` で前後ページ、数字キー `1`〜`9` でページ番号を直接指定する。
    - Sync StudioのPDF選択時は、設定画面のページ番号入力から任意ページを直接表示・同期できる。
    - PDF本体がFirestore同期上限を超えた場合、子ウィンドウ側で動画と同様にローカルPDFを再選択して表示できる。
    - Sync StudioではPDF解析後にページ番号一覧を表示し、ページボタンのクリックで指定ページを即時同期する。解析失敗時はページ入力と子ウィンドウ側再選択を利用できる。
    - 公開Dropbox PDFは本体を同期せず、変換済みURL文字列のみを同期し、子ウィンドウのPDFビューアで直接取得する。
    - PDFページ画像アセットは、PDFのSHA-256由来の世代IDで管理し、Firestoreへはメタデータのみを保存する。変換画像は1ページずつBlobとして保存先へ渡し、全ページをメモリ・Firestoreへ保持しない。
    - Dropbox App folder連携はFirebase Functionsを経由する。OAuthトークンは暗号化してFunctions専用領域に保持し、フロントエンド・子ウィンドウ・Firestore共有セッションへ平文トークンや恒久URLを送らない。
    - ブラウザから呼ぶCallable FunctionsはCloud Runの入口を`public`に設定し、関数内のFirebase Authentication検証で所有者を必ず認可する。子ウィンドウの短期URL発行のみ、共有capabilityを追加の認可境界とする。
    - OAuthコールバックは`state`と認可コードの存在を先に検証し、不正または期限切れのリクエストをHTTP 400で拒否する。
    - Dropboxトークン交換の失敗時は、認可コード・App Secretをログ出力せず、DropboxのHTTP状態とエラー種別だけをFunctionsログへ残して設定不備を診断可能にする。
    - Sync StudioからDropbox認可ポップアップを開き、ローカルPDFをページごとにWebP化してDropbox App folderへ直接アップロードできる。生成済みアセットはプレイヤー共有メディアとして追加され、ページ番号一覧・数字キー・`[` / `]`で切り替える。
    - 子ウィンドウは`pdfAssetId`と共有capabilityから1ページ分の短期URLをFunctionsへ要求して表示する。短期URLは有効期限の5分前に再取得し、PDF本体やDropbox認証情報は同期しない。
3. **高精度同期タイマーエンジン**:
   - 進行画面のコンパクトタイマー（1・2カラム）は数字の最初のタップで半透明の「開始／停止」ボタンを数字上へ表示し、2回目のボタン操作で既存のonToggleTimerを呼び、閉じる。初回タップではタイマーを変更しない。設定は隣接する44pxボタンへ分離する。
   - TimerTapControlのローカルisOpenだけで表示を管理し、Escape・外側pointerdown・フォーカス移動で閉じる。Escape／実行後は数字へフォーカスを戻し、対象タイマー／シナリオ変更時は確認状態を破棄する。操作対象は44px以上、ネイティブbuttonとaria-label／aria-expandedでキーボード操作にも対応する。
   - `startTime` (基準時刻) に基づくドリフト補正リアルタイムタイマー。
   - Firebase Firestore (`SyncService`) を介した複数端末・子ウィンドウ間での1秒未満精度同期。
   - 同一同期パスへの短時間連続更新は最新ペイロードへ集約するが、集約中のすべての呼び出しはFirestoreへの耐久書き込みが成功または失敗するまで完了扱いにしない。ローカル同期済みキャッシュは耐久書き込み成功後にだけ更新する。
   - フェーズタブは台本の閲覧対象だけを変更する。タイマーは専用操作欄の開始・再開・一時停止・リセット操作でのみ変化し、その操作時に同期対象フェーズを更新する。
   - AppState.currentPhaseId はタイマー／同期対象、AppState.previewPhaseId はGMの閲覧対象として意味を分離する。導出は共通セレクターを使用し、推奨BGMは閲覧対象、送信タイマーはタイマー対象から取得する。
   - 同期メディアは syncConfig.activeImageId を正とし、旧 activeImageId は移行中のUIミラー／旧データ用フォールバックとして扱う。タイマー表示は timerEnabled かつ timerForceHidden ではない、という共通判定を使用する。
   - 進行画面の1段ライブ操作バーから、プレイヤー画面のタイマー表示を直接変更し、詳細ボタンからSync Studioを開ける。ライブ操作バーには画像／PDFの投影選択UIを置かず、投影メディアの操作はSync Studioおよび台本内の既存操作へ集約する。各経路は正規化済みsyncConfig更新を通し、詳細設定・ライブプレビュー・子画面で同じ状態を参照する。
   - フェーズ開始・終了・完了・進行ロックの操作UIは凍結中として進行画面・編集画面から非表示にする。既存データ項目は読込互換のため保持する。
4. **共有 capability セキュリティ (v1.09)**:
   - Timer と Handout の共有 URL は `crypto.getRandomValues` で生成した 256-bit の不透明 ID を capability として用いる。URL を知る端末だけが単一の共有ドキュメントを読める。
   - Firestore rules は capability ID とドキュメント ID の一致を検証し、コレクション `list` と旧来の推測可能 URL を拒否する。平文 PIN と更新者 UID は共有ペイロードに含めない。
   - 所有者は安全な共有IDであればドキュメント作成前から購読できる。公開閲覧は、既存ドキュメントの capability 一致が引き続き必須。
   - capability URL は秘密情報として扱う。誤送信時は対象シナリオ／キャラクターで新しい共有 ID を発行し、既存 URL を使わない。

### B. 音響制御 (Audio Engine & Sound Clusters)
- 全音声停止はAudioService.stopAllへ接続し、再生表示と開始待ちの処理も解除する。SEの再生終了点をバッファ再生へ反映する。編集試聴は単一の操作可能な再生経路で停止／再開・先頭操作を行う。
- 音源削除は再生停止を伴い、削除直後に「元に戻す」で一覧の元の位置へ復元できる。
- GM音源カードのフェード／ループチップは状態表示とし、設定変更は編集画面から行う。カードの操作はキーボードフォーカスでも表示し、各ボタンに操作名を付ける。
- マスター音量とVOICE操作は44px以上の操作領域・アクセシブル名と状態を持つ。狭幅と編集画面ではヘッダーに常駐する。狭幅ヘッダー／進行操作は重なりを避けて折り返し、ポップアップ幅は画面内に収める。
- コンパクトタイマーの設定ボタンはSync Studioを直接開く。数字の2手開始／停止を維持する。音響パネル入口は再生記号ではなくスライダー記号を使う。
- リセット長押しはSpace／Enterにも対応し、キーを離す・フォーカス喪失・ポインター取消で予約を解除する。

- 音源編集の名前／URLは最新の更新コールバックで保留値をまとめて保存し、フォーカス離脱時に確定する。音源切り替え時は入力コンポーネントを音源IDで切り替え、古い予約を解除する。検索中の音源並べ替えは検索前の一覧の音源ID・位置を使用する。
1. **Web Audio API 統合制御 (`AudioService.ts`)**:
   - 単一の Web Audio Context による BGM/SE バッファキャッシュおよび非同期再生。
   - ループ再生、フェードイン/フェードアウト、独立ボリュームコントロール。
   - 音源編集は音源名・種別、URL／端末読み込み・音量・試聴を常駐させ、再生範囲・ループ・フェード・排他グループを現在値の要約付きdetailsへ集約する。初期は折りたたみ、OFFのループ／フェード入力は収納し、値は保持する。フェード入出力は横並び（狭幅は縦）で、曲線選択とプレビューを維持する。
   - 音源一覧の検索・追加操作は狭幅で折り返し、入力と操作領域は44px以上を確保する。
   - SoundSettingSectionはブラウザのdetails状態で開閉し、音源切替時は閉じた状態に戻る。数値・曲線・キャプチャ等は既存のonUpdateとAudioService経路を使用し、名前400ms／URL500msのデバウンスを維持する。主要操作・入力は44px以上、数字にはJetBrains Monoを使用する。
   - フェード曲線は直線を既定値として、ゆっくり開始・ゆっくり終了・なめらかを音源ごとに選択できる。設定画面は入出力ごとの曲線をプレビューし、AudioServiceだけがWeb Audio APIのゲイン変化へ反映する。
   - 進行画面には、状態に応じた推奨BGMの主操作、子画面タイマー表示切替、Sync Studio導線の最大3アクションだけを置く。2カラム画面はフェーズタブだけの段を最初に置き、その直下の進行操作段へ大型タイマー、「推奨BGMの即再生 → 音響パネル → 推奨BGM変更」、子画面タイマー表示切替、Sync Studio導線を1段に集約する。設定済みの推奨BGMは曲名付きの主ボタンを1回押すだけで再生／停止でき、未設定時だけ同じ主ボタンから選択画面を開く。推奨BGMは再生中の1曲を優先し、未再生時は先頭の1曲だけを表示する。複数曲を横並びにせず、変更アイコンからフェーズ別の推奨BGMを設定する。既存のSE推奨設定は保持する。
   - フェーズ編集画面では、推奨音源として選ばれた音源をアンバーの枠と背景で表示し、折りたたみ時の要約チップも同じ色で示す。音源種別（BGM／SE）とは独立した「推奨」状態の視覚表現として扱う。
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
   - 恒久的な素材保存先は Cloudflare R2 を採用する。Firebase Authentication と Firestore の既存認可・台帳は維持し、Firebase Functions がR2の短期アップロード／閲覧URLを発行する。クライアントにはR2の恒久鍵を渡さない。
   - CueBookストレージはBizプランだけが利用できる。FunctionsがBizクレーム、ユーザー合計1GB、シナリオ250MB、単一素材100MB、対応MIME型を検証してから5分有効のR2 URLを発行する。
   - 編集画面のCueBookストレージ操作は、`cuebookPlan=biz` クレームを確認した利用者だけが有効になる。非Biz・未ログイン利用者にも操作欄はグレーアウト表示し、Biz専用であることを示す。対応形式はJPEG／PNG／WebP／GIF／PDFで、動画・Dropbox URL・端末直接追加は既存経路を維持する。
   - R2メディアはシナリオに `r2://<assetId>` と容量メタデータだけを保存する。GM画面は所有者用、子画面は共有capability用の短期URLを必要時に取得し、期限の1分前に更新する。短期URL・R2鍵をシナリオ／Firestore共有セッションへ保存しない。
   - タイマー共有には `r2AssetId` のみを渡し、シナリオを開いたときは参照中のR2アセットをtouchして60日未参照判定を更新する。
   - R2アセットは最後にシナリオから参照された時刻を記録し、60日間未参照の素材を毎日03:30（日本時間）に削除する。未完了アップロードは24時間で回収する。
   - **Biz専用音声保存**: `VITE_CUEBOOK_TENANT=xtv` の音源編集だけに44px以上の「音声をCloudflareに保存」を表示する。Bizクレーム確認後のみ操作可。MP3／WAV／OGG／M4A／AAC／FLAC／WebM、1ファイル100MBまで。Functionsでも配備先 `cuebook-biz-xtv` とBizクレームを確認し、他の配備先では音声の新規保存を拒否する。
   - **Biz音源一覧の端末間同期**: Bizクレーム確認後、`users/{uid}/audioLibraries/{scenarioId}` を購読し、曲名・種類・URL・音量・範囲・ループ・フェード・順序・R2アセット情報を同一アカウント／シナリオへ同期する。再生開始・停止や再生位置はこの一覧へ含めない。シナリオ台本・タイマー同期とは別の保存先とし、通常版では接続しない。
   - サーバー由来の初回スナップショットを待ってから書き込みを許可する。空の初期端末は未作成一覧を初期化せず、既存端末の音源を消さない。書き込みは500msで集約し、Firestoreトランザクションの最新一覧に端末の差分だけを反映する。同時編集は音源ID／フィールドで統合し、別端末による削除を古い編集で復活させない。
   - 未保存の差分はアカウント／シナリオ別に端末へ保持し、失敗時は2〜30秒の間隔で再試行する。同一障害で通知を反復しない。シナリオ退出時にも保存を開始し、遅延応答を別シナリオへ適用しない。同期用の一覧は1000音源・JSON 800KB以下とする。
   - `blob:`／`data:` の端末専用音声URLはクラウドへ保存せず、元の端末でのみ保持する。別端末での再生は通常URLまたはCloudflare保存が必要。R2署名URLや秘密鍵は一覧へ保存しない。同梱ガイドと2つのデモは端末内に未保存でもURLのシナリオIDから初回復元する。
   - 音声は既存R2容量枠（ユーザー1GB／シナリオ250MB）を画像・PDFと共有する。保存確定後にだけ音源URLを `r2://<assetId>` へ置換し、失敗時は既存URLを維持する。保存待ちの名前・URL編集は新しいURLと原子的に統合し、古いデバウンス更新による上書きを防ぐ。
   - `R2AudioPlayback` は所有者の短期GET URLから音声全体を取得し、ユーザー別のBlob URLキャッシュを既存AudioServiceへ渡す。短期URL失効によるBGMの中断を避け、通常URLの再生経路は維持する。待機中の停止／全停止／排他グループ／シナリオ変更・アンマウントで古い再生要求を無効化する。取得エラーをGM通知／試聴エラー欄へ表示する。
   - 音声のアセットIDも参照更新に含める。シナリオ容量台帳は有効なドキュメントパス `users/<uid>/storageScenarioUsage/<scenarioId>` を使用し、クライアントからは変更できない。
   - Biz XTVの正規URLは `https://qbook-biz-xtv.keikeilab.net`（Firebase Hosting: `https://cuebook-biz-xtv.web.app`）。Biz配備ワークフローは `firebase.r2.json` の独立した `r2` codebaseでR2サーバー6関数とFirestoreインデックスを先に配備してからHostingを更新する。共通ソースのR2コンパイル成果物を `functions-r2` へ準備し、未使用のDropbox秘密鍵・設定を要求しない。`deploy_r2_functions=false` は既存サーバーを更新しない配備用。設定・検証手順は `Biz-R2-Setup.md` に記載する。
   - R2への移行完了までは、Dropbox追加・直接アップロード・URL入力を互換経路として維持する。既存のDropbox PDFアセットは読込継続し、新規のR2アセットと同じメディアID／短期URL契約で扱う。
   - 無料枠を守る初期運用は、シナリオあたり画像10枚を約7MB、PDFは1ページ約1MB・50ページを約50MBの計画目安とする。上限値・超過時の警告・削除はR2実装時にクライアントとFunctionsの両方で検証する。
3. **変更検知トースト表示 (EditorView)**:
   - シナリオデータ変更時に右下にアニメーション付き "Changes Saved" インジケーターを自動表示（表示時間は9秒に統一）。
4. **階層的台本進行**:
   - 台本のMarkdown／アウトライン本文は複数選択して、同一タブレット上のプレイヤー本文専用表示へ渡せる。専用表示ではGM用のタイマー、BGM、タブ、チェックリスト、画像・PDF操作を隠し、本文のページ移動と文字サイズ調整だけを提供する。
   - フェーズ管理 (`ScriptViewer`)、アウトライン編集 (`OutlineEditor`)、キャラクター別資料配布 (`HandoutModal`)。
   - アウトライン折り畳み状態は台本ブロックごとに管理し、次の同階層または上位階層で閉じた枝の影響を終了する。Markdownの`details`は入れ子・兄弟要素の境界と開閉状態を保持する。
   - 長い台本は初回15ブロックを描画し、スクロール接近または「続きを表示」で15ブロックずつ追加する。
   - GM進行画面のキャラクター一覧、トークン／フラグ管理、個別通知の新規発行は撤廃する。既存の個別資料URLは読込互換のため維持するが、GM画面からは開かない。
5. **シナリオ入出力**:
   - `.json`、`.zip`、`.cuebook`を受け付ける。`.cuebook`はZIPコンテナ内のシナリオJSONを展開して検証・読み込む。
   - 新規エクスポートは標準の .zip に統一する。旧 .cuebook／プレーンJSONは後方互換として読み込みを継続する。
   - タブレットを含む端末差に備え、ZIP署名を優先して形式判定し、標準JSON／ZIP MIME型もファイル選択条件へ含める。

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
   - Biz-Xtv ビルド（`VITE_CUEBOOK_TENANT=xtv`）では、ロゴ右側に `dot-x.png` のXTVブランドマークを表示する。Dev／Stableおよび他店舗テナントには表示しない。
4. **GM向けクイックアクション (`QuickActionsModal.tsx`)**:
   - `Ctrl + Alt + Q` で起動可能なクイックアクションダイアログ。全音声即時停止、タイマーリセット、フェーズ検索、同期設定、各種設定へワンタップアクセス。
5. **ネットワーク・同期シューター (`SyncTroubleshooter.tsx`, `NetworkToast.tsx`)**:
   - 復旧通知は直前の接続状態を先に更新し、不良→正常の遷移につき1回だけ9秒間表示する。正常状態の連続通知で延長／再表示しない。新たな障害は復旧表示より優先し、閉じる・アンマウント時は通知タイマーを解除する。restoredTimerRef／reconnectTimerRefはNetworkToast内だけで管理する。
   - Firestore クォータ・ネットワーク状態は通知とSystem Recoveryで案内する。常時表示される「同期がうまくいかないときは？」診断バーは設けない。
   - ヘッダーには正常時の同期ステータスを常駐表示しない。通信不安定・オフライン・クォータ超過時だけ、状態と復旧情報を表示する。
6. **利用者向けUpdate Log (v0.98-dev)**:
   - 表示用のリリース識別子は `src/config/version.ts` の `APP_VERSION` を正とし、ヘッダー、ヘルプ、初期ガイド、Update Logで v0.98-dev を一貫して表示する。
   - 表示内容は利用者向けのシナリオ管理・ショートカット改善・細かなバグフィックスに限定し、v1.08 / v1.09 の技術履歴はアプリ内のUpdate Logに表示しない。
7. **縦タブレット GM本文圧縮**:
   - 縦向きかつタブレットレイアウトの進行画面では、ヘッダーとフェーズ列を48pxへ圧縮し、表示中フェーズと推奨BGMを常駐させる。
   - 2カラム進行画面はヘッダー、フェーズタブ段、進行操作段、GM本文の順に配置する。タイマーの開始・停止・リセットは進行操作段へ一本化し、重複表示しない。試験用の案切替・自動収納は設けない。
   - 進行操作段はコンテナ幅に応じて間隔・横余白・タイマー文字を縮小し、短い画面高ではフェーズ段と操作段の高さも圧縮する。粗いポインターでは主要な操作領域を44px以上に保つ。
8. **マイシナリオと端末ローカルファイル紐づけ**:
   - ハンバーガーメニューの「シナリオ管理」から、Googleアカウントに紐づいたシナリオ台帳を表示・切り替えできる。
   - FirestoreにはシナリオID、タイトル、更新日時、設定、ファイルfingerprintだけを保存し、シナリオ本体・画像・音声バイナリは保存しない。
   - IndexedDBの`scenarios`は端末内のシナリオ本体、`scenarioBindings`は端末ごとのファイル紐づけを保持する。未紐づけ、利用可能、更新版確認を明示する。
   - 同一`scenarioId`でfingerprintだけが変わったファイルは更新版として確認し、IDが異なるファイルは現在のシナリオを変更せず拒否する。
   - `/session?scenarioId=<id>` および `/edit?scenarioId=<id>` を直接開け、ブラウザの戻る／進むでも切り替える。未紐づけの場合はファイル選択へ誘導する。
   - `scenarioId` の変更により非同期読み込みが重複した場合、最後に開始した要求だけがアプリ状態と準備完了状態を更新する。古い要求の完了・失敗は現在表示中のシナリオを上書きしない。
   - シナリオ管理は中央モーダルで一覧・登録・端末紐づけ・入出力・リセットを扱う。`Ctrl/Cmd + Shift + 1〜9` は一覧順のシナリオ切り替えに予約する。
   - IndexedDB `sessions` は`scenarioId`をキーに、現在フェーズ、タイマー状態、フェーズ結果、同期表示状態を保存・復元する。各シナリオは並列に独立した進行を持つが、1つのアプリ画面でアクティブにできるシナリオは常に1つだけとし、切り替え前に現在セッションを保存する。
   - 同一ブラウザの複数タブではBroadcastChannel／storageイベントでアクティブシナリオを共有し、ログインユーザー単位で全タブのアクティブ対象を1つに揃える。進行スナップショットは各scenarioIdに個別保存する。
   - 管理モーダルの各シナリオカードは`?scenarioId=<id>`を含む専用URLを表示し、クリップボードへのコピーと新しいタブでのオープンを提供する。URLはシナリオ本体を含まず、開いた端末側のローカルファイル紐づけを要求する。
7. **レスポンシブ台本背景**:
   - PCの3カラムとタブレットの2カラムでは、台本領域を半透明の暗色レイヤーと軽い背景ぼかしで描画し、背景画像の雰囲気と台本の可読性を両立する。
   - タブレット幅のGM台本既定文字サイズは16pt相当（約21.3px）とし、保存済み`scriptFontSize`を優先する。短い画面高では2カラムへ寄せ、粗いポインターの主要操作領域は44px以上を確保する。
   - フェーズタブ列はブラウザー標準の横スクロールを使用し、台本内・ボタン・入力・表・iframe上のタッチを画面全体のスワイプ切替対象から除外する。

### E. 配備・品質ゲート (Firebase Hosting)
0. **フロントエンドCSSビルド**:
   - Tailwind CSS は `@tailwindcss/vite` と `src/index.css` でビルド時に生成する。
   - `index.html` はTailwind CDNや外部import mapを読み込まず、実行時JIT生成に依存しない。
   - Timer共有画面、Handout共有画面、シナリオ入出力用JSZipは動的importで分割し、通常のGM画面の初期バンドルへ含めない。
   - Viteの手動チャンクにより、Firebase（Firestore／Auth／共通部）、PDF.js、React系ランタイム、アイコン、Markdown系、および管理モーダル群をアプリ本体から分離し、個別にキャッシュ可能なバンドルとして配信する。
1. **Firebase Hosting 設定**:
   - `firebase.json` は `dist` を配備し、存在しない任意パスを `/index.html` へ rewrite する SPA 構成。
   - rewrite 前の URL を対象に、アプリシェルは再検証、`/assets/**` はハッシュ付き静的 asset として長期 immutable cache を適用する。
   - `.firebaserc` は AI Studio で使用する Firebase project を default alias として定義する。
   - project aliases は `development` (`cuebook-dev`) と `stable` (`cuebook-stable`) を使用し、default は `development` とする。Bizは店舗ごとに独立した `cuebook-biz-<店舗コード>` プロジェクトを使用し、Workflowの許可リストで配備先を固定する。
   - `npm run build:development` は `.env.development` のFirebase Web設定を使用し、Hostingの `cuebook-dev` と認証・Firestore接続先を一致させる。
   - 通常のDev／Stable／Biz配備では `firestore.rules` をHostingと同時配備する。Dropbox PDF連携のCloud Functionsは、`functions/` 配下を変更したリリースでのみ明示的に配備し、フロントエンド更新ごとにSecret Manager権限を要求しない。
   - Dropbox PDFアセット連携用のCloud Functionsは Node.js 22（2nd Gen）で稼働し、`asia-northeast1` のArtifact Registryには1日保持の自動クリーンアップポリシーを設定する。
2. **配備前品質ゲート**:
   - `npm run verify` は lint、TypeScript 型検査、ユニットテスト、本番 build を順に実行する。
   - 初回および変更配備では Hosting preview channel に対して deep link、認証、同期画面、タイマー、キャッシュ更新を受入確認する。
3. **環境別リリース運用規定**:
   - **Dev (`cuebook-dev`)**: 新機能・修正を頻繁に追加し、開発者および協力者が検証するテスト環境。安定性を保証する一般公開先として扱わない。
   - **Stable (`cuebook-stable`)**: Devで品質ゲートと受入確認を完了した安定版だけを配備する一般公開環境。DevからStableへの昇格は、リリース対象の版を固定して実施する。
   - **Biz (`cuebook-biz-<店舗コード>`)**: 特定利用者および店舗運用を想定した商用環境。店舗ごとにFirebase project、Firestore、Authentication、Hosting、クォータおよびOIDCサービスアカウントを分離する。例としてXTV店舗は `cuebook-biz-xtv` を使用する。Stableで互換性と安定動作を検証し、対象利用者にもStable版で事前確認を依頼した後に更新する。
   - 緊急修正を除き、Bizの更新予定は少なくとも1か月前までに対象利用者へ連絡する。変更内容、確認対象、予定日および影響範囲を案内に含める。
   - 標準の昇格順序は **Dev → Stable → Biz** とし、Bizへの直接配備は行わない。緊急時に例外対応する場合は、理由、影響範囲、検証結果、ロールバック方法を `Spec-History.md` に記録する。
   - StableおよびBizの本番配備は自動昇格させず、品質ゲート成功後の明示的な手動承認を必須とする。配備元はDevで受入確認済みのGitタグに固定し、同じタグだけをStable、Bizへ昇格させる。
4. **GitHub Actions Dev配備 (`.github/workflows/deploy-dev.yml`)**:
   - `main`へのPushまたはActionsの手動実行で、`npm run verify`、`npm run build:development`、Firebase Hosting (`cuebook-dev`) 配備を順番に実行する。
   - GitHub Environment `development` のVariablesにFirebase Web設定、Secretsに`GCP_WIF_PROVIDER`と`FIREBASE_DEPLOYER_SERVICE_ACCOUNT`を登録する。
   - Google Cloud認証はGitHub OIDC／Workload Identity Federationを使用し、長期Firebaseトークンをリポジトリへ保存しない。
   - Stable／Bizの配備Workflowは別途作成し、Dev Workflowから自動昇格させない。
5. **GitHub Actions Stable配備 (`.github/workflows/deploy-stable.yml`)**:
   - `workflow_dispatch` のみで実行し、Dev受入確認済みのバージョンGitタグを必須入力にする。GitHub Environment `stable` の承認後、`cuebook-stable` へ配備する。
   - `stable` Environmentには、そのFirebase project専用の `VITE_FIREBASE_*` VariablesとOIDC用 `GCP_WIF_PROVIDER`／`FIREBASE_DEPLOYER_SERVICE_ACCOUNT` Secretsを登録する。配備サービスアカウントには `Firebase Hosting Admin` と `Firebase Rules Admin` を付与する。
6. **GitHub Actions Biz配備 (`.github/workflows/deploy-biz.yml`)**:
   - `workflow_dispatch` のみで実行し、Stable受入確認済みのGitタグと、許可済みの店舗コードを必須入力にする。現在の許可コードは `xtv` で、配備先は `cuebook-biz-xtv` に固定される。
   - GitHub Environmentは `biz-<店舗コード>`（例: `biz-xtv`）とし、店舗ごとのFirebase Variables、OIDC Secrets、Required reviewersを個別に管理する。配備サービスアカウントには `Firebase Hosting Admin` と `Firebase Rules Admin` を付与し、任意文字列をHosting projectへ渡さない。
   - Bizビルドは `VITE_CUEBOOK_TENANT` に承認済みの店舗コードを埋め込み、店舗別ブランド表示をビルド時に限定する。
   - 新店舗は、Firebase project作成、IAM Service Account Credentials API有効化、最小権限OIDCサービスアカウント設定、GitHub Environment作成、Workflow許可リスト追加、受入確認の順でオンボーディングする。
7. **配備時の学びと再発防止**:
   - CIで静的importされる設定ファイルは、実行時環境変数の有無にかかわらず型検査時に解決可能でなければならない。Firebase Web SDKの公開設定と、サービスアカウント等の秘密情報を混同しない。
   - OIDC配備先ではIAM Service Account Credentials APIを有効化し、Firebase CLIへ短期アクセストークンを明示的に渡す。長期Firebaseトークンは使わない。
   - Dev受入確認には実ブラウザでの認証、Firestore同期、深いURL、同期ウィンドウ、タイマー、主要ショートカットおよびタブレット幅の視覚確認を含める。CSSは子要素だけでなく、背景を覆う祖先レイヤーとz-indexを確認する。
   - ロールバックは前回の受入確認済みGitタグを、同じStableまたは店舗Biz Workflowから明示的に再配備して行う。Bizの緊急変更は理由・影響範囲・検証結果・ロールバックタグを履歴へ記録する。
8. **Codex経由の配備指示と確認プロトコル**:
   - 開発者は「Devに配備して」と指示できる。Codexは作業ツリー、品質ゲート、対象commitを確認し、`main` へのPushとDev Workflowの完了確認を行う。
   - 開発者は「Stableへ `<タグ>` を配備して」と指示できる。Codexはタグの存在、Dev受入確認、品質ゲート、配備先 `cuebook-stable` を確認したうえで、Workflow起動**直前**にタグ・対象project・ロールバックタグを示して明示承認を求める。承認後にだけタグPush／Workflow起動を行う。
   - 開発者は「Biz `<店舗コード>` へ `<タグ>` を配備して」と指示できる。CodexはStable受入確認、許可済み店舗コード、予定通知、配備先 `cuebook-biz-<店舗コード>`、ロールバックタグを確認し、Workflow起動**直前**に明示承認を求める。承認後にだけ起動する。
   - GitHub EnvironmentのRequired reviewerは、Codexのチャット承認とは独立した第二の防壁である。Workflow起動後はGitHub上の承認者がEnvironmentを承認するまでSecretsを取得できず、Codexはその承認を迂回しない。
   - Codexは`gh` CLIでWorkflowを起動・監視できるが、別のGitHubユーザーによるRequired reviewer承認、Firebase project作成、Google Cloud IAM権限付与は代行せず、必要時に手順を案内する。

### F. データ整合性・設計原則 (v1.10)
1. **ACID 境界**:
   - IndexedDB の保存完了は request 成功ではなく transaction `complete` を基準とする。abort/error は失敗として扱う。
   - Firestore のデバウンス／集約書込みは durable write の完了Promiseを返し、完了まで保留データを破棄しない。失敗時は保留データを保持して再試行可能な状態を維持する。
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
| `SoundConfig` | `src/types.ts` | 音響素材の設定データ（id, name, url, type: BGM/SE, volume, loop, triggerMode, storageProvider?, storageAssetId?, sizeBytes?） |
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
- `portal/`: 既存のCueBookアプリとは分離した、利用者向けポータルの素材・トークン・スクリプト置き場。ポータルのページ本体は削除済みで、現時点では `tokens.css`、`main.js`、`README.md` と `assets/` を保持する。既存の `src/` ビルドには含めない。
- `portal/assets/cuebook-concept-02.png`: ポータルのヒーロー背景に使うConcept 02（RUN / EDIT / SYNC、ワイヤレス子ウィンドウ、大型液晶／プロジェクター出力）の提供デザイン。
- `portal/assets/cuebook-sync-reference.png`: 旧ヒーロー背景の参照素材。現行ヒーローでは使用しない。
- `portal/assets/cuebook-logo.png` / `portal/assets/nib.png`: ポータル用の暫定CueBookロゴとペン先装飾素材。
- `src/App.tsx`: アプリケーションのメインエントリーポイント・レイアウトオーケストレーター
- `src/components/Header.tsx`: マスターUI、タイマー表示、全般メニュー、ショートカットボタン
- `src/components/EditorView.tsx`: シナリオエディタ親コンポーネント（Saved トースト、タブ切替）
- `src/components/SoundBoard.tsx`: BGM/SE/SoundCluster 一括操作ボード
- `src/components/TimerTapControl.tsx`: 数字タップの2手操作と表示専用ローカル状態。startTime／secondsや同期データを変更しない。
- `src/components/TimerWorkspace.tsx`: 表示中フェーズのタイマーと、別フェーズで稼働中のタイマーを集約する専用操作欄
- `src/components/OutlineBlock.tsx` / `src/utils/scriptOutline.ts`: ブロック単位のアウトライン開閉状態と枝境界判定
- `src/components/editor/MediaTab.tsx`: 画像/動画の管理、ソート順操作、タグコピー
- `src/components/modals/ShortcutsGuideModal.tsx`: モード別ショートカットキー一覧モーダル
- `src/hooks/useGlobalShortcuts.ts`: キーボード入力監視フックと、テスト可能な `dispatchGlobalShortcut` (1~9 数字キー画像切替、Ctrl系操作)
- `src/hooks/useGlobalShortcuts.test.ts`: Sync Studio、メディア、BGM/SE、タイマー、フェーズ操作のショートカット回帰試験
- `src/services/AudioService.ts`: Web Audio API シングルトン管理クラス
- `src/services/SyncService.ts`: Firebase Firestore リアルタイム同期層
- `src/services/ErrorLogger.ts`: ローカル永続の診断ログ。保存データをランタイム検証・自己修復し、構造化した操作コード、操作名、復旧可能性を記録する。
- `src/services/ScenarioRegistryService.ts`: Googleアカウントのシナリオ台帳、設定同期、fingerprint、端末紐づけ境界
- `src/services/ScenarioFileService.ts`: `.json` / `.zip` / `.cuebook` のシナリオ解析境界
  - `src/services/StorageService.ts` / `src/services/sessionRecoveryService.ts`: 同一のIndexedDBスキーマ世代（v3）で、シナリオ本体、`sessions`、端末別`scenarioBindings`およびセッション復旧を永続化する。
- `src/hooks/useAppTimer.ts`: 既存タイマー互換の 1 秒表示フック
- `src/hooks/useSyncEngine.ts`: IndexedDB初期化・自動保存・進行保存・Firestore同期の統括。要求世代のガードにより古い非同期読み込みを無効化する。
- `src/hooks/useAppWindowRouting.ts`: 進行／編集URLと `scenarioId` のブラウザ履歴同期
- `src/hooks/useAppModalState.ts`: 表示専用モーダル／ポップアップ状態の集約
- `src/hooks/useAppAuthentication.ts`: Firebase認証状態、ログイン、ログアウト、同期セッションの安全な解除
- `src/hooks/useScenarioRegistry.ts`: ローカル／クラウドのシナリオ台帳統合と更新
- `src/hooks/useAudioLibrarySync.ts`: Biz認可・シナリオ別音源一覧の購読とReact状態反映
- `src/services/AudioLibraryService.ts`: 音源一覧のFirestore購読・トランザクション保存
- `src/services/AudioLibrarySession.ts`: 初回読込・差分保存・再試行・未保存変更の保持
- `src/utils/audioLibrary.ts`: 音源ID／フィールド単位の差分統合・端末専用URL除外
- `src/utils/scenarioSession.ts` / `src/utils/scenarioReset.ts`: シナリオ切替時の進行スナップショット、タイマー初期化、リセット前スナップショットを生成する純粋ロジック
- `src/hooks/useDisplayNow.ts` / `src/components/LiveHeader.tsx`: root state を更新せず leaf component と Header wrapper で表示時刻を更新する層
- `src/utils/timerNavigation.ts`: 台本閲覧と明示的なタイマー対象変更を分離する純粋ロジック
- `src/utils/detailsMarkup.ts`: 入れ子・兄弟境界を保ったMarkdown `details`前処理
- `src/index.css` / `vite.config.ts`: Tailwind CSS のビルド時生成とグローバルCSSエントリ
- `src/components/DebouncedInput.tsx`: 450ms を標準とする textarea 用デバウンス入力
- `firebase.json` / `.firebaserc`: Firebase Hosting の配備先・SPA rewrite・キャッシュ設定
- `修正指示書_2026-08-02.md`: Firebase Hosting 配備前の問題一覧、再発防止策、残存リスク
