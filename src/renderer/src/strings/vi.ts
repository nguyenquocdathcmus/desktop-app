import type { Strings } from './en'

export const vi: Strings = {
  controlBar: {
    undo: 'Hoàn tác',
    redo: 'Làm lại',
    play: 'Phát',
    pause: 'Tạm dừng',
    seek: 'Tua'
  },
  recording: {
    startRecording: 'Bắt đầu ghi',
    stop: 'Dừng',
    resume: 'Tiếp tục',
    pauseAction: 'Tạm dừng',
    cancel: 'Huỷ',
    savedOpeningEditor: 'Đã lưu — đang mở trình chỉnh sửa…',
    statusReady: 'Sẵn sàng ghi',
    statusRecording: 'Đang ghi',
    statusPaused: 'Đã tạm dừng ghi',
    statusSaving: 'Đang lưu bản ghi',
    statusSaved: 'Đã lưu bản ghi'
  },
  timeline: {
    addZoom: '+ Zoom',
    addText: '+ Văn bản',
    addScene: '+ Cảnh',
    detectSilences: 'Phát hiện khoảng lặng',
    detecting: 'Đang phát hiện…',
    splitAt: 'Cắt tại'
  },
  exportModal: {
    title: 'Xuất video',
    cancel: 'Huỷ',
    exporting: 'Đang xuất…',
    copyFile: 'Sao chép file',
    copied: 'Đã sao chép ✓',
    drag: 'Kéo',
    showInFinder: 'Hiện trong Finder'
  },
  homeScreen: {
    title: 'Bản ghi gần đây',
    searchPlaceholder: 'Tìm theo tên hoặc ngày…',
    sortNewest: 'Mới nhất',
    sortOldest: 'Cũ nhất',
    sortLongest: 'Dài nhất',
    sortLargest: 'Lớn nhất',
    gridView: 'Xem dạng lưới',
    listView: 'Xem dạng danh sách',
    showRecordingControls: 'Hiện bảng điều khiển ghi màn hình',
    hideRecordingControls: 'Ẩn bảng điều khiển ghi màn hình',
    recordingCountOne: '1 bản ghi',
    recordingCountOther: '{count} bản ghi',
    recordingCountOf: '{shown} / {total}',
    emptyTitle: 'Chưa có bản ghi nào',
    emptyBody: 'Dùng cửa sổ điều khiển để bắt đầu ghi màn hình đầu tiên.',
    untitledRecording: 'Bản ghi chưa đặt tên',
    showInFinder: 'Hiện trong Finder',
    deleteRecording: 'Xoá bản ghi',
    renameHint: 'Nhấp đúp để đổi tên',
    loadMore: 'Tải thêm',
    loading: 'Đang tải…',
    recoveryFound: 'Tìm thấy công việc chưa lưu từ phiên trước',
    recoveryRecover: 'Khôi phục',
    recoveryDiscard: 'Bỏ qua'
  },
  settings: {
    title: 'Cài đặt',
    language: 'Ngôn ngữ',
    languageHint: 'Áp dụng ngay trong toàn bộ ứng dụng.',
    theme: 'Giao diện',
    themeDark: 'Tối',
    themeLight: 'Sáng',
    themeSystem: 'Theo hệ thống',
    analyticsToggle: 'Chia sẻ dữ liệu sử dụng ẩn danh',
    analyticsHint: 'Tính năng bạn dùng và cấu hình xuất — không bao giờ gồm nội dung video, văn bản ghi chú, hay đường dẫn file thật.',
    publishDestinations: 'Nơi xuất bản',
    connect: 'Kết nối',
    disconnect: 'Ngắt kết nối',
    shortcutTitle: 'Phím tắt bắt đầu/dừng toàn cục',
    shortcutHint: 'Hoạt động ngay cả khi Screen Studio không được focus.',
    shortcutSet: 'Đặt',
    shortcutChange: 'Đổi',
    shortcutClear: 'Xoá',
    shortcutNotSet: 'Chưa đặt',
    shortcutRecording: 'Nhấn tổ hợp phím bất kỳ… (Esc để huỷ)'
  }
}
