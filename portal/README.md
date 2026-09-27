# CueBook Portal

既存のCueBookアプリとは分離した、ポータルサイトの試作です。

## 起動

リポジトリルートで次を実行し、`http://localhost:4173/portal/` を開きます。

```powershell
python -m http.server 4173
```

## デザイン方針

- Hallmark: `Split Studio` / side-rail editorial composition
- CueBook: dark, technical, brutalist, elegant
- 主要CTA: Stable版へのリンク
- 背景: 提供されたCueBook同期画面コンセプトを使用
- モバイル: 縦レールを上部バーへ変形し、320px幅から横スクロールなし
