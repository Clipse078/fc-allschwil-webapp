import type { Messages } from "./types";

/**
 * Default locale: German (Switzerland)
 * This catalog captures all hardcoded platform strings as of Sprint 1.
 * Future locales (en-GB, nl-NL) must mirror this structure.
 */
const messages: Messages = {
  platform: {
    name: "SportClubEvo",
    tagline: "Club Management Platform",
    metaTitle: "SportClubEvo · Club Management",
    metaDescription: "SportClubEvo – die modulare Club-Management-Plattform für moderne Sportvereine.",
  },

  nav: {
    dashboard: "Dashboard",
    vereinsleitung: "Vereinsleitung",
    meetings: "Meetings",
    initiativen: "Initiativen",
    kpis: "KPIs",
    saisons: "Saisons",
    saisonplanner: "Saisonplanner",
    wochenplanner: "Wochenplanner",
    tagesplanner: "Tagesplanner",
    teams: "Teams",
    events: "Events",
    personen: "Personen",
    spieler: "Spieler",
    trainer: "Trainer",
    benutzer: "Benutzer",
    abmelden: "Abmelden",
    abmelden_short: "Logout",
    menuEinklappen: "Menü einklappen",
    menuErweitern: "Menü erweitern",
  },

  pageHeaders: {
    dashboard: {
      eyebrow: "FC Allschwil",
      title: "Dashboard",
      description:
        "Saisongeführte Einstiegsseite. Saisons sind führend; Teams, Events und Planner werden dynamisch pro Saison aufgebaut.",
    },
    planner: {
      eyebrow: "Saisonplanner",
      title: "Saisonagenda",
      description:
        "Führende Saisonplanung mit Trainings, Matches, Turnieren, weiteren Events und Ferienperioden über die ganze Saison.",
    },
    plannerWeek: {
      eyebrow: "Wochenplanner",
      title: "Wochenagenda",
      description:
        "Operative Wochenplanung pro Kalenderwoche. Diese Sicht ist für Website und später Mobile App vorgesehen.",
    },
    plannerDay: {
      eyebrow: "Tagesplanner",
      title: "Tagesagenda",
      description:
        "Operative Tagesplanung für den Live-Betrieb und die direkte Ausspielung auf das Infoboard.",
    },
    meetings: {
      eyebrow: "Meetings",
      title: "Meetings",
      description: "Übersicht aller Sitzungen – absteigend vom neuesten zum ältesten Eintrag.",
    },
    meetingDetail: {
      eyebrow: "Meetings",
      title: "Meeting Details",
      description: "Protokoll, Teilnehmer, Beschlüsse und Massnahmen.",
    },
    initiativen: {
      eyebrow: "Initiativen",
      title: "Initiativen",
      description: "Übersicht aller Initiativen – absteigend vom neuesten zum ältesten Eintrag.",
    },
    initiativeDetail: {
      eyebrow: "Initiativen",
      title: "Initiative Details",
      description: "Fortschritt, Aufgaben, Meetings und Entscheidungen.",
    },
    kpis: {
      eyebrow: "KPIs",
      title: "KPIs",
      description: "Kennzahlen und Trends für die strategische Steuerung des Vereins.",
    },
    vereinsleitung: {
      eyebrow: "Vereinsleitung",
      title: "Vereinsleitung – Übersicht",
      description:
        "Strategische Steuerung des Vereins mit Zielen, Initiativen, Meetings, Aufgaben und Entscheidungen an einem Ort.",
    },
    saisons: {
      eyebrow: "Saisons",
      title: "Saisonplanung",
      description:
        "Neue zukünftige Saisons sind in Planung. Die aktuelle Saison ist laufend. Vergangene Saisons werden nach Saisonende automatisch abgeschlossen.",
    },
    events: {
      eyebrow: "Events",
      title: "Events pro Saison",
      description:
        "Events sind saisongeführt und umfassen Matches, Turniere, Trainings sowie weitere Vereinsereignisse pro gewählter Saison.",
    },
    teams: {
      eyebrow: "Teams",
      title: "Teams pro Saison",
      description:
        "Teams sind saisongeführt und werden dynamisch pro Saison und Teamkategorie verwaltet.",
    },
    users: {
      eyebrow: "Benutzer & Rechte",
      title: "Benutzerverwaltung",
      description:
        "Benutzer, Rollen, Berechtigungen und Zugriffe sicher und zentral verwalten.",
    },
    personen: {
      eyebrow: "Personen",
      title: "Personenverwaltung",
      description:
        "Personenstammdaten für Spieler, Trainer und weitere Vereinsrollen strukturiert pflegen.",
    },
    spieler: {
      eyebrow: "Spieler",
      title: "Spielerverwaltung",
      description:
        "Spielerdaten zentral verwalten und für spätere Prozesse und Teams nutzbar machen.",
    },
    trainer: {
      eyebrow: "Trainer",
      title: "Trainerverwaltung",
      description:
        "Trainerdaten strukturiert verwalten und für Organisation und Website bereitstellen.",
    },
  },

  auth: {
    login: "Anmelden",
    loginTitle: "Anmelden",
    loginDescription: "Melde dich mit deinen Zugangsdaten an.",
    signOut: "Abmelden",
    impersonationActive: "Impersonation aktiv",
    impersonationDescription: "Du bist aktuell als anderer Benutzer eingeloggt.",
    stopImpersonation: "Zurück zum Admin",
    stopImpersonationLoading: "Beende...",
    unknownAdmin: "Unbekannt",
  },

  actions: {
    save: "Speichern",
    cancel: "Abbrechen",
    delete: "Löschen",
    edit: "Bearbeiten",
    create: "Erstellen",
    back: "Zurück",
    confirm: "Bestätigen",
    loading: "Lädt...",
  },

  status: {
    active: "Aktiv",
    inactive: "Inaktiv",
    draft: "Entwurf",
    published: "Publiziert",
    archived: "Archiviert",
    pending: "Ausstehend",
    running: "Laufend",
    planned: "In Planung",
    completed: "Abgeschlossen",
    cancelled: "Abgesagt",
  },

  emptyStates: {
    noData: "Keine Daten vorhanden",
    noDataDescription: "Es sind noch keine Einträge erfasst.",
    noResults: "Keine Ergebnisse",
    noResultsDescription: "Die Suche ergab keine Treffer.",
  },

  tenant: {
    activeTenant: "Aktiver Verein",
    platform: "SportClubEvo",
  },
};

export default messages;
