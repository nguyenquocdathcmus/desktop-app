import type { Strings } from './en'

export const ja: Strings = {
  controlBar: {
    undo: '元に戻す',
    redo: 'やり直す',
    play: '再生',
    pause: '一時停止',
    seek: 'シーク'
  },
  recording: {
    startRecording: '録画を開始',
    stop: '停止',
    resume: '再開',
    pauseAction: '一時停止',
    cancel: 'キャンセル',
    savedOpeningEditor: '保存しました — エディタを開いています…',
    statusReady: '録画準備完了',
    statusRecording: '録画中',
    statusPaused: '録画を一時停止中',
    statusSaving: '録画を保存中',
    statusSaved: '録画を保存しました'
  },
  timeline: {
    addZoom: '+ ズーム',
    addText: '+ テキスト',
    addScene: '+ シーン',
    detectSilences: '無音部分を検出',
    detecting: '検出中…',
    splitAt: 'ここで分割'
  },
  exportModal: {
    title: '書き出し',
    cancel: 'キャンセル',
    exporting: '書き出し中…',
    copyFile: 'ファイルをコピー',
    copied: 'コピーしました ✓',
    drag: 'ドラッグ',
    showInFinder: 'Finderに表示'
  },
  homeScreen: {
    title: '最近の録画',
    searchPlaceholder: '名前や日付で検索…',
    sortNewest: '新しい順',
    sortOldest: '古い順',
    sortLongest: '長い順',
    sortLargest: 'サイズが大きい順',
    gridView: 'グリッド表示',
    listView: 'リスト表示',
    showRecordingControls: '録画コントロールを表示',
    hideRecordingControls: '録画コントロールを隠す',
    recordingCountOne: '1件の録画',
    recordingCountOther: '{count}件の録画',
    recordingCountOf: '{total}件中{shown}件',
    emptyTitle: 'まだ録画がありません',
    emptyBody: 'コントロールウィンドウから最初の画面録画を開始してください。',
    untitledRecording: '無題の録画',
    showInFinder: 'Finderに表示',
    deleteRecording: '録画を削除',
    renameHint: 'ダブルクリックで名前を変更',
    loadMore: 'もっと読み込む',
    loading: '読み込み中…',
    recoveryFound: '前回のセッションから未保存の作業が見つかりました',
    recoveryRecover: '復元',
    recoveryDiscard: '破棄'
  },
  settings: {
    title: '設定',
    language: '言語',
    languageHint: 'アプリ全体に即座に反映されます。',
    theme: '外観',
    themeDark: 'ダーク',
    themeLight: 'ライト',
    themeSystem: 'システム',
    analyticsToggle: '匿名の利用データを共有する',
    analyticsHint: '使用した機能と書き出し設定のみ — 動画の内容、注釈テキスト、実際のファイルパスは含まれません。',
    publishDestinations: '公開先',
    connect: '接続',
    disconnect: '接続解除',
    shortcutTitle: 'グローバル開始/停止ショートカット',
    shortcutHint: 'Screen Studioにフォーカスがなくても動作します。',
    shortcutSet: '設定',
    shortcutChange: '変更',
    shortcutClear: 'クリア',
    shortcutNotSet: '未設定',
    shortcutRecording: 'キーの組み合わせを押してください…（Escでキャンセル）'
  }
}
