import type { Strings } from './en'

export const fr: Strings = {
  controlBar: {
    undo: 'Annuler',
    redo: 'Rétablir',
    play: 'Lecture',
    pause: 'Pause',
    seek: 'Rechercher'
  },
  recording: {
    startRecording: "Démarrer l'enregistrement",
    stop: 'Arrêter',
    resume: 'Reprendre',
    pauseAction: 'Pause',
    cancel: 'Annuler',
    savedOpeningEditor: "Enregistré — ouverture de l'éditeur…",
    statusReady: 'Prêt à enregistrer',
    statusRecording: 'Enregistrement',
    statusPaused: 'Enregistrement en pause',
    statusSaving: "Enregistrement de la capture",
    statusSaved: 'Capture enregistrée'
  },
  timeline: {
    addZoom: '+ Zoom',
    addText: '+ Texte',
    addScene: '+ Scène',
    detectSilences: 'Détecter les silences',
    detecting: 'Détection…',
    splitAt: 'Diviser à'
  },
  exportModal: {
    title: 'Exporter',
    cancel: 'Annuler',
    exporting: 'Exportation…',
    copyFile: 'Copier le fichier',
    copied: 'Copié ✓',
    drag: 'Glisser',
    showInFinder: 'Afficher dans le Finder'
  },
  homeScreen: {
    title: 'Enregistrements récents',
    searchPlaceholder: 'Rechercher par nom ou date…',
    sortNewest: 'Plus récent',
    sortOldest: 'Plus ancien',
    sortLongest: 'Plus long',
    sortLargest: 'Plus volumineux',
    gridView: 'Vue en grille',
    listView: 'Vue en liste',
    showRecordingControls: "Afficher les contrôles d'enregistrement",
    hideRecordingControls: "Masquer les contrôles d'enregistrement",
    recordingCountOne: '1 enregistrement',
    recordingCountOther: '{count} enregistrements',
    recordingCountOf: '{shown} sur {total}',
    emptyTitle: "Aucun enregistrement pour l'instant",
    emptyBody: "Utilisez la fenêtre de contrôle pour démarrer votre premier enregistrement d'écran.",
    untitledRecording: 'Enregistrement sans titre',
    showInFinder: 'Afficher dans le Finder',
    deleteRecording: "Supprimer l'enregistrement",
    renameHint: 'Double-cliquez pour renommer',
    loadMore: 'Charger plus',
    loading: 'Chargement…',
    recoveryFound: "Travail non enregistré trouvé d'une session précédente",
    recoveryRecover: 'Récupérer',
    recoveryDiscard: 'Ignorer'
  },
  settings: {
    title: 'Réglages',
    language: 'Langue',
    languageHint: "S'applique immédiatement dans toute l'application.",
    theme: 'Apparence',
    themeDark: 'Sombre',
    themeLight: 'Clair',
    themeSystem: 'Système',
    analyticsToggle: "Partager des données d'utilisation anonymes",
    analyticsHint: "Les fonctionnalités utilisées et la configuration d'export — jamais le contenu vidéo, le texte des annotations, ni les chemins de fichiers réels.",
    publishDestinations: 'Destinations de publication',
    connect: 'Connecter',
    disconnect: 'Déconnecter',
    shortcutTitle: 'Raccourci global démarrer/arrêter',
    shortcutHint: "Fonctionne même si Screen Studio n'a pas le focus.",
    shortcutSet: 'Définir',
    shortcutChange: 'Changer',
    shortcutClear: 'Effacer',
    shortcutNotSet: 'Non défini',
    shortcutRecording: 'Appuyez sur une combinaison de touches… (Échap pour annuler)'
  }
}
