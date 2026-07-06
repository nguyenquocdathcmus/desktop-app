import type { Strings } from './en'

/** Sprint 27 US-208 — Arabic is the one RTL locale among the 13; the string
 *  values here are plain (no directional markup needed), RTL layout is
 *  handled separately at the document root (dir="rtl") in App.tsx driven by
 *  shared/locales.ts RTL_LOCALES. */
export const ar: Strings = {
  controlBar: {
    undo: 'تراجع',
    redo: 'إعادة',
    play: 'تشغيل',
    pause: 'إيقاف مؤقت',
    seek: 'الانتقال'
  },
  recording: {
    startRecording: 'بدء التسجيل',
    stop: 'إيقاف',
    resume: 'استئناف',
    pauseAction: 'إيقاف مؤقت',
    cancel: 'إلغاء',
    savedOpeningEditor: 'تم الحفظ — جارٍ فتح المحرر…',
    statusReady: 'جاهز للتسجيل',
    statusRecording: 'جارٍ التسجيل',
    statusPaused: 'تم إيقاف التسجيل مؤقتًا',
    statusSaving: 'جارٍ حفظ التسجيل',
    statusSaved: 'تم حفظ التسجيل'
  },
  timeline: {
    addZoom: '+ تكبير',
    addText: '+ نص',
    addScene: '+ مشهد',
    detectSilences: 'اكتشاف فترات الصمت',
    detecting: 'جارٍ الاكتشاف…',
    splitAt: 'تقسيم عند'
  },
  exportModal: {
    title: 'تصدير',
    cancel: 'إلغاء',
    exporting: 'جارٍ التصدير…',
    copyFile: 'نسخ الملف',
    copied: 'تم النسخ ✓',
    drag: 'سحب',
    showInFinder: 'إظهار في Finder'
  },
  homeScreen: {
    title: 'التسجيلات الأخيرة',
    searchPlaceholder: 'البحث بالاسم أو التاريخ…',
    sortNewest: 'الأحدث',
    sortOldest: 'الأقدم',
    sortLongest: 'الأطول',
    sortLargest: 'الأكبر',
    gridView: 'عرض الشبكة',
    listView: 'عرض القائمة',
    showRecordingControls: 'إظهار عناصر تحكم التسجيل',
    hideRecordingControls: 'إخفاء عناصر تحكم التسجيل',
    recordingCountOne: 'تسجيل واحد',
    recordingCountOther: '{count} تسجيلات',
    recordingCountOf: '{shown} من {total}',
    emptyTitle: 'لا توجد تسجيلات بعد',
    emptyBody: 'استخدم نافذة التحكم لبدء أول تسجيل للشاشة.',
    untitledRecording: 'تسجيل بدون عنوان',
    showInFinder: 'إظهار في Finder',
    deleteRecording: 'حذف التسجيل',
    renameHint: 'انقر نقرًا مزدوجًا لإعادة التسمية',
    loadMore: 'تحميل المزيد',
    loading: 'جارٍ التحميل…',
    recoveryFound: 'تم العثور على عمل غير محفوظ من جلسة سابقة',
    recoveryRecover: 'استعادة',
    recoveryDiscard: 'تجاهل'
  },
  settings: {
    title: 'الإعدادات',
    language: 'اللغة',
    languageHint: 'يُطبّق فورًا على التطبيق بأكمله.',
    theme: 'المظهر',
    themeDark: 'داكن',
    themeLight: 'فاتح',
    themeSystem: 'النظام',
    analyticsToggle: 'مشاركة بيانات الاستخدام المجهولة',
    analyticsHint: 'الميزات التي تستخدمها وإعدادات التصدير فقط — لا يشمل أبدًا محتوى الفيديو أو نص التعليقات أو مسارات الملفات الحقيقية.',
    publishDestinations: 'وجهات النشر',
    connect: 'ربط',
    disconnect: 'قطع الاتصال',
    shortcutTitle: 'اختصار عام للبدء/الإيقاف',
    shortcutHint: 'يعمل حتى عندما لا يكون Screen Studio هو التطبيق النشط.',
    shortcutSet: 'تعيين',
    shortcutChange: 'تغيير',
    shortcutClear: 'مسح',
    shortcutNotSet: 'غير معيّن',
    shortcutRecording: 'اضغط أي مجموعة مفاتيح… (Esc للإلغاء)'
  }
}
