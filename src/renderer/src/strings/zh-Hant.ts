import type { Strings } from './en'

export const zhHant: Strings = {
  controlBar: {
    undo: '復原',
    redo: '重做',
    play: '播放',
    pause: '暫停',
    seek: '跳轉'
  },
  recording: {
    startRecording: '開始錄製',
    stop: '停止',
    resume: '繼續',
    pauseAction: '暫停',
    cancel: '取消',
    savedOpeningEditor: '已儲存 — 正在開啟編輯器…',
    statusReady: '準備錄製',
    statusRecording: '錄製中',
    statusPaused: '錄製已暫停',
    statusSaving: '正在儲存錄製',
    statusSaved: '錄製已儲存'
  },
  timeline: {
    addZoom: '+ 縮放',
    addText: '+ 文字',
    addScene: '+ 場景',
    detectSilences: '偵測靜音',
    detecting: '偵測中…',
    splitAt: '在此分割'
  },
  exportModal: {
    title: '匯出',
    cancel: '取消',
    exporting: '正在匯出…',
    copyFile: '複製檔案',
    copied: '已複製 ✓',
    drag: '拖曳',
    showInFinder: '在 Finder 中顯示'
  },
  homeScreen: {
    title: '最近錄製',
    searchPlaceholder: '依名稱或日期搜尋…',
    sortNewest: '最新',
    sortOldest: '最舊',
    sortLongest: '最長',
    sortLargest: '最大',
    gridView: '網格檢視',
    listView: '清單檢視',
    showRecordingControls: '顯示錄製控制面板',
    hideRecordingControls: '隱藏錄製控制面板',
    recordingCountOne: '1 個錄製',
    recordingCountOther: '{count} 個錄製',
    recordingCountOf: '{total} 個中的 {shown} 個',
    emptyTitle: '尚無錄製',
    emptyBody: '使用控制視窗開始您的第一次螢幕錄製。',
    untitledRecording: '未命名錄製',
    showInFinder: '在 Finder 中顯示',
    deleteRecording: '刪除錄製',
    renameHint: '雙擊以重新命名',
    loadMore: '載入更多',
    loading: '載入中…',
    recoveryFound: '發現上一個工作階段的未儲存內容',
    recoveryRecover: '復原',
    recoveryDiscard: '捨棄'
  },
  settings: {
    title: '設定',
    language: '語言',
    languageHint: '立即套用至整個應用程式。',
    theme: '外觀',
    themeDark: '深色',
    themeLight: '淺色',
    themeSystem: '跟隨系統',
    analyticsToggle: '分享匿名使用資料',
    analyticsHint: '僅包含您使用的功能與匯出設定 — 絕不包含影片內容、註解文字或真實檔案路徑。',
    publishDestinations: '發布目的地',
    connect: '連接',
    disconnect: '中斷連接',
    shortcutTitle: '全域開始/停止快速鍵',
    shortcutHint: '即使 Screen Studio 未取得焦點也能運作。',
    shortcutSet: '設定',
    shortcutChange: '變更',
    shortcutClear: '清除',
    shortcutNotSet: '尚未設定',
    shortcutRecording: '請按任意按鍵組合…（按 Esc 取消）'
  }
}
