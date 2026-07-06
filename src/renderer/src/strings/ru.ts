import type { Strings } from './en'

export const ru: Strings = {
  controlBar: {
    undo: 'Отменить',
    redo: 'Повторить',
    play: 'Воспроизвести',
    pause: 'Пауза',
    seek: 'Перемотка'
  },
  recording: {
    startRecording: 'Начать запись',
    stop: 'Остановить',
    resume: 'Продолжить',
    pauseAction: 'Пауза',
    cancel: 'Отмена',
    savedOpeningEditor: 'Сохранено — открывается редактор…',
    statusReady: 'Готово к записи',
    statusRecording: 'Идёт запись',
    statusPaused: 'Запись приостановлена',
    statusSaving: 'Сохранение записи',
    statusSaved: 'Запись сохранена'
  },
  timeline: {
    addZoom: '+ Масштаб',
    addText: '+ Текст',
    addScene: '+ Сцена',
    detectSilences: 'Обнаружить тишину',
    detecting: 'Обнаружение…',
    splitAt: 'Разделить здесь'
  },
  exportModal: {
    title: 'Экспорт',
    cancel: 'Отмена',
    exporting: 'Экспорт…',
    copyFile: 'Скопировать файл',
    copied: 'Скопировано ✓',
    drag: 'Перетащить',
    showInFinder: 'Показать в Finder'
  },
  homeScreen: {
    title: 'Недавние записи',
    searchPlaceholder: 'Поиск по имени или дате…',
    sortNewest: 'Сначала новые',
    sortOldest: 'Сначала старые',
    sortLongest: 'Самые длинные',
    sortLargest: 'Самые большие',
    gridView: 'Вид сеткой',
    listView: 'Вид списком',
    showRecordingControls: 'Показать элементы управления записью',
    hideRecordingControls: 'Скрыть элементы управления записью',
    recordingCountOne: '1 запись',
    recordingCountOther: '{count} записей',
    recordingCountOf: '{shown} из {total}',
    emptyTitle: 'Записей пока нет',
    emptyBody: 'Используйте окно управления, чтобы начать первую запись экрана.',
    untitledRecording: 'Запись без названия',
    showInFinder: 'Показать в Finder',
    deleteRecording: 'Удалить запись',
    renameHint: 'Дважды щёлкните, чтобы переименовать',
    loadMore: 'Загрузить ещё',
    loading: 'Загрузка…',
    recoveryFound: 'Найдена несохранённая работа из предыдущего сеанса',
    recoveryRecover: 'Восстановить',
    recoveryDiscard: 'Отклонить'
  },
  settings: {
    title: 'Настройки',
    language: 'Язык',
    languageHint: 'Применяется сразу во всём приложении.',
    theme: 'Оформление',
    themeDark: 'Тёмная',
    themeLight: 'Светлая',
    themeSystem: 'Системная',
    analyticsToggle: 'Делиться анонимными данными об использовании',
    analyticsHint: 'Какие функции вы используете и настройки экспорта — никогда содержимое видео, текст аннотаций или реальные пути к файлам.',
    publishDestinations: 'Места публикации',
    connect: 'Подключить',
    disconnect: 'Отключить',
    shortcutTitle: 'Глобальная горячая клавиша старт/стоп',
    shortcutHint: 'Работает, даже если Screen Studio не в фокусе.',
    shortcutSet: 'Задать',
    shortcutChange: 'Изменить',
    shortcutClear: 'Очистить',
    shortcutNotSet: 'Не задано',
    shortcutRecording: 'Нажмите любую комбинацию клавиш… (Esc для отмены)'
  }
}
