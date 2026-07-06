import type { Strings } from './en'

export const es: Strings = {
  controlBar: {
    undo: 'Deshacer',
    redo: 'Rehacer',
    play: 'Reproducir',
    pause: 'Pausar',
    seek: 'Buscar'
  },
  recording: {
    startRecording: 'Iniciar grabación',
    stop: 'Detener',
    resume: 'Reanudar',
    pauseAction: 'Pausar',
    cancel: 'Cancelar',
    savedOpeningEditor: 'Guardado — abriendo el editor…',
    statusReady: 'Listo para grabar',
    statusRecording: 'Grabando',
    statusPaused: 'Grabación en pausa',
    statusSaving: 'Guardando grabación',
    statusSaved: 'Grabación guardada'
  },
  timeline: {
    addZoom: '+ Zoom',
    addText: '+ Texto',
    addScene: '+ Escena',
    detectSilences: 'Detectar silencios',
    detecting: 'Detectando…',
    splitAt: 'Dividir en'
  },
  exportModal: {
    title: 'Exportar',
    cancel: 'Cancelar',
    exporting: 'Exportando…',
    copyFile: 'Copiar archivo',
    copied: 'Copiado ✓',
    drag: 'Arrastrar',
    showInFinder: 'Mostrar en Finder'
  },
  homeScreen: {
    title: 'Grabaciones recientes',
    searchPlaceholder: 'Buscar por nombre o fecha…',
    sortNewest: 'Más reciente',
    sortOldest: 'Más antigua',
    sortLongest: 'Más larga',
    sortLargest: 'Más grande',
    gridView: 'Vista de cuadrícula',
    listView: 'Vista de lista',
    showRecordingControls: 'Mostrar controles de grabación',
    hideRecordingControls: 'Ocultar controles de grabación',
    recordingCountOne: '1 grabación',
    recordingCountOther: '{count} grabaciones',
    recordingCountOf: '{shown} de {total}',
    emptyTitle: 'Aún no hay grabaciones',
    emptyBody: 'Usa la ventana de controles para iniciar tu primera grabación de pantalla.',
    untitledRecording: 'Grabación sin título',
    showInFinder: 'Mostrar en Finder',
    deleteRecording: 'Eliminar grabación',
    renameHint: 'Doble clic para renombrar',
    loadMore: 'Cargar más',
    loading: 'Cargando…',
    recoveryFound: 'Se encontró trabajo sin guardar de una sesión anterior',
    recoveryRecover: 'Recuperar',
    recoveryDiscard: 'Descartar'
  },
  settings: {
    title: 'Ajustes',
    language: 'Idioma',
    languageHint: 'Se aplica de inmediato en toda la aplicación.',
    theme: 'Apariencia',
    themeDark: 'Oscuro',
    themeLight: 'Claro',
    themeSystem: 'Sistema',
    analyticsToggle: 'Compartir datos de uso anónimos',
    analyticsHint: 'Qué funciones usas y la configuración de exportación — nunca el contenido del video, texto de anotaciones ni rutas de archivo reales.',
    publishDestinations: 'Destinos de publicación',
    connect: 'Conectar',
    disconnect: 'Desconectar',
    shortcutTitle: 'Atajo global de inicio/parada',
    shortcutHint: 'Funciona incluso cuando Screen Studio no está enfocado.',
    shortcutSet: 'Establecer',
    shortcutChange: 'Cambiar',
    shortcutClear: 'Borrar',
    shortcutNotSet: 'No establecido',
    shortcutRecording: 'Presiona cualquier combinación de teclas… (Esc para cancelar)'
  }
}
