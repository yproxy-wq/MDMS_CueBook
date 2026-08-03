import { Scenario, SoundType, CharacterType } from './types';

export const INITIAL_SCENARIO: Scenario = {
  id: 'cuebook-manual',
  title: 'CueBook 操作ガイド',
  author: 'CueBook Team',
  themeColor: '#1e50a2', 
  subThemeColor: '#38a1db',
  checklistPosition: 'bottom',
  masterVolumePosition: 'top',
  columnLayoutMode: 'auto',
  uiScaleMode: 'medium',
  popupTimerPosition: 'top-right',
  backgroundImage: 'https://github.com/yproxy-wq/MDMS_CueBook/blob/main/Default_Theater.jpg?raw=true',
  phases: [
    {
      id: 't-01-welcome',
      name: '01. イントロダクション',
      description: 'TRPGやマーダーミステリーのGM・進行役のための統合アプリケーション。',
      script: '',
      themeColor: '#3b82f6',
      scriptBlocks: [
        {
          id: 'b1-1',
          type: 'markdown',
          content: `
# 01. 操作ガイドへようこそ

CueBookへようこそ！
本アプリは、TRPGやマーダーミステリー（マダミス）のGM・進行役のための**オンライン/オフライン統合セッション進行支援コンソール**です。

台本、音響、時間、キャラクター情報、およびプレイヤー（PL）への画面同期をひとつのコンソールに統合しました。

##  2つのウィンドウによるデュアル構成
本システムは「GM向け」と「プレイヤー（PL）向け」の役割を最適化するために、2つのウィンドウで動作します。

### 1. GMメインウィンドウ（本画面）
- GM（ゲームマスター）のみが閲覧、使用します。
- 台本の編集や確認、ゲーム進行時のガイド、時間管理、音源の再生、同期ウィンドウの制御を行います。

### 2. 同期ウィンドウ（子ウィンドウ）
- プレイヤーに向けて演出を投影するための専用画面です。
- 議論タイマーや背景画像、PDF資料、手がかりカード、映像などの演出を、GMメインウィンドウからリアルタイムに指示して表示・再生・停止できます。

---

##  画面の基本構成
アプリ内は、Brutalist（ブルータリズム）をベースにした視認性が高く美しいダークテーマで設計されています。

![画面構成](https://raw.githubusercontent.com/yproxy-wq/MDMS_CueBook/refs/heads/main/gamen-kousei.png)

1. **ヘッダー（最上部）**：現在時刻、マスターボリューム、退出時刻管理、および「SESSION / EDIT」のモード切り替えが常駐。
2. **左ペイン（フェーズ一覧）**：シナリオの進行状況を把握し、ワンクリックで場面（フェーズ）を遷移。
3. **中央ペイン（進行台本）**：現在のフェーズに応じた台本、アクション、およびチェックリストを表示。
4. **右ペイン（タイマー＆サンプラー）**：PL表示用タイマーの制御と、BGM/SEのコントロールパネル。

<details>
<summary><b> プロのコツ: デュアル画面の最大活用</b></summary>
同期ウィンドウ（PL向け）をプロジェクターやDiscordの画面共有で提示し、GMウィンドウは手元のノートPCやタブレットで隠して閲覧するのがベストな運用方法です。
[PLには見えない情報](color:#3b82f6)を快適に操作できます！
</details>
          `
        }
      ],
      checklists: [
        '右ペインの「Grieg - Solitary Traveller」の再生ボタンを押してみる',
        '上部メニューにある「EDIT」を押し、直感的なエディタ画面を確認する'
      ],
      timers: [
        { 
          id: 't-intro', 
          label: 'CueBook ガイド', 
          durationMinutes: 3,
          lapTimes: [2, 1],
          lapNotificationText: "導入セッション進行中",
          lapTexts: {
            2: "ようこそCueBookへ！まずは基本を覚えましょう",
            1: "残り1分！右側の「EDIT」ボタンを探してください"
          }
        }
      ],
      recommendedSounds: ['bgm-grieg-solitary'],
      targetDurationMinutes: 4,
      bufferDurationMinutes: 1
    },
    {
      id: 't-02-script-blocks',
      name: '02. 台本の確認と編集',
      description: '台本や素材を準備する「EDIT」モードと、本番用の「SESSION」モード。',
      script: '',
      themeColor: '#10b981',
      scriptBlocks: [
        {
          id: 'b2-1',
          type: 'markdown',
          content: `
# 02. 台本の確認と編集（2つのモード）

CueBookには、セッションを進行する**「SESSION（セッション）モード」**と、台本や素材を準備する**「EDIT（編集）モード」**の2つの画面があります。

##  SESSIONモード（シナリオ進行画面）
ゲームを実際に進行、操作するためのモードです。
- **体験型台本チェック**：フェーズを切り替えると、必要な台本やチェックリストが自動で一瞬で展開されます。
- **推奨BGMの最前面化**：そのシーンに紐付けた推奨音源が自動的に右ペインの最上部へ移動し、迷わず再生できます。
- **チェックリスト連動**：GMが進行中に「やるべきこと」をチェックして、ヌケ・モレを徹底的に防止します。

##  EDITモード（シナリオ編集画面）
自分だけのGM台本をゼロから作成、またはカスタマイズするためのモードです。
画面最上部の **「EDIT」ボタン（鉛筆マーク）** を押すことで切り替わります。

### EDITモードでできること：
- **シナリオ全体の設定**：タイトル、作成者、テーマカラー、背景画像の登録。
- **リソース管理**：演出に使用する音源（URL）や画像・PDFなどのメディア登録。
- **台本編集**：マークダウンや、折りたたみ可能なアウトライン、PDFなどのブロックをドラッグ＆ドロップで追加・並び替え。
- **キャラクター管理**：登場人物の設定、個別配布するハンドアウト（個別通知）の設定。
- **データ永続化とエクスポート**：編集内容は自動でブラウザに保存されるほか、\`.cuebook\` 形式のJSONファイルとしてエクスポート可能。他の端末へインポートして瞬時に再現できます。

![フェーズ構成](https://raw.githubusercontent.com/yproxy-wq/MDMS_CueBook/refs/heads/main/phase-nakami.png)
*(上の画像は台本ブロック（Script Block）の階層構造を示しています。直感的に並び替えや追加が可能です)*

<details>
<summary><b> Markdown 装飾チートシート（v0.96md 強化版）</b></summary>

| 装飾スタイル | 記述法 | 表示イメージ |
| :--- | :--- | :--- |
| **太字強調** | \`**太字強調**\` | **太字強調** |
| *斜体* | \`*斜体*\` | *斜体* |
| ~~打ち消し~~ | \`~~打ち消し~~\` | ~~打ち消し~~ |
| [赤い太字](color:#ef4444) | \`[赤い太字](color:#ef4444)\` | [赤い太字](color:#ef4444) |
| {color:#10b981}(緑の文字) | \`{color:#10b981}(緑の文字)\` | {color:#10b981}(緑 of 文字) |
| <color:yellow>黄色の文字</color> | \`<color:yellow>黄色の文字</color>\` | <color:yellow>黄色の文字</color> |
| <color=violet>バイオレットの文字</color> | \`<color=violet>バイオレットの文字</color>\` | <color=violet>バイオレットの文字</color> |

</details>

<details>
<summary><b> シナリオ進行用シークレット・メモ</b></summary>
このように、PLに秘密にしたい手がかりの裏面や、GM用のアドリブ指示を[折り畳み要素（details/summaryタグ）](color:#10b981)として記述しておくと、台本ビューがスッキリします。
</details>
          `
        }
      ],
      checklists: [
        '画面上部中央の「EDIT」をクリックして、編集用のツールボックスを確認する',
        '「Phases」タブから「02. 台本の見方と編集」フェーズの台本を一時的に書き換えてみる'
      ],
      timers: [
        { 
          id: 't-script', 
          label: '台本編集ガイド', 
          durationMinutes: 5,
          lapTimes: [3, 1],
          lapTexts: {
            3: "エディタのツールバーを触ってみましょう！",
            1: "残り1分！変更した内容は即時自動保存されます"
          }
        }
      ],
      recommendedSounds: ['bgm-grieg-solitary'],
      targetDurationMinutes: 6,
      bufferDurationMinutes: 1
    },
    {
      id: 't-03-audio',
      name: '03. 音響演出・ボリューム',
      description: 'Web Audio API による高機能クロスフェードと一元的な音響管理。',
      script: '',
      themeColor: '#f59e0b',
      scriptBlocks: [
        {
          id: 'b3-1',
          type: 'markdown',
          content: `
# 03. 音響演出・ボリューム操作

ゲームの没入感を決定づけるBGMや効果音（SE）の再生は、CueBookのオーディオエンジンが一元管理します。

##  音調とボリュームコントロール

![音響コントロール](https://raw.githubusercontent.com/yproxy-wq/MDMS_CueBook/refs/heads/main/oncho.png)

### 1. マスターボリューム
画面最上部（ヘッダー）に、マスターボリュームが常駐しています。
セッション全体の音量を、他のタイマーや進行操作に影響を与えることなく一瞬でフェードまたはミュートできます。

### 2. 個別音量＆フェード設定
音源ごとに、個別にデフォルト音量を指定できます。
また、**「フェードイン（Fade In）」** および **「フェードアウト（Fade Out）」** 秒数をミリ秒単位で設定可能。
再生や停止ボタンを押すと、自動的に美しいクロスフェードが発生し、プレイヤーの没入感を損ないません。

### 3. ループ再生・チョークグループ
- **Loop**：チェックを入れると、Web Audio API がキャッシュバッファから途切れなくループ再生を続けます。
- **Choke Group (チョークグループ)**：同じグループ名（例：「bgm」）を指定した音源同士は、一方が再生されるともう一方が自動的に美しくフェードアウトします。BGMの切り替え時に手動で停止させる必要がありません。

<details>
<summary><b> チョークグループ（排他再生）設定のコツ</b></summary>
BGMスロット同士に \`bgm\`、不穏な環境音同士に \`ambience\` のようにチョークグループを指定すると、GMが手動で古いBGMを止める手間が完全にゼロになります。
再生ボタンを押すだけで[自動的かつ美麗なクロスフェード](color:#f59e0b)が行われます。
</details>
          `
        }
      ],
      checklists: [
        '推奨音源「Grieg - Brooklet」の再生ボタンを押し、Solitary Traveller からクロスフェードすることを確認する',
        'ヘッダーの「MASTER VOLUME」のスライダーを左右にドラッグして音量変化を試す'
      ],
      timers: [
        { 
          id: 't-audio', 
          label: '音響制御ガイド', 
          durationMinutes: 4,
          lapTimes: [2, 1],
          lapTexts: {
            2: "Grieg - Brooklet の再生を試しましたか？",
            1: "残り1分！マスターボリュームを絞ってフェードを体験しましょう"
          }
        }
      ],
      recommendedSounds: ['bgm-grieg-brooklet'],
      targetDurationMinutes: 5,
      bufferDurationMinutes: 1
    },
    {
      id: 't-04-characters',
      name: '04. キャラクター・ハンドアウト',
      description: '登場PC・NPCのメモ、個別台本（秘密情報）のリアルタイム配分。',
      script: '',
      themeColor: '#ec4899',
      scriptBlocks: [
        {
          id: 'b4-1',
          type: 'markdown',
          content: `
# 04. キャラクター＆ハンドアウト配分

GMメインウィンドウから、登場キャラクターに関するパラメータや秘密情報をリアルタイムにコントロールできます。

##  キャラクター管理でできること
- **個別台本（ハンドアウト）配分**：
  各PCに対して個別のURLを発行、または「個別通知」モーダルからプレイヤーのスマートフォン等に直接メッセージをリアルタイム同期送信。
  プレイヤーは自分宛ての個別通知画面を開くだけで、GMから届く情報をその場で確認できます。
- **手番・行動トークン管理**：
  議論の発言権トークンや、マダミス等での調査ポイント（AP）などをGMが中央管理。増減はプレイヤーの画面（同期ウィンドウなど）にも即時反映されます。
- **フラグ機能（進行目印）**：
  3色（青・赤・黄）のフラグをキャラクターごとにトグル設定。投票先、死亡・生存フラグ、特定の証拠発見状態などのメモとして活用できます。

<details>
<summary><b> 秘密配布時ハンドアウトの仕様</b></summary>
個別配布された秘密ハンドアウトやトークン数は、プレイヤーが手元のスマートフォンで同期されたPLカードを開いた際、[安全な暗号化状態](color:#ec4899)でリアルタイム取得されます。他プレイヤーに画面をのぞかれない限り、情報漏洩を防ぎます。
</details>
          `
        }
      ],
      checklists: [
        '「EDIT」から「Characters」タブを開き、キャラクター追加やハンドアウト文章の記述ができることを確認する',
        '右側サンプラーの下にある「案内人」のTokenカウンターを増減させてみる'
      ],
      timers: [
        { 
          id: 't-char', 
          label: '配役・配布ガイド', 
          durationMinutes: 5,
          lapTimes: [3, 1],
          lapTexts: {
            3: "キャラクター追加は、何人でも制限なく可能です",
            1: "残り1分！右下の「案内人」トークンを増減してみてください"
          }
        }
      ],
      recommendedSounds: ['bgm-grieg-solitary'],
      targetDurationMinutes: 7,
      bufferDurationMinutes: 2
    },
    {
      id: 't-05-time-sync',
      name: '05. 時間管理と画面同期',
      description: 'バッファ時間を含む時間予実管理と、Sync Studio によるPL同期。',
      script: '',
      themeColor: '#8b5cf6',
      scriptBlocks: [
        {
          id: 'b5-1',
          type: 'markdown',
          content: `
# 05. 時間予実管理と画面同期（Sync Studio）

セッション時間管理の失敗は、会場の退去遅延やプレイヤーの不完全燃焼に直結します。
CueBookは、画期的な「バッファ時間」設計と「退出時刻逆算」によって、進行の遅れを可視化します。

##  時間管理の見方と予実
ヘッダーとフェーズ一覧には、常に時間の「現在・予定」ステータスが表示されています。

![時間予実表示](https://raw.githubusercontent.com/yproxy-wq/MDMS_CueBook/refs/heads/main/gentai.png)

### 1. 現在時刻 と 退出時刻（会場リミット）
- **現在時刻**：ミリ秒以下のズレを自動補正（高精度タイマーエンジン）して表示します。
- **退出時刻**：レンタルスペースの退出期限など、最終デッドラインを設定できます。
- これらにより、「あと何分で完全撤収しなければならないか」がヘッダーにリアルタイムで逆算表示され、進行ペースの調整を後押しします。

---

##  CueBookにおける「フェーズ」設計 of 肝
CueBookにおけるフェーズ全体の予定時間は、以下の計算式に基づきます。

$$\\text{タイマー時間（議論時間）} + \\text{バッファ時間（余裕時間）} = \\text{フェーズ予定時間}$$

![フェーズコンソール](https://raw.githubusercontent.com/yproxy-wq/MDMS_CueBook/refs/heads/main/Phase-console.png)

### ① タイマー時間（PLに見える時間）
- プレイヤーに開示され、同期ウィンドウでカウントダウンされる「純粋な議論時間・アクション時間」です。

### ② バッファ時間（GMだけが把握する予備時間）
- 台本読みの遅れ、議論の延長、ゲーム処理（配布など）の手間に備え、GMが台本に予め含めておく「非公開の余裕時間」です。PL向けのタイマーには一切表示されません。

### ③ 予定時間（フェーズ全体の所要時間）
- タイマー時間とバッファ時間の合算です。
- 進行ナビゲーションでは、この「予定時間」の合計と「実際の経過時間」を絶えず比較し、**セッション全体が何分遅れているか（または巻いているか）** を自動算出します。

---

##  Sync Studio（同期ウィンドウ管理システム）
GMメインウィンドウ上部の「SYNC」ボタンから開くウィンドウです。

- **高精度リアルタイム制御**：親ウィンドウの再生・停止・一時停止（高精度ポーズ処理・ドリフト補正タイマー）を完全に子ウィンドウへリアルタイム伝達。
- **集中制御パネル**：タイマーの表示/非表示（Visible/Hidden）、画像の配置（Top/Bottom）、画面への拡縮表示（FILL / WIDTH / HEIGHT）を一括してコントロール。
- **QRコード/アクセスURL**：現地でのタブレット設置や、Discord経由でのPL共有用URLを瞬時に発行できます。

<details>
<summary><b> ドリフト補正技術について</b></summary>
秒数カウンターの定常累積誤差（ミリ秒のズレ）を基準システム時刻と比較して動的補正しているため、ブラウザをリロードしても正確な残り時間を保持します。
[1秒未満の精度](color:#8b5cf6)で完璧に同期を維持します。
</details>
          `
        }
      ],
      checklists: [
        'ヘッダー中央の「EXIT TIME」をクリックし、10分後の時刻に設定してみる',
        '右ペインのタイマー「開始」をクリックし、時間の進みを体験する',
        '上部メニューの「SYNC」ボタンを押し、QRコードとライブプレビューが動くことを確認する'
      ],
      timers: [
        { 
          id: 't-sync', 
          label: '同期＆時間ガイド', 
          durationMinutes: 8,
          lapTimes: [5, 2],
          lapTexts: {
            5: "議論の折り返し地点です。現在までの整理を行ってください",
            2: "残り2分！そろそろ最終結論をまとめましょう"
          }
        }
      ],
      recommendedSounds: ['bgm-grieg-solitary'],
      targetDurationMinutes: 10,
      bufferDurationMinutes: 2
    },
    {
      id: 't-06-practical',
      name: '06. 実践運用と管理メニュー',
      description: 'ハンバーガーメニュー、インポート・エクスポート、セッション履歴（Performance）。',
      script: '',
      themeColor: '#06b6d4',
      scriptBlocks: [
        {
          id: 'b6-1',
          type: 'markdown',
          content: `
# 06. 実践運用と管理メニュー

実際のセッションでは、突発的な事態の発生やデータの保全が求められます。

##  ハンバーガーメニューと管理機能

![ハンバーガーメニュー](https://raw.githubusercontent.com/yproxy-wq/MDMS_CueBook/refs/heads/main/Hum-menu.png)

ヘッダーの左端にある「ハンバーガーメニュー（三本線）」、または右上の「管理メニュー」から、強力なユーティリティ群にアクセスできます。

- **Scenario Configuration**：シナリオの基本情報、背景設定などを変更。
- **Scenario Outline (台本アウトライン編集)**：複数のフェーズと台本の構成をパノラマビューで一覧・入れ替え。
- **Import / Export (.cuebook)**：編集した台本をファイルとして保存。PCとiPad間でのデータ移動も簡単です。
- **Reset Scenario**：編集内容をデフォルト状態（本ガイド）に戻します。
- **Handout Distribution Modal**：全プレイヤーへのハンドアウト共有状況を一元監視。
- **Session History (Performance)**：セッション終了後、どの日時・会場で、誰がどの配役でプレイしたかを記録（Firestoreへ保存し、いつでも一覧・分析できます）。

<details>
<summary><b> .cuebook ファイルの強み</b></summary>
エクスポートされる \`.cuebook\` ファイルは単なるテキストデータ（JSON）なので、メールやSlack、Discord等で簡単に共有・保管できます。
[容量もわずか数KB](color:#06b6d4)と極めて軽量です。
</details>
          `
        }
      ],
      checklists: [
        'ヘッダー左端のハンバーガーメニューを押し、シナリオの設定やリセットメニューを確認する',
        '「EDIT」の「Outline」から、各フェーズの並び替えができるインターフェースを確認する'
      ],
      timers: [
        { 
          id: 't-prac', 
          label: '管理機能ガイド', 
          durationMinutes: 5,
          lapTimes: [3, 1],
          lapTexts: {
            3: "エクスポート機能をぜひお試しください",
            1: "残り1分！インポートも同じく一瞬で完了します"
          }
        }
      ],
      recommendedSounds: ['bgm-grieg-solitary'],
      targetDurationMinutes: 6,
      bufferDurationMinutes: 1
    },
    {
      id: 't-07-settings',
      name: '07. 設定と最適化',
      description: 'テーマカラー、UIスケール、カラムレイアウトのカスタマイズ。',
      script: '',
      themeColor: '#f43f5e',
      scriptBlocks: [
        {
          id: 'b7-1',
          type: 'markdown',
          content: `
# 07. 設定と最適化（プレファレンス）

ヘッダーの **「設定 (ギアマーク)」** を押すと、CueBookのシステム設定・最適化ウィンドウが開きます。

##  カスタマイズ可能な項目
- **Theme Color (テーマカラー)**：シナリオの「顔」となるメインカラーとサブカラーを選択（Brutalist UI のアクセントに反映されます）。
- **Layout & Column Mode**：
  - \`Auto\`：画面サイズに応じて最適に自動分割。
  - \`Horizontal\`：横並び（デスクトップ推奨）。
  - \`Vertical\`：縦並び（モバイル・タブレット推奨）。
- **UI Scale Mode**：フォントサイズやパディングを一括調整（\`Small\`, \`Medium\`, \`Large\`）し、あらゆる解像度のモニターに対応します。
- **Popup Timer Position**：議論中、台本に集中するためにタイマーを右下や左上など隅っこにフロート表示（Popup）させる配置を選択できます。
- **Background Image URL**：シナリオ世界観を演出するGM用コンソール背景（ダークブラインド等）の差し替え。

<details>
<summary><b> 外部モニター・プロジェクター出力時のコツ</b></summary>
16:9 などの外部大画面ディスプレイに投影する際は、Preferences の「UI Scale」を Large に、Sync Studio の配置を FILL または HEIGHT に設定すると、[文字がくっきりと見やすく](color:#f43f5e)なり最適です。
</details>
          `
        }
      ],
      checklists: [
        '設定アイコンをクリックし、UIスケーラビリティを「Large」にして、目の疲れを和らげる表示を試す',
        'テーマカラーを「Crimson Code」や「Cosmic Forest」などに切り替えてみる'
      ],
      timers: [
        { 
          id: 't-settings', 
          label: '設定ガイド', 
          durationMinutes: 3,
          lapTimes: [2, 1],
          lapTexts: {
            2: "UIスケールを変更してみましたか？",
            1: "残り1分！元の設定に戻すのも簡単です"
          }
        }
      ],
      recommendedSounds: ['bgm-grieg-solitary'],
      targetDurationMinutes: 4,
      bufferDurationMinutes: 1
    },
    {
      id: 't-08-recovery',
      name: '08. 障害復旧と監視',
      description: '通信断や誤リロードへの耐障害設計と、セッション復旧機構。',
      script: '',
      themeColor: '#eab308',
      scriptBlocks: [
        {
          id: 'b8-1',
          type: 'markdown',
          content: `
# 08. 復旧・監視（耐障害性エンジン）

CueBookは、実際のオフラインセッションでの通信瞬断や誤ったタブ閉じによる進行事故を防ぐ、堅牢な自己修復・状態監視システム（Session Recovery）を搭載しています。

##  耐障害性と復旧のメカニズム
- **Auto Snapshot Save (自動スナップショット)**：
  状態が変化するたびに、進行データ（現在のフェーズ、アクティブなBGM、タイマー残秒数、チェックリストの状態、キャラクターのフラグ・トークン数など）をローカルストレージに自動バックアップ。
- **Session Recovery Trigger**：
  ブラウザの誤ったリロードや、PCの電源が落ちて再起動した場合、起動時に自動的に前回の状態を検出。ダイアログから「前回の続きから復旧」を選択するだけで、音源の再生状態やタイマーの秒数まで完璧に復旧します。
- **Network Status Monitor**：
  Firebase Firestore との同期遅延や切断を絶えず監視。オンライン時はグリーン、切断時は赤色のステータスをコンソール上に控えめに表示し、GMに警告を促します。

<details>
<summary><b> 万が一ブラウザがフリーズした時の復旧方法</b></summary>
慌てずブラウザを再読み込み（F5）してください。起動時に「自動バックアップから復元」の選択肢が出現し、[わずか数秒](color:#eab308)でタイマーと音響状態が復帰します。セッションをスムーズに再開できます。
</details>
          `
        }
      ],
      checklists: [
        'ヘッダー右端の「STATUS: ONLINE」インジケーターを見つける'
      ],
      timers: [
        { 
          id: 't-recover', 
          label: '復旧・監視ガイド', 
          durationMinutes: 3,
          lapTimes: [1],
          lapTexts: {
            1: "残り1分！次はいよいよ最新アップデート情報です"
          }
        }
      ],
      recommendedSounds: ['bgm-blizzard-gust'],
      targetDurationMinutes: 4,
      bufferDurationMinutes: 1
    },
    {
      id: 't-08-updates',
      name: '09. 更新情報 (v0.97)',
      description: 'ショートカット機能の追加と細かな安定化修正。',
      script: '',
      themeColor: '#a855f7',
      scriptBlocks: [
        {
          id: 'b9-1',
          type: 'markdown',
          content: `
# 09. 更新ログ (v0.97)

CueBook v0.97 の更新内容です。進行中に頻繁に使うキーボード操作を追加し、周辺の細かな不具合を修正しました。

## ショートカットキーの追加・改善

| 操作 | キー | 内容 |
| :--- | :--- | :--- |
| Sync Studio | Ctrl + Alt + W | 同期ウィンドウ設定を開閉 |
| 同期メディア | [ / ]、Ctrl + Alt + I | 前後のメディアへ切替 |
| 指定メディア | 1 〜 9 | 登録順のメディアを直接表示 |
| 音源・タイマー | Ctrl + Alt + B / S / R、Space | BGM、SE、リセット、開始・停止 |
| 進行補助 | Ctrl + Alt + N / P / Q | フェーズ移動、クイックアクション |

## 細かなバグフィックス

- タイマーの開始・一時停止時の同期安定性を改善しました。
- メディア切替時の選択状態と同期表示のずれを修正しました。
- 音源、タイマー、Sync Studio のショートカット判定を統一しました。
- 入力欄・テキスト編集時にショートカットが誤作動しないようにしました。
          `
        }
      ],
      checklists: [
        'ショートカットキーを確認する',
        'タイマー・音源・同期ウィンドウのショートカットを確認する'
      ],
      timers: [
        { 
          id: 't-updates', 
          label: 'アップデートログ', 
          durationMinutes: 5,
          lapTimes: [3, 1],
          lapTexts: {
            3: "ショートカットキーを確認中です！",
            1: "残り1分！FAQフェーズへ進みましょう"
          }
        }
      ],
      recommendedSounds: ['bgm-grieg-solitary'],
      targetDurationMinutes: 5,
      bufferDurationMinutes: 0
    },
    {
      id: 't-faq',
      name: '10. FAQ (よくある質問)',
      description: '音響、同期、トラブルシューティングに関するよくある質問。',
      script: '',
      themeColor: '#64748b',
      scriptBlocks: [
        {
          id: 'b-faq-1',
          type: 'markdown',
          content: `
# 10. FAQ (よくある質問)

セッション中に起きやすいトラブルと、その解決方法をまとめました。

<details>
<summary><b> BGMやSEの音が鳴りません。</b></summary>
ブラウザのセキュリティ仕様（Autoplay Policy）により、ユーザーが画面のどこかを1回以上クリックするまで音声再生はミュートされます。画面内（再生ボタンなど）をクリックしてから、再度再生を試みてください。
</details>

<details>
<summary><b> 同期ウィンドウ（子画面）が白画面のままか、同期されません。</b></summary>
同期ウィンドウは Firebase Firestore を介したリアルタイム同期を行っています。
1. GMメインウィンドウ側のインターネット接続（Network Status）が正常か確認してください。
2. 双方が同じアカウント/セッションURLに接続していることを確認してください。
3. \`Sync Studio\` モーダルのトラブルシューターを実行すると、同期サービスの再接続が試みられます。
</details>

<details>
<summary><b> PDFが台本ビューに表示されません。</b></summary>
Google PDF Viewerを介してリモートPDFを読み込む場合、Dropboxやサーバー上のURLが一般公開（パブリックリンク）になっている必要があります。ローカルPDFを使用する場合は、直接台本エディタからファイルをアップロードしてください（自動的にBase64エンコードされ安全に保存されます）。
</details>

<details>
<summary><b> スマホやiPadでも操作・同期できますか？</b></summary>
はい！レスポンシブWebデザインに対応しており、タブレットからGM台本の操作、スマートフォンからのPLカードの閲覧など、[あらゆるマルチデバイス環境](color:#64748b)で完全同期が可能です。
</details>
          `
        }
      ],
      checklists: [
        'FAQでトラブル解決策を確認する'
      ],
      timers: [
        { 
          id: 't-faq-timer', 
          label: 'FAQ セッション', 
          durationMinutes: 5,
          lapTimes: [2],
          lapTexts: {
            2: "FAQセッション残り2分です。ご不明な点は公式Discordなどでも受付中です"
          }
        }
      ],
      recommendedSounds: ['bgm-grieg-solitary'],
      targetDurationMinutes: 5,
      bufferDurationMinutes: 0
    },
    {
      id: 't-09-terms',
      name: '11. 利用規約・免責事項',
      description: 'ご利用上の注意、データの取り扱い、および免責。',
      script: '',
      themeColor: '#475569',
      scriptBlocks: [
        {
          id: 'b-terms-1',
          type: 'markdown',
          content: `
# 11. 利用規約・免責事項

CueBookをご利用いただきありがとうございます。

<details>
<summary><b> データのプライバシーについて</b></summary>
本アプリで作成・編集したシナリオ台本、キャラクターデータ、音源URLなどは、お使いのブラウザ（Local Storage）に保存され、同期機能に必要な最小限の一時ステート（タイマー残秒数、画像URLなど）のみが安全なクラウドデータベースに転送されます。許可なく第三者に情報が公開されることはありません。
</details>

<details>
<summary><b> 音源や画像の著作権について</b></summary>
本アプリに登録して再生するBGMやSE、画像データ、PDFなどのファイルは、利用者が個人的に、または適切なライセンスを取得した上でご使用ください。著作権の侵害などのいかなるトラブルについても、当方は一切の責任を負いません。
</details>

<details>
<summary><b> 免責事項</b></summary>
セッション中の予期せぬ通信障害、クラッシュ、データの消失などについて、開発チームは可能な限りの耐障害設計（Session Recovery）を施していますが、それらによって生じたいかなる損害についても責任を負いかねます。
</details>
          `
        }
      ],
      checklists: [
        '利用規約に目を通す'
      ],
      timers: [
        { 
          id: 't-terms-timer', 
          label: '規約確認', 
          durationMinutes: 2,
          lapTimes: [1],
          lapTexts: {
            1: "残り1分！これですべての操作ガイドが完了です"
          }
        }
      ],
      recommendedSounds: ['bgm-grieg-solitary'],
      targetDurationMinutes: 2,
      bufferDurationMinutes: 0
    }
  ],
  sounds: [
    { id: 'bgm-grieg-solitary', name: 'Grieg - Solitary Traveller', url: 'https://raw.githubusercontent.com/yproxy-wq/MDMS_CueBook/refs/heads/main/Classicals.de%20-%20Grieg%20-%20Solitary%20Traveller%20-%20Lyric%20Pieces%20Book%20III,%20Opus%2043,%20No.%202.mp3', type: SoundType.BGM, chokeGroup: 'bgm', color: '#4c1d95', fadeInDuration: 2, fadeOutDuration: 2, fadeInEnabled: true, fadeOutEnabled: true, loopEnabled: true, volume: 0.6 },
    { id: 'bgm-grieg-brooklet', name: 'Grieg - Brooklet', url: 'https://raw.githubusercontent.com/yproxy-wq/MDMS_CueBook/refs/heads/main/Classicals.de%20-%20Grieg%20-%20Brooklet%20-%20Lyric%20Pieces%20Book%20VII%20,%20Opus%2062,%20No.%204.mp3', type: SoundType.BGM, chokeGroup: 'bgm', color: '#1e3a8a', fadeInDuration: 2, fadeOutDuration: 2, fadeInEnabled: true, fadeOutEnabled: true, loopEnabled: true, volume: 0.6 },
    { id: 'bgm-blizzard-gust', name: 'BGM_Blizzard-Gust', url: 'https://github.com/yproxy-wq/MDMS_CueBook/raw/refs/heads/main/BGM_Blizzard-Gust.mp3', type: SoundType.BGM, chokeGroup: 'bgm', color: '#0284c7', fadeInDuration: 2, fadeOutDuration: 2, fadeInEnabled: true, fadeOutEnabled: true, loopEnabled: true, volume: 0.6 },
  ],
  characters: [
    { id: 'c1', name: '案内人', role: CharacterType.NPC, comment: '演出を支えるガイドです。', color: '#1e50a2', tokens: 1, flags: [true, false, false], playerName: 'GM' },
    { id: 'c2', name: 'プレイヤー1', role: CharacterType.PC, comment: '配役メモ。', color: '#3b82f6', tokens: 0, flags: [false, false, false], playerName: '' }
  ],
  images: []
};

export const BLANK_SCENARIO: Scenario = {
  id: 'cuebook-blank',
  title: '新規シナリオ (Blank)',
  author: 'GM',
  themeColor: '#121212',
  subThemeColor: '#333333',
  checklistPosition: 'bottom',
  masterVolumePosition: 'top',
  columnLayoutMode: 'auto',
  uiScaleMode: 'medium',
  popupTimerPosition: 'top-right',
  backgroundImage: '',
  phases: [
    {
      id: 'phase-01',
      name: 'フェーズ 1',
      description: '真っ白な状態からシナリオを作成します。画面上部の EDIT ボタンから編集できます。',
      script: '',
      scriptBlocks: [
        {
          id: 'b-blank-1',
          type: 'markdown',
          content: `# 見出し1 (H1)
## 見出し2 (H2)
### 見出し3 (H3)
#### 見出し4 (H4)
##### 見出し5 (H5)

### 文字色指定の記法例
- **カラーフォーマット1:** [赤い太字](color:red) または [カスタムカラー](color:#ff5555)
- **カラーフォーマット2:** {color:orange}(オレンジの文字) または {color:#00ffcc}(シャープな水色)
- **カラーフォーマット3:** <color:yellow>黄色の文字</color>
- **カラーフォーマット4:** <color=violet>バイオレットの文字</color>

### テーブル表示の例
| 項目名 | タイプ | 説明 | 状況 |
| :--- | :---: | :--- | :---: |
| 議論フェーズ1 | 議論 | メイン議論の時間 | [進行中](color:red) |
| 投票フェーズ | 投票 | スマホ連動による集計 | [待機](color:gray) |
| エンディング | 演出 | BGMフェードアウト演出 | [未着手](color:yellow) |

- リスト項目1
- リスト項目2

**太字** や *斜体* の装飾が可能です。`
        }
      ],
      checklists: [
        '準備を完了する'
      ],
      timers: [
        { id: 't-blank-timer', label: 'タイマー', durationMinutes: 5 }
      ],
      recommendedSounds: ['bgm-blizzard-gust'],
      targetDurationMinutes: 5
    }
  ],
  sounds: [
    { id: 'bgm-blizzard-gust', name: 'BGM_Blizzard-Gust', url: 'https://github.com/yproxy-wq/MDMS_CueBook/raw/refs/heads/main/BGM_Blizzard-Gust.mp3', type: SoundType.BGM, chokeGroup: 'bgm', color: '#0284c7', fadeInDuration: 2, fadeOutDuration: 2, fadeInEnabled: true, fadeOutEnabled: true, loopEnabled: true, volume: 0.6 }
  ],
  characters: [
    { id: 'c1', name: '案内人', role: CharacterType.NPC, comment: '演出を支えるガイドです。', color: '#1e50a2', tokens: 1, flags: [true, false, false], playerName: 'GM' },
    { id: 'c2', name: 'プレイヤー1', role: CharacterType.PC, comment: '配役メモ。', color: '#3b82f6', tokens: 0, flags: [false, false, false], playerName: '' }
  ],
  images: []
};
