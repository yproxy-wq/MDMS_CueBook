# Biz XTV：Cloudflare音声保存の設定と確認

正規URLは https://qbook-biz-xtv.keikeilab.net 、Firebaseプロジェクトは `cuebook-biz-xtv`。

## 2026-10-01の診断結果

| 項目 | 確認結果 |
| --- | --- |
| ローカルのR2_ACCOUNT_ID／R2_BUCKET_NAME | `functions/.env.cuebook-biz-xtv` に設定あり |
| Firebase Secret ManagerのR2_ACCESS_KEY_ID／R2_SECRET_ACCESS_KEY | 有効なバージョンあり。秘密値は取得していない |
| 独自ドメインからR2へのPUT／GETのCORSプリフライト | 両方204。AllowedOriginが独自ドメインと一致 |
| BizのFunctions | CLI一覧は空。R2用Functionsは未配備 |
| GitHub Environment biz-xtv のR2変数 | 登録済み。R2_ACCOUNT_IDは確認済みの手元の値と不一致のため要確認 |
| 利用者のBizクレーム・実ファイルの保存／再生 | 未検証 |

秘密鍵が存在することは、キーの有効性や対象バケットへの読み書き権限の証明ではない。コードのテスト、CORS確認、本番での実ファイル検証は区別する。

コード側ではシナリオ容量台帳の無効なFirestoreパスを修正済み。従来のHostingだけのBiz配備では保存サーバーが作成されないため、ワークフローへR2 Functionsとインデックスの配備を追加した。

## 現在不足しているGitHub設定

1. [リポジトリのEnvironments](https://github.com/yproxy-wq/MDMS_CueBook/settings/environments) で `biz-xtv` を開く。
2. **Environment variables** に `R2_ACCOUNT_ID` と `R2_BUCKET_NAME` を追加する。
3. 値は手元の `functions/.env.cuebook-biz-xtv` と同じものを使う。アカウントIDはCloudflareのR2画面、バケット名はR2の対象バケットでも確認できる。

この2項目は保存先の識別情報。R2_ACCESS_KEY_ID／R2_SECRET_ACCESS_KEYは既存のFirebase Secret Managerを使い、VITE変数や画面・シナリオへ追加しない。

## 配備

修正を含むリリースタグを作成後、GitHub Actionsの **Deploy Biz Tenant to Firebase Hosting** を実行する。`tenant_code=xtv`、`deploy_r2_functions=true` を指定する。R2サーバー6関数・Firestoreインデックスが成功した後にBiz画面を配備する。通常版のStableには音声保存UIを表示しない。

ローカルからサーバーだけを配備する場合は、対象を明示する。

```powershell
firebase deploy --config firebase.r2.json --only functions:r2,firestore:indexes --project cuebook-biz-xtv
```

配備後は `firebase functions:list --project cuebook-biz-xtv` で6関数を確認する。権限エラーの場合は、エラーに記載された不足権限を配備用サービスアカウントへ設定する必要がある。存在確認だけの段階では、不足権限や課金プランの不備を推測で断定しない。

## ログイン済みでも保存ボタンが無効の場合

Firebase Authenticationのカスタムクレーム `cuebookPlan: "biz"` が必要。単にFirestoreのユーザードキュメントへ文字列を書くだけでは認可されない。対象UIDをFirebase Console → Authentication → Usersから確認し、信頼できる管理環境でAdmin SDKを使用する。既存クレームを保持して更新する。

```js
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
initializeApp({ credential: applicationDefault(), projectId: 'cuebook-biz-xtv' });
const uid = '対象アカウントのUID';
const user = await getAuth().getUser(uid);
await getAuth().setCustomUserClaims(uid, { ...user.customClaims, cuebookPlan: 'biz' });
```

管理用のApplication Default Credentialsが必要。ブラウザへサービスアカウント鍵を渡さない。更新後はCueBookでログアウト・再ログインし、IDトークンへ新しいクレームを反映する。[Firebase公式のカスタムクレーム説明](https://firebase.google.com/docs/auth/admin/custom-claims)

## CORS設定を変更した場合

Cloudflare → R2 → 対象バケット → Settings → CORS Policyで、既存ルールを残しながらBizのOriginを許可する。現在の独自ドメインは確認済み。Firebase標準URLでも使う場合はそのOriginも含める。

```json
[
  {
    "AllowedOrigins": [
      "https://qbook-biz-xtv.keikeilab.net",
      "https://cuebook-biz-xtv.web.app",
      "https://cuebook-biz-xtv.firebaseapp.com"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

署名付きURLでもブラウザからの保存・取得にはCORS設定が必要。バケットの公開アクセスは本機能には不要。[Cloudflare公式のCORS説明](https://developers.cloudflare.com/r2/buckets/cors/)

## 本番での完了確認

1. Bizアカウントでログインし、編集 → 演出音響 → 音源を選択する。
2. 「音声をCloudflareに保存」から小さいMP3またはWAVを選ぶ。成功時だけURLが `r2://...` に変わる。
3. 試聴し、停止・再開・ループ・フェードを確認する。再読み込み後とGM画面でも再生する。
4. 取得待ち中に停止／シナリオを切り替え、後から勝手に再生しないことを確認する。
5. 保存失敗時は既存音源が維持され、エラー表示と再試行ができることを確認する。通常版ではCloudflare音声保存操作が出ないことを確認する。

Functionsへの呼び出しが404なら配備、permission-deniedならBizクレームを先に確認する。R2の403はキーの有効性・対象バケットのObject Read & Write権限・署名期限、ブラウザのCORSエラーはOriginとPUT／GET許可を確認する。

## GitHub配備で確認した不足権限

2026-10-01のActionsログで、配備用サービスアカウントが `cuebook-biz-xtv@appspot.gserviceaccount.com` に対する `iam.serviceAccounts.actAs` を持たず停止することを確認した。

[Google Cloudのサービスアカウント](https://console.cloud.google.com/iam-admin/serviceaccounts?project=cuebook-biz-xtv) で上記実行アカウントを開き、Permissions（権限）→ Grant access（アクセスを許可）から、GitHub Environment `biz-xtv` の `FIREBASE_DEPLOYER_SERVICE_ACCOUNT` に設定している配備用アカウントへ **Service Account User（サービス アカウント ユーザー／roles/iam.serviceAccountUser）** を付与する。実行アカウントを対象とする権限に限定する。利用者のBizクレームやCloudflareのR2キーとは別の権限。

専用ブランチからの実行は既存WIFのattribute conditionで拒否されるため、ワークフロー自体はmainから起動する。実際に配備するコードはrelease_tagで固定する。
