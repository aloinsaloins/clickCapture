# Click Capture - Chrome拡張機能仕様書

## 1. 概要
ユーザーがWebサイト上で要素をクリックするか、Enterキーを押した際に、自動的にスクリーンショットを取得・保存する拡張機能です。

## 2. 主要機能

### 2.1 スクリーンショット機能
- クリックイベントの検知
  - ユーザーがWebページ上の任意の要素をクリックした時
  - ユーザーがEnterキーを押した時
- スクリーンショットの自動取得
  - 表示されているページ全体のキャプチャ
  - キャプチャしたイメージはPNG形式で保存

### 2.2 拡張機能の制御
- 拡張機能のON/OFF切り替え
  - Chrome拡張のポップアップUIでトグルスイッチを提供
  - 設定状態の永続化（Chrome Storage APIを使用）

## 3. 技術仕様

### 3.1 必要なファイル構成
```
├── manifest.json          # 拡張機能の設定ファイル
├── popup.html            # 拡張機能のポップアップUI
├── popup.js             # ポップアップのロジック
├── content.js           # Webページに注入されるスクリプト
├── background.js        # バックグラウンド処理
└── icons/              # 拡張機能のアイコン
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### 3.2 権限要件
```json
{
  "permissions": [
    "activeTab",        // タブへのアクセス
    "storage",          // 設定の保存
    "downloads",        // スクリーンショットの保存
    "scripting"         // コンテンツスクリプトの実行
  ]
}
```

### 3.3 主要なコンポーネント機能

#### manifest.json
- マニフェストバージョン3を使用
- 必要な権限の定義
- コンテンツスクリプトの設定
- アイコンの設定

#### popup.html/js
- シンプルなON/OFFトグルスイッチ
- 現在の状態表示
- 設定変更時のイベントハンドリング

#### content.js
- クリックイベントのリスナー設定
- Enterキーイベントのリスナー設定
- イベント発生時のスクリーンショット要求

#### background.js
- スクリーンショットの取得処理
- ファイルのダウンロード処理
- 拡張機能の状態管理

## 4. ユーザーインターフェース

### 4.1 ポップアップUI
- シンプルなデザイン
- ON/OFFスイッチ
- 現在の状態表示
- 最小限の設定オプション

## 5. データ保存

### 5.1 設定データ
- Chrome Storage APIを使用
- 保存する項目：
  - 拡張機能の有効/無効状態
  - ユーザー設定（必要に応じて）

### 5.2 スクリーンショット
- ダウンロードフォルダに保存
- ファイル名フォーマット：
  - `{websiteName}_{number}.png`
    - `websiteName`: 現在のWebサイトのドメイン名（例：`google`、`github`）
    - `number`: 連番（同一サイトの場合1から順番にインクリメント）

### 5.3 ファイル名生成の実装詳細
```javascript
// ファイル名生成ロジック例
async function generateFileName(tab) {
  // URLからドメイン名を抽出
  const url = new URL(tab.url);
  const websiteName = url.hostname.replace(/^www\./, '').split('.')[0];
  
  // Chrome Storage APIを使用して現在のカウンターを取得
  const storageKey = `counter_${websiteName}`;
  const result = await chrome.storage.local.get(storageKey);
  const currentNumber = result[storageKey] || 0;
  const newNumber = currentNumber + 1;
  
  // カウンターを更新
  await chrome.storage.local.set({ [storageKey]: newNumber });
  
  return `${websiteName}_${newNumber}.png`;
}
```

### 5.4 カウンター管理
- 各Webサイトごとのカウンターをローカルストレージで管理
- ストレージキー: `counter_${websiteName}`
- 値: 現在の連番

## 6. エラーハンドリング
- スクリーンショット取得失敗時のエラー通知
- 権限エラー時のユーザーへの通知
- ネットワークエラー時の適切な処理
- ファイル名生成時のエラー処理
  - 無効なドメイン名の場合のフォールバック
  - ストレージエラー時の代替処理
  - ファイル名の重複防止

## 7. セキュリティ考慮事項
- センシティブなWebページでの動作制限
- ユーザーデータの適切な処理
- 必要最小限の権限要求

## 8. パフォーマンス考慮事項
- 効率的なイベントリスナーの実装
- メモリ使用量の最適化
- 不要な処理の最小化 