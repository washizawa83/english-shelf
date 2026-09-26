# English Shelf

GitHub repository: `english-shelf`

Electron + Reactで動くローカル英語学習アプリです。既定では既存のSQLiteデータをそのまま使用します。

## データストア構成

UIとpreloadはIPCだけを使用し、ElectronメインプロセスとMCPサーバーは `StudyService` と共通DataStore契約を介してデータへアクセスします。

- `src/data-store/contract.js`: 実装が満たす共通契約
- `src/data-store/factory.js`: 環境設定からAdapterを選択
- `src/database.js`: 既存SQLite Repository（既定・後方互換）
- `src/data-store/node-sqlite.js`: 通常NodeでMCPを動かすための `node:sqlite` 互換Adapter
- `src/data-store/mysql.js`: `mysql2` Poolを使うMySQL Adapter
- `src/data-store/postgresql.js`: `pg` Poolを使うPostgreSQL Adapter
- `src/data-store/remote-sql-store.js`: MySQL/PostgreSQL共通Repository実装
- `src/data-store/migrations.js`: 方言別バージョン管理スキーマ
- `src/study-service.js`: IPC/MCPが利用するアプリケーション境界

## 設定

環境変数を指定しない場合は従来どおり `data/english-study.db` を使用します。

```text
ENGLISH_SHELF_DB_DRIVER=sqlite
ENGLISH_SHELF_DB=C:\path\to\english-study.db
```

MySQL:

```text
ENGLISH_SHELF_DB_DRIVER=mysql
ENGLISH_SHELF_DATABASE_URL=mysql://user:password@localhost:3306/english_shelf
```

PostgreSQL:

```text
ENGLISH_SHELF_DB_DRIVER=postgresql
ENGLISH_SHELF_DATABASE_URL=postgresql://user:password@localhost:5432/english_shelf
```

`postgres` と `pg` は `postgresql`、`mariadb` は `mysql` の別名として利用できます。デスクトップ本体とMCPサーバーは同じ環境変数を参照するため、必ず同じ設定で起動してください。

### Supabase Data API

画面の「設定」では、Supabase URLと `sb_publishable_` で始まるPublishable Keyだけをローカル設定へ保存できます。DBパスワード、Secret Key、Service Role Keyは入力・保存できません。接続確認はData API上の存在しない確認用テーブルへの読み取り専用GETです。PostgREST固有の「テーブルなし」応答により、データへ触れずにURL・キー・Data API到達性を確認します。OpenAPIルート `/rest/v1/` はPublishable Keyを拒否する構成があるため使用しません。未設定時は従来どおりSQLiteだけを使用します。

「SQLiteからSupabaseへ移行」は明示操作した場合だけ動きます。接続確認後にアプリが一度限りの移行トークンを生成し、Supabase DashboardのSQL Editorで実行するセットアップSQLを表示します。このSQLは次を行います。

- English Shelf専用テーブルを作成し、全テーブルでRLSを有効化
- `anon` / `authenticated` の通常テーブル権限を剥奪
- ハッシュ化した一度限りトークンでのみ呼べる移行RPCを用意
- RPC内の単一トランザクションで単語、英文・文法、カリキュラム、関連付け、学習記録をコピー
- コピー後のID・関係・内容をアプリ側のSHA-256照合で検証

管理用キーはアプリへ渡しません。ローカルSQLiteは削除・更新されず、移行成功後も既定接続先はSQLiteのままです。Supabaseを通常の保存先として利用する切り替えは、この移行操作とは別に明示設定する必要があります。

### 読み書き先をSupabaseへ切り替える

設定画面の「読み書き先を切り替える」から行います。

1. 「読み取り接続を確認」を完了
2. 「Supabase利用SQLを生成」し、表示されたSQLをDashboardのSQL Editorで実行
3. 「SQL実行済み・移行データを再照合」でSQLiteとSupabaseの全件・内容を確認
4. 「Supabaseを使用する」を押し、影響を確認して明示切替

利用SQLは端末専用トークンのハッシュ、RLS判定関数、最小限のテーブル権限を設定します。生の端末トークンはSQLへ含めず、ローカルの運用状態ファイルにだけ保存します。Secret KeyやService Role Keyは使用しません。切替直前にも全データを再照合し、不一致時はSQLiteを維持します。

切替後はデスクトップアプリとMCPが同じ運用状態を参照し、新規追加、更新、復習結果、学習記録をSupabaseへ読み書きします。「SQLiteへ戻す」でいつでもローカルSQLiteへ復帰できます。復帰してもSupabase上のコピーは削除されません。

## マイグレーション

MySQL/PostgreSQLでは接続時に `schema_migrations` を確認し、未適用の方言別マイグレーションを適用します。PostgreSQLでは一連の変更をトランザクションで保護し、DDLが暗黙にコミットされるMySQLでは冪等なDDLと適用済みバージョンで進行を管理します。無効化する場合は次を指定し、運用側で同じマイグレーションを事前適用してください。

```text
ENGLISH_SHELF_DB_AUTO_MIGRATE=false
```

新しい変更は既存SQLを書き換えず、`migrationsFor()` に連番バージョンを追加します。本番ではバックアップ、ステージング適用、アプリ停止、マイグレーション、アプリ再開の順を推奨します。SQLiteの既存インプレース移行は従来実装を維持します。

データベース製品間の既存データ自動コピーは行いません。Supabase向けには上記の明示移行を利用できます。MySQL/PostgreSQLへ切り替える場合は、バックアップから対象DBへ明示的に移送し、件数と内容を検証してからdriverを変更してください。

## 開発

```text
npm test
npm run verify:ui
npm start
```

SQLiteはElectronでは `better-sqlite3`、通常Nodeで動くMCPでは標準の `node:sqlite` を選びます。両者は同じRepository実装と契約を共有します。MySQL/PostgreSQLのAdapterは実接続用ドライバを含みますが、通常のテストは外部DBへ接続しません。

## PWA / Vercel

React rendererはElectronに加えて、iPhone対応PWAとしてビルドできます。manifest、ホーム画面アイコン、safe-area対応、オフライン用app shell、SPA rewriteを含みます。

```text
npm run build:web
```

成果物は `dist/renderer` です。VercelではリポジトリをImportすると `vercel.json` のBuild CommandとOutput Directoryが使用されます。CLIからのdeployやpushを行う必要はありません。

### Supabase設定

Web版では次のどちらかを使います。

1. 初回起動時に「設定」画面へSupabase URLとPublishable Keyを入力
2. Vercel Project Settings > Environment Variablesへ次を登録

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

これらはブラウザ公開前提の値です。Secret Key、Service Role Key、DBパスワードは環境変数・Git・Vercel設定へ絶対に追加しないでください。`.env`系ファイル、ローカルDB、ローカル接続状態、Vercelローカル設定、ビルド成果物は `.gitignore` 対象です。

初回端末では「Supabase利用SQLを生成」し、DashboardのSQL Editorで実行してから「Supabaseデータを確認」「Supabaseを使用する」の順に有効化します。端末トークンはブラウザのlocalStorageにだけ保存され、生成SQLにはハッシュだけが含まれます。

Web版では単語、英文・文法、カリキュラム、学習記録、復習をSupabase Data API経由で利用します。SQLite、SQLiteからの移行、MCP、デスクトップへの復帰はElectronデスクトップ版専用です。オフライン時は画面app shellを開けますが、Supabaseデータの読み書きにはネットワーク接続が必要です。

### iPhoneへ追加

VercelのHTTPS URLをSafariで開き、共有メニューから「ホーム画面に追加」を選びます。初回設定とSupabase有効化はインストール前後どちらでも行えます。
