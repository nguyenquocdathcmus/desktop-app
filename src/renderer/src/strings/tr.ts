import type { Strings } from './en'

export const tr: Strings = {
  controlBar: {
    undo: 'Geri al',
    redo: 'Yinele',
    play: 'Oynat',
    pause: 'Duraklat',
    seek: 'Ara'
  },
  recording: {
    startRecording: 'Kaydı başlat',
    stop: 'Durdur',
    resume: 'Devam et',
    pauseAction: 'Duraklat',
    cancel: 'İptal',
    savedOpeningEditor: 'Kaydedildi — düzenleyici açılıyor…',
    statusReady: 'Kayda hazır',
    statusRecording: 'Kaydediliyor',
    statusPaused: 'Kayıt duraklatıldı',
    statusSaving: 'Kayıt kaydediliyor',
    statusSaved: 'Kayıt kaydedildi'
  },
  timeline: {
    addZoom: '+ Yakınlaştırma',
    addText: '+ Metin',
    addScene: '+ Sahne',
    detectSilences: 'Sessizlikleri algıla',
    detecting: 'Algılanıyor…',
    splitAt: 'Şuradan böl'
  },
  exportModal: {
    title: 'Dışa aktar',
    cancel: 'İptal',
    exporting: 'Dışa aktarılıyor…',
    copyFile: 'Dosyayı kopyala',
    copied: 'Kopyalandı ✓',
    drag: 'Sürükle',
    showInFinder: "Finder'da göster"
  },
  homeScreen: {
    title: 'Son kayıtlar',
    searchPlaceholder: 'Ada veya tarihe göre ara…',
    sortNewest: 'En yeni',
    sortOldest: 'En eski',
    sortLongest: 'En uzun',
    sortLargest: 'En büyük',
    gridView: 'Izgara görünümü',
    listView: 'Liste görünümü',
    showRecordingControls: 'Kayıt kontrollerini göster',
    hideRecordingControls: 'Kayıt kontrollerini gizle',
    recordingCountOne: '1 kayıt',
    recordingCountOther: '{count} kayıt',
    recordingCountOf: '{total} kayıttan {shown}',
    emptyTitle: 'Henüz kayıt yok',
    emptyBody: 'İlk ekran kaydınızı başlatmak için kontrol penceresini kullanın.',
    untitledRecording: 'Adsız kayıt',
    showInFinder: "Finder'da göster",
    deleteRecording: 'Kaydı sil',
    renameHint: 'Yeniden adlandırmak için çift tıklayın',
    loadMore: 'Daha fazla yükle',
    loading: 'Yükleniyor…',
    recoveryFound: 'Önceki oturumdan kaydedilmemiş çalışma bulundu',
    recoveryRecover: 'Kurtar',
    recoveryDiscard: 'At'
  },
  settings: {
    title: 'Ayarlar',
    language: 'Dil',
    languageHint: 'Uygulamanın tamamında hemen uygulanır.',
    theme: 'Görünüm',
    themeDark: 'Koyu',
    themeLight: 'Açık',
    themeSystem: 'Sistem',
    analyticsToggle: 'Anonim kullanım verilerini paylaş',
    analyticsHint: 'Hangi özellikleri kullandığınız ve dışa aktarma yapılandırması — asla video içeriği, not metni veya gerçek dosya yolları değil.',
    publishDestinations: 'Yayınlama hedefleri',
    connect: 'Bağlan',
    disconnect: 'Bağlantıyı kes',
    shortcutTitle: 'Genel başlat/durdur kısayolu',
    shortcutHint: 'Screen Studio odakta olmasa bile çalışır.',
    shortcutSet: 'Ayarla',
    shortcutChange: 'Değiştir',
    shortcutClear: 'Temizle',
    shortcutNotSet: 'Ayarlanmadı',
    shortcutRecording: 'Herhangi bir tuş kombinasyonuna basın… (İptal için Esc)'
  }
}
