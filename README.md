# ADOC-S イラスト認知研究アプリ

リハビリテーション目標設定用イラスト(ADOC-S)を用いた、子どものイラスト認知発達研究のためのウェブアプリです。

## 構成

- フロントエンド: 静的サイト(Vue.js CDNビルド、ビルド工程なし)、GitHub Pagesで配信
- 画像配信: Cloudinary
- データベース・API: Supabase(Postgres + Edge Functions)
- 自動化: GitHub Actions

## 実装ステータス

- [x] ①Supabaseテーブル作成(スキーマ・RLS・ダミーイラストデータ)
- [x] ②認証・基本情報画面
- [x] ③イラスト回答画面
- [x] ④管理者画面
- [x] ⑤GitHub Actions自動化

---

## ①Supabaseセットアップ手順(このステージで必要な作業)

### 1. Supabaseプロジェクトを作成する

まだ作成していない場合は https://supabase.com でプロジェクトを新規作成してください(リージョンは `Northeast Asia (Tokyo)` を推奨)。

### 2. マイグレーションを適用する

以下のいずれかの方法で `supabase/migrations/0001_init.sql` の内容を実行してください。

**方法A: SQL Editorから実行(推奨・最も簡単)**

1. Supabaseダッシュボード → 左メニュー「SQL Editor」を開く
2. `supabase/migrations/0001_init.sql` の中身を全部コピーして貼り付け
3. 「Run」を実行

**方法B: Supabase CLIから実行**

```bash
npm install -g supabase
supabase login
supabase link --project-ref <あなたのプロジェクトref>
supabase db push
```

### 3. 実行結果を確認する

Table Editorで以下のテーブルが作成されていることを確認してください。

- `subjects`
- `illustrations`(ダミーデータ68件が入っています)
- `responses`
- `admins`
- `error_logs`

Authentication > Policies で、`illustrations` にのみ `illustrations_select_anon` という SELECT ポリシーがあり、他のテーブルにはポリシーが一つもない(=フロントエンドから直接アクセス不可)ことを確認してください。

### 4. 管理者アカウントを手動で1件登録する(採点者用)

このアプリでは管理者アカウントの自己登録機能は用意していません(セキュリティ上、管理者発行は初回のみ手動で行う想定です)。以下の手順でパスワードをハッシュ化してから、SQL Editorで直接INSERTしてください。

1. ターミナルで以下を実行し、パスワードのハッシュ値を生成する(Node.jsが必要です)

   ```bash
   npx bcryptjs-cli hash "設定したいパスワード" 10
   ```

   もし上記コマンドが使えない場合は、以下のワンライナーでも生成できます。

   ```bash
   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" "設定したいパスワード"
   ```
   (`npm install bcryptjs` が未実行の場合は先に `npm install -g bcryptjs` などで用意してください)

2. SQL Editorで以下を実行(`<ハッシュ値>`を実際の出力に置き換えてください。`admin_code`はアルファベット始まりにする必要があります)

   ```sql
   insert into admins (admin_code, password_hash, name)
   values ('A01', '<ハッシュ値>', '採点者1の氏名');
   ```

   採点者は3名を想定しているとのことなので、同様に `A02`, `A03` としてあと2件登録してください。

### 5. まだ設定していないもの(次のステージ以降で使用)

- Cloudinary上の実イラスト画像・正解ラベル(用意でき次第、`illustrations`テーブルのダミーデータをUPDATE/DELETE→本データINSERTしてください)

---

## ②認証・基本情報画面セットアップ手順(このステージで必要な作業)

このステージでは、被験者ログイン(`login`)・基本情報保存(`submit-basic-info`)・エラーログ記録(`log-error`)の3つのEdge Functionと、`login.html`・`basic-info.html`(および③実装までの仮画面`assessment.html`)を実装しました。

### 1. Supabase CLIをセットアップする

まだの場合はインストールしてログイン・プロジェクトのリンクを行ってください。

```bash
npm install -g supabase
supabase login
cd adoc-s-app
supabase link --project-ref <あなたのプロジェクトref>
```

`<あなたのプロジェクトref>` はSupabaseダッシュボードのURL(`https://supabase.com/dashboard/project/xxxxxxxx`)の `xxxxxxxx` の部分です。

### 2. セッショントークン署名用の秘密鍵を設定する

このアプリはSupabase Authを使わず、独自のログインセッション(JWT)をEdge Function内で発行・検証します。その署名鍵をSecretsとして登録してください。

```bash
# ランダムな秘密鍵を生成する例(何でもよいですが、推測されない十分に長い文字列にしてください)
openssl rand -hex 32

# 生成した文字列を APP_JWT_SECRET として登録
supabase secrets set APP_JWT_SECRET=<生成した文字列>
```

(`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` はEdge Functionランタイムが自動的に用意するため、登録不要です。)

### 3. Edge Functionをデプロイする

```bash
supabase functions deploy login
supabase functions deploy submit-basic-info
supabase functions deploy log-error
```

デプロイ後、Supabaseダッシュボード → Edge Functions で3つとも `Active` になっていることを確認してください。

### 4. テスト用の被験者アカウントを手動で1件登録する

管理者画面(④で実装予定)がまだないため、動作確認用に被験者を1件だけSQL Editorで手動登録します。①の手順4で使ったのと同じ方法でパスワードのハッシュ値を生成し、以下を実行してください。

```sql
insert into subjects (subject_code, password_hash)
values ('001', '<ハッシュ値>');
```

### 5. フロントエンドの設定を書き換える

[js/config.js](js/config.js) の `FUNCTIONS_BASE_URL` を、あなたのSupabaseプロジェクトのURLに書き換えてください。

```js
window.APP_CONFIG = {
  FUNCTIONS_BASE_URL: "https://xxxxxxxx.supabase.co/functions/v1",
};
```

### 6. 動作確認する

`login.html` をブラウザで直接開く(ファイルをダブルクリック、またはVSCodeのLive Server等)か、GitHub Pagesにデプロイしてアクセスしてください。

1. 手順4で登録したID(`001`)とパスワードでログインできること
2. 初回ログインなので基本情報入力画面に遷移すること
3. 学年などを入力して「次へ進む」を押すと保存され、仮の確認画面(`assessment.html`)に遷移すること
4. Supabaseの `subjects` テーブルで、該当行の `age_group` が学年に応じて正しく自動判定されていること(例: 「小学校2年」→「小学校低学年」)
5. わざと間違ったパスワードでログインし、「IDとパスワードの組み合わせが正しくありません。担当者にご連絡ください」と表示されること

問題なければ、一度ログアウトする代わりにブラウザのプライベートウィンドウ等で再度ID `001` でログインし、今度は基本情報入力をスキップして仮の確認画面に直接遷移することも確認してください(2回目以降ログインの分岐)。

**追記(後日の修正)**: 基本情報入力の項目を見直し、先頭に「検査者」「検査日」を追加、「月齢」の直接入力は廃止して「生年月日」(任意)の入力に変更しました。月齢は検査日と生年月日から自動計算されます。この変更には`supabase/migrations/0004_add_exam_metadata_and_survey.sql`の適用と、`submit-basic-info`の再デプロイが必要です(手順は次の③セクション末尾を参照)。

---

## ③イラスト回答画面セットアップ手順(このステージで必要な作業)

このステージでは、出題(`get-next-question`)・回答保存(`submit-response`)の2つのEdge Functionと、`assessment.html`(実際のイラスト回答画面)を実装しました。

### 1. Edge Functionをデプロイする

```bash
supabase functions deploy get-next-question
supabase functions deploy submit-response
```

### 2. 動作確認する

②で使ったテスト被験者(`001`など、基本情報入力済みのもの)でログインし、以下を確認してください。

1. イラストが表示され、発話内容を入力して「次へ」を押すと次のイラストに進むこと
2. 「わからない」を押すと選択肢が表示され、選択して「次へ」を押しても正しく進むこと
3. 進捗表示(`n/m枚`)が回答するごとに1ずつ増えること
4. 「今日はここまで」を押すとログイン画面に戻り、再ログインすると続き(未回答分)から再開されること
5. すべてのイラストに回答し終えると、感想アンケート(子どもの難易度感想・保護者/検査者から見た理解度)が1回だけ表示され、送信すると「これで終了です。お疲れ様でした。」の終了画面が表示されること

### 3. 【追記】検査日・生年月日・感想アンケート機能を追加した際の手順

`supabase/migrations/0004_add_exam_metadata_and_survey.sql`を①と同じ方法(SQL EditorまたはCLI)で適用し、以下を(再)デプロイしてください。

```bash
supabase functions deploy submit-basic-info
supabase functions deploy get-next-question
supabase functions deploy submit-survey
supabase functions deploy admin-export-csv
supabase functions deploy backup-export-csv
```

(`admin-export-csv`/`backup-export-csv`はCSVエクスポートに新しい列を含めるための再デプロイです。)

---

## ④管理者画面セットアップ手順(このステージで必要な作業)

このステージでは、管理者ログイン(`admin-login`)・ID発行(`admin-issue-subject`)・進捗確認一覧(`admin-progress-list`)・採点用一覧と採点保存(`admin-score-list`/`admin-submit-score`)・CSVエクスポート(`admin-export-csv`)・エラーログ確認(`admin-error-logs`)の7つのEdge Functionと、`admin-login.html`・`admin.html`(タブ切り替え式の管理者ダッシュボード)を実装しました。

### 1. マイグレーションを適用する

`supabase/migrations/0003_add_next_subject_code_rpc.sql`を①と同じ方法(SQL EditorまたはCLI)で実行してください。ID発行機能が使う`subject_code`の連番発行用RPC関数を追加するものです。

### 2. Edge Functionをデプロイする

```bash
supabase functions deploy admin-login
supabase functions deploy admin-issue-subject
supabase functions deploy admin-progress-list
supabase functions deploy admin-score-list
supabase functions deploy admin-submit-score
supabase functions deploy admin-export-csv
supabase functions deploy admin-error-logs
```

新しいSecretsの追加は不要です(既存の`APP_JWT_SECRET`をそのまま使います)。

### 3. 管理者アカウントを登録する

まだ登録していない場合は、①の手順4と同じ方法で`admins`テーブルに1件以上登録してください(採点者3名分、`admin_code`は`A01`,`A02`,`A03`など英字始まりで)。

### 4. 動作確認する

1. `admin-login.html`を開き、登録した管理者IDでログインできること→`admin.html`に遷移すること
2. 「ID発行」タブで新規発行し、表示されたID・パスワードで実際に`login.html`からログインできること(この画面以外ではパスワードは二度と表示されません)
3. 「進捗確認」タブで、発行した被験者が`0/xx`のように一覧表示されること
4. その被験者で③のイラスト回答を何問か行った後、「採点」タブでその被験者を選択→回答内容と一緒に採点(正解/不正解/未評価)を保存できること。保存後、一覧の行が色付き表示に変わること。既に採点済みの行をもう一度採点しようとすると上書き確認のダイアログが出ること
5. 「CSVエクスポート」で被験者データ・回答データそれぞれをダウンロードし、Excel等で開いて日本語が文字化けしないこと
6. 「エラーログ」タブで`error_logs`の内容が一覧表示されること
7. 一般ログイン画面(`login.html`)と管理者ログイン画面(`admin-login.html`)は完全に別のセッションとして扱われ、互いに影響しないことを確認(片方でログインしたままもう片方を開いても、それぞれ別々にログインが必要)

---

## ⑤GitHub Actions自動化セットアップ手順(このステージで必要な作業)

このステージでは、(a) Supabase無料枠プロジェクトが非アクティブで自動休止しないようにする1日2回のkeep-aliveping、(b) `subjects`/`responses`テーブルの週次CSVバックアップをGoogle Driveにアップロードする処理を、GitHub Actionsで自動化しました。

新規に、認証不要の`health-check`(keep-alive用)と、固定の共有シークレットのみで認証する`backup-export-csv`(週次バックアップ専用、CIから呼ばれることのみを想定)の2つのEdge Functionを追加しています。管理者アカウントのJWTは12時間で失効しCIでの定期実行に向かないため、あえて別方式にしています。また、CSV生成ロジックを`admin-export-csv`と`backup-export-csv`で共通化するリファクタも行ったため、`admin-export-csv`も再デプロイ対象です。

**注意**: Google Driveへのアップロードは、個人のGoogleアカウント(Google Workspaceの共有ドライブが使えない場合)を想定し、サービスアカウントではなく**OAuth(ご自身のGoogleアカウントで一度だけ認可する方式)**を使います。サービスアカウントは自分自身のストレージ容量を持たないため、共有ドライブがない個人アカウントの通常フォルダには書き込めません(`storageQuotaExceeded`エラーになります)。

### 1. Google CloudでOAuthクライアントIDを作成する

1. [Google Cloud Console](https://console.cloud.google.com/)で新規または既存のプロジェクトを開く
2. 「APIとサービス」→「ライブラリ」から **Google Drive API** を有効化する
3. 「APIとサービス」→「OAuth同意画面」がまだ未設定なら、「External」(個人のGoogleアカウントの場合、Internalは選べません)を選び、アプリ名・自分のメールアドレスなど最低限の情報を入力して保存する
   - **重要**: 作成直後は「テスト」状態になっており、この状態だとリフレッシュトークンが7日で失効してしまい、週次バックアップが1週間後に止まります。「対象」タブにある **「アプリを公開」(PUBLISH APP)** ボタンを押して、必ず本番状態に切り替えてください(個人利用規模ならGoogleの審査は不要です)。公開後にご自身のアカウントで認証すると「Googleで確認されていません」という警告画面が出ますが、「詳細」→「(アプリ名)に移動(安全ではないページ)」と進めば問題なく認証できます
4. 「APIとサービス」→「認証情報」→「認証情報を作成」→「OAuthクライアントID」→ アプリケーションの種類は **デスクトップアプリ** を選択して作成する
5. 作成後に表示される「クライアントID」と「クライアントシークレット」を控える

### 2. Google Driveにバックアップ用フォルダを作成する

1. バックアップ先に使いたいGoogleアカウントで、Google Driveにバックアップ保存用のフォルダを新規作成する(自分のアカウントの通常のフォルダで構いません、共有設定は不要です)
2. フォルダを開いた時のURL(`https://drive.google.com/drive/folders/<フォルダID>`)から`<フォルダID>`の部分を控える

### 3. 手元でリフレッシュトークンを取得する

このリポジトリのルートで、以下を実行してください(GitHub Actions上ではなく、自分のPCで一度だけ行う作業です)。

```bash
npm install
GOOGLE_OAUTH_CLIENT_ID=<手順1で控えたクライアントID> \
GOOGLE_OAUTH_CLIENT_SECRET=<手順1で控えたクライアントシークレット> \
node scripts/get-refresh-token.mjs
```

表示されたURLをブラウザで開き、バックアップ先に使いたいGoogleアカウントでログインして許可してください。許可すると、ターミナルに「リフレッシュトークン」が表示されます。この値は後で使うので控えておいてください(この画面以外では二度と表示されません。紛失した場合は同じスクリプトをもう一度実行すれば再取得できます)。

### 4. GitHub Secretsを登録する

このリポジトリのGitHub(Settings → Secrets and variables → Actions → New repository secret)に以下を登録してください。

| Secret名 | 値 |
|---|---|
| `BACKUP_EXPORT_SECRET` | 次の手順5でSupabase側に登録するのと同じランダム文字列 |
| `GOOGLE_OAUTH_CLIENT_ID` | 手順1で控えたクライアントID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | 手順1で控えたクライアントシークレット |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | 手順3で取得したリフレッシュトークン |
| `GDRIVE_FOLDER_ID` | 手順2で控えたフォルダID |

### 5. Supabase Secretを登録する

```bash
# ランダムな共有シークレットを生成する例
openssl rand -hex 32

# 生成した文字列を、手順3で登録したGitHub Secretの BACKUP_EXPORT_SECRET と
# 同じ値でSupabase側にも登録する
supabase secrets set BACKUP_EXPORT_SECRET=<生成した文字列>
```

### 6. Edge Functionをデプロイする

```bash
supabase functions deploy health-check
supabase functions deploy backup-export-csv
supabase functions deploy admin-export-csv
```

(`admin-export-csv`はCSV生成ロジックの共通化リファクタに伴う再デプロイです。動作自体は変わりません。)

### 7. ワークフローファイルについて

- `.github/workflows/keep-alive.yml`: 毎日2回(JST 9:00 / 21:00)、`health-check`にリクエストを送るだけのシンプルなワークフローです。
- `.github/workflows/weekly-backup.yml`: 毎週月曜7:00(JST)に、`backup-export-csv`からsubjects/responses両方のCSVを取得し、Google Driveにアップロードします。

どちらも`workflow_dispatch`が有効なので、GitHubリポジトリの「Actions」タブから手動実行できます。このリポジトリをGitHubにpushし、上記のSecretsを登録した後で動作確認してください。

### 8. 動作確認する

1. GitHubの「Actions」タブから `Supabase Keep-Alive` を「Run workflow」で手動実行し、成功(緑のチェック)になること
2. 同様に `Weekly CSV Backup to Google Drive` を手動実行し、成功になること
3. 手順2で作成したGoogle Driveフォルダに `subjects_YYYY-MM-DD.csv` / `responses_YYYY-MM-DD.csv` が作成されており、Excel等で開いて日本語が文字化けしないこと
4. わざと間違った値で`backup-export-csv`を直接curlで叩き、401が返ってくること(例: `curl -X POST <FUNCTIONS_BASE_URL>/backup-export-csv -H "X-Backup-Secret: wrong" -d '{"table":"subjects"}'`)
5. ④の「CSVエクスポート」(`admin-export-csv`)が引き続き正常動作すること(リファクタの回帰確認)
6. Supabaseダッシュボード→Edge Functionsで `health-check` / `backup-export-csv` が両方 `Active` になっていること

すべて確認できたら、この README の一番上にあるステータスの `⑤GitHub Actions自動化` にもチェックを入れてください。

### 研究終了後の後片付け

研究が終了しこのアプリが不要になったら、以下を行ってセキュリティ上の後始末をしてください。

1. GitHub Secrets(`BACKUP_EXPORT_SECRET` / `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` / `GOOGLE_OAUTH_REFRESH_TOKEN` / `GDRIVE_FOLDER_ID`)をSettings → Secrets and variables → Actionsから削除する
2. `supabase secrets unset BACKUP_EXPORT_SECRET` を実行する
3. `.github/workflows/keep-alive.yml` / `weekly-backup.yml` を削除するか、Actionsタブから個別に「Disable workflow」する(定期実行だけ止めたい場合は各ファイルの`schedule:`の行を削除し`workflow_dispatch`だけ残す方法もあります)
4. Google Cloud Console → APIとサービス → 認証情報 から、作成したOAuthクライアントIDを削除する。本研究専用のGCPプロジェクトであれば、プロジェクトごと削除しても構いません
5. Google Driveのバックアップフォルダ(自分のアカウントの通常フォルダ)は、不要であれば削除する

---

## 完了

以上で①〜⑤全ステージの実装が完了しました。各ステージの「動作確認」チェックリストがすべて完了し、この README 冒頭のステータスがすべてチェック済みになれば、アプリは運用可能な状態です。研究終了後は、上記「⑤GitHub Actions自動化セットアップ手順」内の「研究終了後の後片付け」を参照し、Secrets・サービスアカウント・ワークフローの後始末をしてください。
