import type { Strings } from './en'

export const ko: Strings = {
  controlBar: {
    undo: '실행 취소',
    redo: '다시 실행',
    play: '재생',
    pause: '일시정지',
    seek: '탐색'
  },
  recording: {
    startRecording: '녹화 시작',
    stop: '중지',
    resume: '재개',
    pauseAction: '일시정지',
    cancel: '취소',
    savedOpeningEditor: '저장됨 — 편집기를 여는 중…',
    statusReady: '녹화 준비 완료',
    statusRecording: '녹화 중',
    statusPaused: '녹화 일시정지됨',
    statusSaving: '녹화 저장 중',
    statusSaved: '녹화가 저장됨'
  },
  timeline: {
    addZoom: '+ 확대',
    addText: '+ 텍스트',
    addScene: '+ 장면',
    detectSilences: '무음 구간 감지',
    detecting: '감지 중…',
    splitAt: '여기서 분할'
  },
  exportModal: {
    title: '내보내기',
    cancel: '취소',
    exporting: '내보내는 중…',
    copyFile: '파일 복사',
    copied: '복사됨 ✓',
    drag: '드래그',
    showInFinder: 'Finder에서 보기'
  },
  homeScreen: {
    title: '최근 녹화',
    searchPlaceholder: '이름 또는 날짜로 검색…',
    sortNewest: '최신순',
    sortOldest: '오래된순',
    sortLongest: '긴 순',
    sortLargest: '큰 순',
    gridView: '그리드 보기',
    listView: '목록 보기',
    showRecordingControls: '녹화 컨트롤 표시',
    hideRecordingControls: '녹화 컨트롤 숨기기',
    recordingCountOne: '녹화 1개',
    recordingCountOther: '녹화 {count}개',
    recordingCountOf: '{total}개 중 {shown}개',
    emptyTitle: '아직 녹화가 없습니다',
    emptyBody: '컨트롤 창을 사용하여 첫 화면 녹화를 시작하세요.',
    untitledRecording: '제목 없는 녹화',
    showInFinder: 'Finder에서 보기',
    deleteRecording: '녹화 삭제',
    renameHint: '더블클릭하여 이름 변경',
    loadMore: '더 불러오기',
    loading: '불러오는 중…',
    recoveryFound: '이전 세션의 저장되지 않은 작업을 찾았습니다',
    recoveryRecover: '복구',
    recoveryDiscard: '무시'
  },
  settings: {
    title: '설정',
    language: '언어',
    languageHint: '앱 전체에 즉시 적용됩니다.',
    theme: '테마',
    themeDark: '다크',
    themeLight: '라이트',
    themeSystem: '시스템',
    analyticsToggle: '익명 사용 데이터 공유',
    analyticsHint: '사용하는 기능과 내보내기 설정만 — 동영상 내용, 주석 텍스트, 실제 파일 경로는 절대 포함되지 않습니다.',
    publishDestinations: '게시 대상',
    connect: '연결',
    disconnect: '연결 해제',
    shortcutTitle: '전역 시작/중지 단축키',
    shortcutHint: 'Screen Studio에 포커스가 없어도 작동합니다.',
    shortcutSet: '설정',
    shortcutChange: '변경',
    shortcutClear: '지우기',
    shortcutNotSet: '설정되지 않음',
    shortcutRecording: '아무 키 조합이나 누르세요… (Esc로 취소)'
  }
}
