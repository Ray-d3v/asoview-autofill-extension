# アソビュー 自動入力オーバーレイ

`https://www.asoview.com/purchase/*` で使う Chrome 拡張です。  
ページ右上に 2 つのオーバーレイボタンを表示し、ページ表示時の自動実行にも対応しています。

- 購入情報を自動入力
- カード情報を自動入力
- 既に値が入っている欄は上書きせず、空欄のみ入力

入力値はオプション画面で変更できます。

## インストール（開発者モード）

1. `chrome://extensions/` を開く
2. 右上の「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」
4. このフォルダを選択

## 単一ファイル配布（zip）

以下を実行すると、配布用 zip を作成できます。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-zip.ps1
```

作成先:

- `dist/asoview-autofill-extension.zip`

## zip を Chrome が直接読み込めるか

- 直接は読み込めません
- いったん解凍して、解凍後フォルダを「パッケージ化されていない拡張機能を読み込む」で指定してください

## 備考

- この拡張は `chrome.storage.local` に設定を保存します
- カード情報は `chrome.storage.local` に平文で保存されます
- 自動実行のON/OFF、対象（購入/カード）、再試行回数、待機時間はオプションで変更できます
- カード入力は iframe の読み込みタイミングに追従して再試行します
