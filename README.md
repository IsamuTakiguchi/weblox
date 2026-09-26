# Weblox

**あそぶ・つくる・みんなにみせる。** Roblox のように、ゲームで遊べて、自分のゲームを作って公開できる Web アプリです。
5 歳の子どもでも、絵をタッチして置くだけでゲームが完成する「かんたんモード」を備えています。

- 🎮 **あそぶ** — 同梱のサンプルゲームと、公開されたゲームで遊べます（キーボード／タッチ対応）
- ✨ **かんたんモード** — せかい → しゅじんこう → 絵をおく → できた！の 4 ステップ。字が読めなくても音声読み上げでガイド
- 🛠️ **スタジオ** — 大きなマップ、かぎとドア、ワープ、ばね、制限時間、クリア条件などを細かく設定
- 🌍 **公開・シェア** — 『みんなのゲーム』に公開。ゲームデータ丸ごと入りのリンクで友だちに送れる（サーバー・アカウント不要）
- 🧢 **アバター** — 顔・色・ぼうしをカスタマイズ。ゲームをクリアして貯めた「ウェブックス」でぼうしを買える
- 🚀 **全自動デプロイ** — `main` に push すると GitHub Actions がテスト → ビルド → GitHub Pages 公開まで行う

## 公開 URL

`main` へのマージ後、GitHub Actions が自動でデプロイします。

```
https://<GitHubユーザー名>.github.io/weblox/
```

### 初回だけ必要な設定（1 回きり）

GitHub Actions のトークンには Pages サイトを**新規作成**する権限がないため、最初の 1 回だけリポジトリ設定で Pages を有効にしてください。

1. **Settings → Pages**（`https://github.com/<owner>/weblox/settings/pages`）を開く
2. **Build and deployment → Source** で **GitHub Actions** を選ぶ
   （**Deploy from a branch** → Branch `gh-pages` / `/ (root)` でも動きます）
3. Actions タブで「Deploy to GitHub Pages」を **Run workflow** するか、`main` に何か push する

以降は `main` に push するたびに全自動でデプロイされます。ワークフローは Source の設定を自動判別し、
「GitHub Actions」なら `actions/deploy-pages`、「Deploy from a branch」なら `gh-pages` ブランチへの push でデプロイします。
Pages が未設定のまま実行された場合は、ジョブのサマリーに上記の手順を表示して失敗します。

## 開発

```bash
npm ci          # 依存関係のインストール
npm run dev     # 開発サーバー (http://localhost:5173)
npm test        # ユニットテスト (vitest)
npm run typecheck
npm run build   # dist/ に本番ビルド
npm run preview # ビルド結果の確認
```

Node.js 20 以上が必要です。

## 仕組み

| 項目 | 内容 |
| --- | --- |
| フロントエンド | Vite + React 19 + TypeScript。フレームワーク以外の依存は `lz-string` のみ |
| ゲームエンジン | `src/engine/` — タイルベースの 2D エンジン。上から見る「あるく」モードと横スクロールの「ジャンプ」モード |
| データ保存 | ブラウザの `localStorage`（下書き・公開ゲーム・アバター・ウェブックス） |
| シェア | ゲームデータを `lz-string` で圧縮し URL のハッシュに埋め込む（`#/play/s/<code>`） |
| ルーティング | ハッシュルーティング。GitHub Pages で 404 が出ない |
| CI | `.github/workflows/ci.yml` — 全ブランチと PR で型チェック・テスト・ビルド |
| デプロイ | `.github/workflows/deploy.yml` — `main` への push で GitHub Pages に自動公開（Source 設定を自動判別） |

### 「公開」の範囲について

バックエンドを持たない構成なので、「公開」したゲームは **その端末のブラウザ** の『みんなのゲーム』に並びます。
ほかの人に遊んでもらうときは「🔗 シェア」でリンクを送ってください。リンクにゲームが丸ごと入っているので、受け取った側はそのまま遊べて、「📚 ほぞん」で自分のライブラリに保存できます。
世界中のユーザーで一つのギャラリーを共有したい場合は、`src/store/store.ts` の公開処理を Firebase / Supabase などの外部 DB に差し替えてください。

## ディレクトリ

```
src/
  engine/      タイル定義・テーマ・レベル操作・ランタイム(物理/当たり判定)・描画
  components/  ゲームキャンバス、グリッドエディタ、共通 UI
  pages/       ホーム / あそぶ / プレイ / つくる / かんたんモード / スタジオ / アバター / マイページ / ヘルプ
  store/       localStorage 永続化 + React フック
  share/       共有リンクの圧縮・復元、JSON 入出力
  data/        同梱サンプルゲーム
.github/workflows/
  ci.yml       型チェック・テスト・ビルド
  deploy.yml   GitHub Pages への自動デプロイ
```

## ライセンス

MIT
