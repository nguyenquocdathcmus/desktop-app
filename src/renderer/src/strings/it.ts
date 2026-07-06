import type { Strings } from './en'

export const it: Strings = {
  controlBar: {
    undo: 'Annulla',
    redo: 'Ripeti',
    play: 'Riproduci',
    pause: 'Pausa',
    seek: 'Cerca'
  },
  recording: {
    startRecording: 'Avvia registrazione',
    stop: 'Interrompi',
    resume: 'Riprendi',
    pauseAction: 'Pausa',
    cancel: 'Annulla',
    savedOpeningEditor: "Salvato — apertura dell'editor…",
    statusReady: 'Pronto per registrare',
    statusRecording: 'Registrazione in corso',
    statusPaused: 'Registrazione in pausa',
    statusSaving: 'Salvataggio registrazione',
    statusSaved: 'Registrazione salvata'
  },
  timeline: {
    addZoom: '+ Zoom',
    addText: '+ Testo',
    addScene: '+ Scena',
    detectSilences: 'Rileva silenzi',
    detecting: 'Rilevamento…',
    splitAt: 'Dividi a'
  },
  exportModal: {
    title: 'Esporta',
    cancel: 'Annulla',
    exporting: 'Esportazione…',
    copyFile: 'Copia file',
    copied: 'Copiato ✓',
    drag: 'Trascina',
    showInFinder: 'Mostra nel Finder'
  },
  homeScreen: {
    title: 'Registrazioni recenti',
    searchPlaceholder: 'Cerca per nome o data…',
    sortNewest: 'Più recente',
    sortOldest: 'Meno recente',
    sortLongest: 'Più lunga',
    sortLargest: 'Più grande',
    gridView: 'Vista griglia',
    listView: 'Vista elenco',
    showRecordingControls: 'Mostra controlli di registrazione',
    hideRecordingControls: 'Nascondi controlli di registrazione',
    recordingCountOne: '1 registrazione',
    recordingCountOther: '{count} registrazioni',
    recordingCountOf: '{shown} di {total}',
    emptyTitle: 'Ancora nessuna registrazione',
    emptyBody: 'Usa la finestra di controllo per avviare la tua prima registrazione dello schermo.',
    untitledRecording: 'Registrazione senza titolo',
    showInFinder: 'Mostra nel Finder',
    deleteRecording: 'Elimina registrazione',
    renameHint: 'Doppio clic per rinominare',
    loadMore: 'Carica altro',
    loading: 'Caricamento…',
    recoveryFound: 'Trovato lavoro non salvato da una sessione precedente',
    recoveryRecover: 'Ripristina',
    recoveryDiscard: 'Scarta'
  },
  settings: {
    title: 'Impostazioni',
    language: 'Lingua',
    languageHint: "Si applica immediatamente in tutta l'app.",
    theme: 'Aspetto',
    themeDark: 'Scuro',
    themeLight: 'Chiaro',
    themeSystem: 'Sistema',
    analyticsToggle: 'Condividi dati di utilizzo anonimi',
    analyticsHint: "Quali funzioni usi e la configurazione di esportazione — mai il contenuto video, il testo delle annotazioni o i percorsi dei file reali.",
    publishDestinations: 'Destinazioni di pubblicazione',
    connect: 'Connetti',
    disconnect: 'Disconnetti',
    shortcutTitle: 'Scorciatoia globale avvia/interrompi',
    shortcutHint: 'Funziona anche quando Screen Studio non è in primo piano.',
    shortcutSet: 'Imposta',
    shortcutChange: 'Cambia',
    shortcutClear: 'Cancella',
    shortcutNotSet: 'Non impostato',
    shortcutRecording: 'Premi una combinazione di tasti… (Esc per annullare)'
  }
}
