/**
 * Workspace German translations.
 *
 * All user-facing strings for the Workspace module. Using a typed static
 * object keeps strings decoupled from components without requiring a
 * third-party i18n library at this stage.
 *
 * Keys are structured so they can be migrated to a next-intl messages file
 * (e.g. messages/de.json) in the future.
 */

export const workspaceDE = {
  // ── Page ───────────────────────────────────────────────────────────────
  page: {
    eyebrow: "Club Workspace",
    title: "Workspace",
    description:
      "Sichere interne Dokumentenverwaltung für Ihre Organisation.",
  },

  // ── Folders panel ──────────────────────────────────────────────────────
  folders: {
    panelTitle: "Ordner",
    noFoldersTitle: "Noch keine Ordner",
    noFoldersDescription:
      "Ihr Verein kann eine eigene Ordnerstruktur erstellen.",
    selectFolder: "Ordner auswählen",
    selectFolderDescription:
      "Wählen Sie einen Ordner aus der Baumstruktur, um die Inhalte anzuzeigen.",
    welcomeTitle: "Willkommen im Workspace",
    welcomeDescription:
      "Erstellen Sie den ersten Ordner Ihres Vereins, um interne Dokumente zu verwalten.",
    noPermissionNote:
      "Ein Workspace-Manager muss den ersten Ordner erstellen.",
    createFirst: "Ersten Ordner erstellen",
    cannotArchive:
      "Ordner mit aktiven Unterordnern können nicht archiviert werden.",
  },

  // ── Folder tree breadcrumbs ─────────────────────────────────────────────
  breadcrumbs: {
    root: "Workspace",
  },

  // ── Document area ───────────────────────────────────────────────────────
  documents: {
    countSingular: "1 Dokument",
    countPlural: (n: number) => `${n} Dokumente`,
    createSubfolder: "Unterordner erstellen",
  },

  // ── Document table headers ──────────────────────────────────────────────
  table: {
    fileTypeLabel: "Dateityp",
    name: "Name",
    modified: "Geändert",
    size: "Grösse",
    version: "Version",
    actions: "Aktionen",
  },

  // ── Empty state ─────────────────────────────────────────────────────────
  emptyState: {
    title: "Dieser Ordner ist leer.",
    description:
      "Ziehen Sie Dateien hierher oder laden Sie Ihr erstes Dokument hoch.",
    action: "Datei hochladen",
  },

  // ── Upload ──────────────────────────────────────────────────────────────
  upload: {
    buttonLabel: "Datei hochladen",
    uploadingLabel: "Wird hochgeladen …",
    dropzoneTitle: "Datei hier ablegen oder klicken",
    dropzoneHint: "Eine Datei auf einmal, bis zu 100 MB.",
    dragOverTitle: "Datei hier ablegen",

    errors: {
      storageNotConfigured:
        "Upload ist momentan nicht verfügbar. Bitte wenden Sie sich an den Administrator.",
      folderNotFound:
        "Der ausgewählte Ordner existiert nicht mehr. Bitte laden Sie die Seite neu.",
      tooLarge: "Die Datei ist zu gross für den Speicher.",
      invalidFile: "Dieser Dateityp wird nicht akzeptiert.",
      conflict:
        "Diese Datei existiert bereits. Bitte benennen Sie die Datei um und versuchen Sie es erneut.",
      persistenceFailed:
        "Das Dokument konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.",
      generic: "Die Datei konnte nicht hochgeladen werden.",
    },
  },

  // ── Document actions ────────────────────────────────────────────────────
  actions: {
    menuLabel: (name: string) => `Aktionen für ${name}`,
    download: "Herunterladen",
    rename: "Umbenennen",
    move: "Verschieben",
    versionHistory: "Versionsverlauf",
    archive: "Archivieren",
    comingSoon: "Demnächst",
  },

  // ── Preview panel ───────────────────────────────────────────────────────
  preview: {
    panelTitle: "Vorschau",
    detailsTitle: "Details",
    noSelectionMessage: "Kein Element ausgewählt.",
    loadingPreview: "Vorschau wird geladen …",
    previewNotAvailable: "Keine Vorschau verfügbar",
    previewNotAvailableHint:
      "Dieser Dateityp kann nicht direkt angezeigt werden.",
    downloadButton: "Herunterladen",
    openButton: "Öffnen",

    labels: {
      filename: "Dateiname",
      fileType: "Dateityp",
      fileSize: "Grösse",
      uploaded: "Hochgeladen",
      modified: "Geändert",
      version: "Version",
      folder: "Ordner",
      description: "Beschreibung",
      noDescription: "Keine Beschreibung vorhanden.",
      name: "Name",
      created: "Erstellt",
      updated: "Aktualisiert",
    },

    futureActions: {
      versionHistory: "Versionsverlauf",
      versionHistoryHint: "Diese Funktion ist in Vorbereitung.",
    },
  },

  // ── Folder details ──────────────────────────────────────────────────────
  folderDetails: {
    panelTitle: "Details",
    nameLabelTitle: "Name",
    locationLabel: "Speicherort",
    descriptionLabel: "Beschreibung",
    createdLabel: "Erstellt",
    updatedLabel: "Aktualisiert",
    noDescription: "Keine Beschreibung vorhanden.",
    noItemSelected: "Kein Element ausgewählt.",
    archiveButton: "Ordner archivieren",
    archiveNote:
      "Ordner mit aktiven Unterordnern können nicht archiviert werden.",
  },

  // ── Archived folders ────────────────────────────────────────────────────
  archivedFolders: {
    sectionTitle: "Archivierte Ordner",
    sectionDescription:
      "Stellen Sie archivierte Ordner wieder her, um sie in die aktive Struktur zurückzuführen.",
    archivedAt: (date: string) => `Archiviert ${date}`,
    restoreButton: "Wiederherstellen",
  },

  // ── File type labels (passthrough — use file-type-util for mapping) ─────
  fileTypes: {
    unknown: "Datei",
  },
} as const;

export type WorkspaceDE = typeof workspaceDE;
