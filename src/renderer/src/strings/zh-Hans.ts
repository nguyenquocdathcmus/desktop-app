import type { Strings } from './en'

export const zhHans: Strings = {
  controlBar: {
    undo: '撤销',
    redo: '重做',
    play: '播放',
    pause: '暂停',
    seek: '跳转'
  },
  recording: {
    startRecording: '开始录制',
    stop: '停止',
    resume: '继续',
    pauseAction: '暂停',
    cancel: '取消',
    savedOpeningEditor: '已保存 — 正在打开编辑器…',
    statusReady: '准备录制',
    statusRecording: '录制中',
    statusPaused: '录制已暂停',
    statusSaving: '正在保存录制',
    statusSaved: '录制已保存'
  },
  timeline: {
    addZoom: '+ 缩放',
    addText: '+ 文字',
    addScene: '+ 场景',
    detectSilences: '检测静音',
    detecting: '检测中…',
    splitAt: '在此分割'
  },
  exportModal: {
    title: '导出',
    cancel: '取消',
    exporting: '正在导出…',
    copyFile: '复制文件',
    copied: '已复制 ✓',
    drag: '拖动',
    showInFinder: '在访达中显示'
  },
  homeScreen: {
    title: '最近录制',
    searchPlaceholder: '按名称或日期搜索…',
    sortNewest: '最新',
    sortOldest: '最旧',
    sortLongest: '最长',
    sortLargest: '最大',
    gridView: '网格视图',
    listView: '列表视图',
    showRecordingControls: '显示录制控制面板',
    hideRecordingControls: '隐藏录制控制面板',
    recordingCountOne: '1 个录制',
    recordingCountOther: '{count} 个录制',
    recordingCountOf: '{total} 个中的 {shown} 个',
    emptyTitle: '暂无录制',
    emptyBody: '使用控制窗口开始您的第一次屏幕录制。',
    untitledRecording: '未命名录制',
    showInFinder: '在访达中显示',
    deleteRecording: '删除录制',
    renameHint: '双击以重命名',
    loadMore: '加载更多',
    loading: '加载中…',
    recoveryFound: '发现上一次会话的未保存内容',
    recoveryRecover: '恢复',
    recoveryDiscard: '放弃'
  },
  settings: {
    title: '设置',
    language: '语言',
    languageHint: '立即在整个应用中生效。',
    theme: '外观',
    themeDark: '深色',
    themeLight: '浅色',
    themeSystem: '跟随系统',
    analyticsToggle: '共享匿名使用数据',
    analyticsHint: '仅包含您使用的功能与导出配置 — 绝不包含视频内容、注释文字或真实文件路径。',
    publishDestinations: '发布目的地',
    connect: '连接',
    disconnect: '断开连接',
    shortcutTitle: '全局开始/停止快捷键',
    shortcutHint: '即使 Screen Studio 未处于焦点状态也能生效。',
    shortcutSet: '设置',
    shortcutChange: '更改',
    shortcutClear: '清除',
    shortcutNotSet: '未设置',
    shortcutRecording: '请按任意组合键…（按 Esc 取消）'
  }
}
