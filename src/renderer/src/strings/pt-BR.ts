import type { Strings } from './en'

export const ptBR: Strings = {
  controlBar: {
    undo: 'Desfazer',
    redo: 'Refazer',
    play: 'Reproduzir',
    pause: 'Pausar',
    seek: 'Buscar'
  },
  recording: {
    startRecording: 'Iniciar gravação',
    stop: 'Parar',
    resume: 'Retomar',
    pauseAction: 'Pausar',
    cancel: 'Cancelar',
    savedOpeningEditor: 'Salvo — abrindo o editor…',
    statusReady: 'Pronto para gravar',
    statusRecording: 'Gravando',
    statusPaused: 'Gravação pausada',
    statusSaving: 'Salvando gravação',
    statusSaved: 'Gravação salva'
  },
  timeline: {
    addZoom: '+ Zoom',
    addText: '+ Texto',
    addScene: '+ Cena',
    detectSilences: 'Detectar silêncios',
    detecting: 'Detectando…',
    splitAt: 'Dividir em'
  },
  exportModal: {
    title: 'Exportar',
    cancel: 'Cancelar',
    exporting: 'Exportando…',
    copyFile: 'Copiar arquivo',
    copied: 'Copiado ✓',
    drag: 'Arrastar',
    showInFinder: 'Mostrar no Finder'
  },
  homeScreen: {
    title: 'Gravações recentes',
    searchPlaceholder: 'Pesquisar por nome ou data…',
    sortNewest: 'Mais recente',
    sortOldest: 'Mais antiga',
    sortLongest: 'Mais longa',
    sortLargest: 'Maior',
    gridView: 'Visualização em grade',
    listView: 'Visualização em lista',
    showRecordingControls: 'Mostrar controles de gravação',
    hideRecordingControls: 'Ocultar controles de gravação',
    recordingCountOne: '1 gravação',
    recordingCountOther: '{count} gravações',
    recordingCountOf: '{shown} de {total}',
    emptyTitle: 'Ainda não há gravações',
    emptyBody: 'Use a janela de controles para iniciar sua primeira gravação de tela.',
    untitledRecording: 'Gravação sem título',
    showInFinder: 'Mostrar no Finder',
    deleteRecording: 'Excluir gravação',
    renameHint: 'Clique duas vezes para renomear',
    loadMore: 'Carregar mais',
    loading: 'Carregando…',
    recoveryFound: 'Trabalho não salvo encontrado de uma sessão anterior',
    recoveryRecover: 'Recuperar',
    recoveryDiscard: 'Descartar'
  },
  settings: {
    title: 'Configurações',
    language: 'Idioma',
    languageHint: 'Aplica-se imediatamente em todo o aplicativo.',
    theme: 'Aparência',
    themeDark: 'Escuro',
    themeLight: 'Claro',
    themeSystem: 'Sistema',
    analyticsToggle: 'Compartilhar dados de uso anônimos',
    analyticsHint: 'Quais recursos você usa e a configuração de exportação — nunca o conteúdo do vídeo, texto de anotações ou caminhos de arquivo reais.',
    publishDestinations: 'Destinos de publicação',
    connect: 'Conectar',
    disconnect: 'Desconectar',
    shortcutTitle: 'Atalho global de iniciar/parar',
    shortcutHint: 'Funciona mesmo quando o Screen Studio não está em foco.',
    shortcutSet: 'Definir',
    shortcutChange: 'Alterar',
    shortcutClear: 'Limpar',
    shortcutNotSet: 'Não definido',
    shortcutRecording: 'Pressione qualquer combinação de teclas… (Esc para cancelar)'
  }
}
