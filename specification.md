# Click Capture - Chrome拡張機能仕様書

## 1. 概要
ユーザーがWebサイト上で**インタラクティブな要素**をクリックするか、Enterキーを押した際、または**ページ遷移が完了した際**に、自動的にスクリーンショットを取得・保存するChrome拡張機能です。

## 2. 主要機能

### 2.1 スクリーンショット機能
- **インタラクション検知 (content.js):**
  - ユーザーがWebページ上のインタラクティブな要素（ボタン、リンク、入力フィールドなど）をクリックした時。
    - 背景などの非インタラクティブな要素のクリックは無視。
  - ユーザーが特定の要素（入力フィールド、ボタンなど）でEnterキーを押した時。
- **ページ遷移検知 (background.js):**
  - `chrome.webNavigation.onCompleted` API を使用し、メインフレームのナビゲーション完了を検知。
- **スクリーンショットの自動取得 (background.js):**
  - **クリック/Enterキー操作時:**
    - **リンク (`<a>` タグ) クリックの場合:**
      - **即時キャプチャ:** クリック直後に表示されているタブの可視領域をキャプチャ。
      - **遅延キャプチャ:** クリックから**一定時間後**（動的コンテンツ生成を考慮）に表示されているタブの可視領域をキャプチャ。
    - **リンク以外のクリック/Enterキー操作の場合:**
      - **遅延キャプチャのみ:** 操作から**一定時間後**に表示されているタブの可視領域をキャプチャ。
  - **ページ遷移完了時:**
    - **遅延キャプチャのみ:** ページ読み込み完了から**一定時間後**に表示されているタブの可視領域をキャプチャ（`autoCapture` 設定が有効かつサイトが許可リストにある場合）。
  - キャプチャしたイメージは**PNG形式**で保存。

### 2.2 拡張機能の制御
- **グローバルな有効/無効切り替え:**
  - ポップアップUIで拡張機能全体のON/OFFを切り替え可能。
- **サイトごとの許可リスト:**
  - ポップアップUIで、現在表示しているサイトを許可リストに追加・削除可能。
  - 許可されたサイトのリストを表示。
  - 拡張機能は、**グローバル設定がON**であり、**かつ**表示中のサイトが**許可リストに含まれている**場合にのみ動作。
- **設定の永続化:**
  - グローバル設定 (`isGloballyEnabled`)、許可リスト (`allowedSites`)、自動キャプチャ設定 (`autoCapture`)、カウンター (`counter_*`) はChrome Storage APIを使用して保存。

## 3. 技術仕様

### 3.1 必要なファイル構成
```
├── manifest.json          # 拡張機能の設定ファイル
├── popup.html            # 拡張機能のポップアップUI
├── popup.js             # ポップアップのロジック
├── content.js           # Webページに注入されるスクリプト
├── background.js        # バックグラウンド処理 (Service Worker)
├── specification.md       # この仕様書
├── .gitignore           # Git管理から除外するファイル
└── icons/              # 拡張機能のアイコン
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### 3.2 権限要件
```json
{
  "permissions": [
    "storage",          // 設定（許可リスト含む）の保存
    "downloads",        // スクリーンショットの保存
    "scripting",        // コンテンツスクリプトの実行
    "tabs",             // 現在のタブ情報の取得、スクリーンショット取得
    "webNavigation"     // ページ遷移イベントの検知
  ],
  "host_permissions": [
    "<all_urls>"        // 任意のサイトでコンテンツスクリプトを実行し、スクリーンショットを取得するため
  ]
}
```

### 3.3 主要なコンポーネント機能

#### manifest.json
- マニフェストバージョン3を使用。
- 必要な権限 (`storage`, `downloads`, `scripting`, `tabs`, `webNavigation`, `host_permissions`) を定義。
- ポップアップUI (`popup.html`) を指定。
- バックグラウンドサービスワーカー (`background.js`) を指定。
- コンテンツスクリプト (`content.js`) を全てのURL (`<all_urls>`) で実行するように設定。
- アイコンを設定。

#### popup.html / popup.js
- 拡張機能全体の有効/無効を切り替えるトグルスイッチ (`isGloballyEnabled`)。
- ページ遷移時の自動キャプチャを有効/無効にするトグルスイッチ (`autoCapture`) (任意追加、現在の実装では常に有効扱いだが設定は読み込む)。
- 現在表示しているサイトのホスト名を表示。
- 現在のサイトを許可リストに追加/削除するボタン (`allowedSites`)。
- 許可されているサイトのリストを表示し、リストから直接削除する機能。
- `chrome.storage.local` を使用して、設定を読み込み・保存。

#### content.js
- `click` および `keydown` (Enterキー) イベントリスナーを設定。
- クリックイベントが発生した際、要素自身または祖先要素がインタラクティブかを判定。
- インタラクティブな要素でのインタラクション、または特定の要素でのEnterキー押下を検知。
- **設定確認:** `background.js` に `checkSettings` メッセージを送信し、現在のサイトが許可されているか確認。
- **スクリーンショット要求:** サイトが許可されている場合、`background.js` に `takeScreenshot` メッセージを送信。
  - リンク (`<a>` タグ) クリックの場合は `{ captureImmediate: true }` オプションを付けて送信。
  - それ以外の場合はオプションなし (または `{ captureImmediate: false }`) で送信。

#### background.js
- **設定確認応答:** `checkSettings` メッセージを受信し、`chrome.storage.local` から `isGloballyEnabled` と `allowedSites` を読み取り、許可状態 (`{ isAllowed: boolean }`) を `content.js` に応答。
- **スクリーンショット処理 (`handleScreenshotRequest`):** `takeScreenshot` メッセージまたは `webNavigation` イベントから呼び出される。
  - 引数としてタブIDと `options` (例: `{ captureImmediate: boolean }`) を受け取る。
  - `options.captureImmediate` が `true` の場合、**即時スクリーンショット**を撮影・保存 (`_immediate.png`)。
  - `SCREENSHOT_DELAY_MS` だけ待機。
  - 待機後にタブのURL (ホスト名) が変わっていないか確認し、変わっていれば遅延キャプチャをスキップ。
  - **遅延スクリーンショット**を撮影・保存 (`_delayed.png`)。
  - `chrome.tabs.captureVisibleTab` と `chrome.downloads.download` を使用。
- **ページ遷移後キャプチャ:** `chrome.webNavigation.onCompleted` リスナーを設定。
  - メインフレームのナビゲーション完了を検知。
  - `chrome.storage.local` から `autoCapture` 設定と `allowedSites` を読み込む。
  - `autoCapture` が有効かつ遷移先URLが許可リストに含まれている場合、`handleScreenshotRequest` を呼び出し**遅延スクリーンショット**のみを撮影 (`{ captureImmediate: false }`)。
- **ファイル名・カウンター管理:**
  - `handleScreenshotRequest` 内でサイトごとのカウンターを取得・更新 (`counter_{websiteName}` を使用)。
  - 即時キャプチャのファイル名: `{websiteName}_{number}_immediate.png`
  - 遅延キャプチャのファイル名: `{websiteName}_{number}_delayed.png`

## 4. ユーザーインターフェース

### 4.1 ポップアップUI
- **拡張機能全体セクション:**
  - ON/OFFトグルスイッチと現在の状態（有効/無効）表示。
- **現在のサイトセクション:**
  - 表示中のサイトのホスト名を表示。
  - 「許可リストに追加」または「リストから削除」ボタン（状態に応じて切り替え）。
- **許可されたサイトリストセクション:**
  - 許可されているサイトのホスト名リスト。
  - 各サイト名の横に「削除」ボタン。
- (オプション) **自動キャプチャセクション:**
  - ページ遷移時の自動キャプチャ ON/OFF トグルスイッチ。

## 5. データ保存

### 5.1 設定データ
- **保存場所:** Chrome Storage API (`chrome.storage.local`)
- **保存する項目:**
  - `isGloballyEnabled` (Boolean): 拡張機能全体の有効/無効状態。
  - `allowedSites` (Array<String>): 許可されたサイトのホスト名リスト。
  - `autoCapture` (Boolean): ページ遷移時の自動キャプチャ有効/無効状態 (デフォルト: true)。
  - `counter_{websiteName}` (Number): 各サイトごとのスクリーンショット連番カウンター。

### 5.2 スクリーンショット
- **保存場所:** ブラウザのデフォルトダウンロードフォルダ。
- **フォーマット:** PNG形式。
- **ファイル名:**
  - 即時キャプチャ: `{websiteName}_{number}_immediate.png`
  - 遅延キャプチャ: `{websiteName}_{number}_delayed.png`
- **タイミング:**
  - 即時: リンククリック直後。
  - 遅延: クリック/Enter/ページ遷移完了から一定時間後。

### 5.3 ファイル名生成とカウンター管理
- `background.js` の `handleScreenshotRequest` 関数内で統合的に処理。
- 現在のタブからホスト名を抽出し、対応する `counter_{websiteName}` を `chrome.storage.local` から取得。
- カウンターをインクリメントして保存し、ファイル名を生成。

## 6. エラーハンドリング
- ポップアップでのタブ情報取得エラー。
- コンテンツスクリプトでのメッセージ送信エラー。
- バックグラウンドでのタブ情報取得、URLパース、スクリーンショット取得、ダウンロード、`webNavigation` イベント処理エラー。
- ファイル名生成時のカウンター取得・保存エラー。
- エラーは主にデベロッパーコンソールに出力。

## 7. セキュリティ考慮事項
- ユーザーが明示的に許可したサイトでのみ動作。
- 必要最小限の権限 (`storage`, `downloads`, `scripting`, `tabs`, `webNavigation`, `<all_urls>`) を要求。
- `<all_urls>` 権限は広範なため、ユーザーへの説明が必要。

## 8. パフォーマンス考慮事項
- コンテンツスクリプトのイベントリスナーは効率的に実装。
- `isElementOrAncestorInteractive` 関数の DOM 探索と `getComputedStyle` 呼び出しは、複雑なページでは負荷になる可能性がある。
- スクリーンショット取得前の遅延 (`SCREENSHOT_DELAY_MS`) は、ユーザー体験とキャプチャ精度とのトレードオフ。
- `webNavigation` リスナーは頻繁に呼び出される可能性があるため、処理は軽量に保つ。
- Service Worker のアイドル状態からの復帰時間を考慮。 