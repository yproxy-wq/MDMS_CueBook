<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# CueBook

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/1c8987be-d77f-408f-bc92-262abe57f70d

## ローカル実行

**前提:** Node.js


1. 依存関係をインストールします。
   `npm ci`
2. 開発サーバーを起動します。
   `npm run dev`

Gemini API key はこのクライアントアプリでは使用しません。秘密鍵を `.env.local` やブラウザ向け build 設定に追加しないでください。

## Firebase Hosting への配備

このリポジトリには SPA rewrite とキャッシュ設定を含む `firebase.json`、および Firebase project alias を含む `.firebaserc` を用意しています。初回配備は対象 Firebase プロジェクトの所有者が実施してください。

1. `npm run verify` を実行します。開発環境へ配備する場合は、続けて `npm run build:development` を実行します。
2. Firebase CLI にログインします: `npx firebase-tools login`
3. 開発環境へ配備します: `npx firebase-tools deploy --only hosting,firestore:rules --project cuebook-dev`
4. 開発環境で直接 URL の再読み込み・Google ログイン・同期画面を確認してから、stable / business を明示指定して配備します。

配備前に必ず Firestore rules と GCP API key の HTTP referrer 制限を確認してください。Firebase接続設定はVite modeごとに分離し、Hostingの配備先と認証・Firestoreの接続先を一致させます。
