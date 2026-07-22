"use client";

import { usePathname } from "next/navigation";

type HeaderContent = {
  eyebrow: string;
  title: string;
  description: string;
};

function getHeaderContent(pathname: string): HeaderContent {
  if (pathname === "/dashboard/planner") {
    return {
      eyebrow: "Saisonplanner",
      title: "Saisonagenda",
      description:
        "Führende Saisonplanung mit Trainings, Matches, Turnieren, weiteren Events und Ferienperioden über die ganze Saison.",
    };
  }

  if (pathname === "/dashboard/planner/week") {
    return {
      eyebrow: "Wochenplanner",
      title: "Wochenagenda",
      description:
        "Operative Wochenplanung pro Kalenderwoche. Diese Sicht ist für Website und später Mobile App vorgesehen.",
    };
  }

  if (pathname === "/dashboard/planner/day") {
    return {
      eyebrow: "Tagesplanner",
      title: "Tagesagenda",
      description:
        "Operative Tagesplanung für den Live-Betrieb und die direkte Ausspielung auf das Infoboard.",
    };
  }

  if (pathname === "/vereinsleitung/meetings") {
    return {
      eyebrow: "Meetings",
      title: "Meetings",
      description: "Übersicht aller Sitzungen – absteigend vom neuesten zum ältesten Eintrag.",
    };
  }

  if (pathname === "/vereinsleitung/meetings/vorstandssitzung-april") {
    return {
      eyebrow: "Meetings",
      title: "Vorstandssitzung April",
      description: "Protokoll & Beschlüsse",
    };
  }

  if (pathname.startsWith("/vereinsleitung/meetings/")) {
    return {
      eyebrow: "Meetings",
      title: "Meeting Details",
      description: "Protokoll, Teilnehmer, Beschlüsse und Massnahmen.",
    };
  }

  if (pathname === "/vereinsleitung/initiativen") {
    return {
      eyebrow: "Initiativen",
      title: "Initiativen",
      description: "Übersicht aller Initiativen – absteigend vom neuesten zum ältesten Eintrag.",
    };
  }

  if (pathname === "/vereinsleitung/initiativen/new") {
    return {
      eyebrow: "Initiativen",
      title: "Neue Initiative",
      description: "Initiative mit Sichtbarkeitseinstellungen erfassen.",
    };
  }

  if (pathname.endsWith("/edit") && pathname.startsWith("/vereinsleitung/initiativen/")) {
    return {
      eyebrow: "Initiativen",
      title: "Initiative bearbeiten",
      description: "Initiative und Sichtbarkeit anpassen.",
    };
  }

  if (pathname === "/vereinsleitung/meetings/new") {
    return {
      eyebrow: "Meetings",
      title: "Neues Meeting",
      description: "Meeting mit Datum, Ort und Sichtbarkeitseinstellungen erfassen.",
    };
  }

  if (pathname.endsWith("/edit") && pathname.startsWith("/vereinsleitung/meetings/")) {
    return {
      eyebrow: "Meetings",
      title: "Meeting bearbeiten",
      description: "Meeting und Sichtbarkeit anpassen.",
    };
  }

  if (pathname === "/vereinsleitung/initiativen/website-relaunch") {
    return {
      eyebrow: "Initiativen",
      title: "Website Relaunch",
      description: "Initiativen Details",
    };
  }

  if (pathname.startsWith("/vereinsleitung/initiativen/")) {
    return {
      eyebrow: "Initiativen",
      title: "Initiative Details",
      description: "Fortschritt, Aufgaben, Meetings und Entscheidungen.",
    };
  }

  if (pathname === "/vereinsleitung/kpis") {
    return {
      eyebrow: "KPIs",
      title: "KPIs",
      description: "Kennzahlen und Trends für die strategische Steuerung des Vereins.",
    };
  }

  if (pathname === "/vereinsleitung/targets") {
    return {
      eyebrow: "Ziele",
      title: "Vereinsziele",
      description: "Strategische Ziele und messbare Fortschrittskennzahlen für den Verein.",
    };
  }

  if (pathname === "/vereinsleitung/targets/new") {
    return {
      eyebrow: "Ziele",
      title: "Neues Ziel erstellen",
      description: "Strategisches Ziel mit messbaren Metriken und Vorlagen erfassen.",
    };
  }

  if (pathname.startsWith("/vereinsleitung/targets/")) {
    return {
      eyebrow: "Ziele",
      title: "Ziel Details",
      description: "Fortschritt, Metriken und Messwerte im Detail.",
    };
  }

  if (pathname === "/vereinsleitung/templates") {
    return { eyebrow: "Kommunikation", title: "Vorlagen", description: "Kontextbewusste Kommunikationsvorlagen mit Variablen." };
  }

  if (pathname === "/vereinsleitung/templates/new") {
    return { eyebrow: "Kommunikation", title: "Neue Vorlage", description: "Vorlage mit Variablen und Kategorien erstellen." };
  }

  if (pathname.startsWith("/vereinsleitung/templates/")) {
    return { eyebrow: "Kommunikation", title: "Vorlage", description: "Vorschau und Bearbeitung." };
  }

  if (pathname === "/vereinsleitung" || pathname.startsWith("/vereinsleitung/")) {
    return {
      eyebrow: "Vereinsleitung",
      title: "Vereinsleitung – Übersicht",
      description:
        "Strategische Steuerung des Vereins mit Zielen, Initiativen, Meetings, Aufgaben und Entscheidungen an einem Ort.",
    };
  }

  if (
    pathname === "/dashboard/matchcenter" ||
    pathname.startsWith("/dashboard/matchcenter/")
  ) {
    return {
      eyebrow: "Spielbetrieb",
      title: "Matchcenter",
      description:
        "Zentrale Übersicht aller synchronisierten und manuell erfassten Matches.",
    };
  }

  if (pathname === "/dashboard/seasons" || pathname.startsWith("/dashboard/seasons/")) {
    return {
      eyebrow: "Saisons",
      title: "Saisonplanung",
      description:
        "Neue zukünftige Saisons sind in Planung. Die aktuelle Saison ist laufend. Vergangene Saisons werden nach Saisonende automatisch abgeschlossen.",
    };
  }

  if (pathname === "/dashboard/events" || pathname.startsWith("/dashboard/events/")) {
    return {
      eyebrow: "Events",
      title: "Events pro Saison",
      description:
        "Events sind saisongeführt und umfassen Matches, Turniere, Trainings sowie weitere Vereinsereignisse pro gewählter Saison.",
    };
  }

  if (pathname === "/dashboard/teams" || pathname.startsWith("/dashboard/teams/")) {
    return {
      eyebrow: "Teams",
      title: "Teams pro Saison",
      description:
        "Teams sind saisongeführt und werden dynamisch pro Saison und Teamkategorie verwaltet.",
    };
  }

  if (pathname === "/dashboard/org-units" || pathname.startsWith("/dashboard/org-units/")) {
    return {
      eyebrow: "Organisation",
      title: "Organisationseinheiten",
      description: "Organigramm-Grundlage für Sichtbarkeit, Kommunikation und Workflow-Routing.",
    };
  }

  if (pathname === "/dashboard/target-groups" || pathname.startsWith("/dashboard/target-groups/")) {
    return {
      eyebrow: "Organisation",
      title: "Zielgruppen",
      description: "Benannte, wiederverwendbare Gruppen für Sichtbarkeit, Kommunikation und Workflow-Routing.",
    };
  }

  if (pathname === "/dashboard/admin/branding") {
    return {
      eyebrow: "Admin",
      title: "Darstellung",
      description: "Logo und Vereinsfarben konfigurieren — wirkt sofort auf alle Branding-Oberflächen.",
    };
  }

  if (pathname === "/dashboard/users" || pathname.startsWith("/dashboard/users/")) {
    return {
      eyebrow: "Benutzer & Rechte",
      title: "Benutzerverwaltung",
      description:
        "Benutzer, Rollen, Berechtigungen und Zugriffe sicher und zentral verwalten.",
    };
  }

  if (pathname === "/dashboard/persons" || pathname.startsWith("/dashboard/persons/")) {
    return {
      eyebrow: "Personen",
      title: "Personenverwaltung",
      description:
        "Personenstammdaten für Spieler, Trainer und weitere Vereinsrollen strukturiert pflegen.",
    };
  }

  if (pathname === "/dashboard/players" || pathname.startsWith("/dashboard/players/")) {
    return {
      eyebrow: "Spieler",
      title: "Spielerverwaltung",
      description:
        "Spielerdaten zentral verwalten und für spätere Prozesse und Teams nutzbar machen.",
    };
  }

  if (pathname === "/dashboard/trainers" || pathname.startsWith("/dashboard/trainers/")) {
    return {
      eyebrow: "Trainer",
      title: "Trainerverwaltung",
      description:
        "Trainerdaten strukturiert verwalten und für Organisation und Website bereitstellen.",
    };
  }

  return {
    eyebrow: "SportClubEvo",
    title: "Dashboard",
    description:
      "Saisongeführte Einstiegsseite. Saisons sind führend; Teams, Events und Planner werden dynamisch pro Saison aufgebaut.",
  };
}

export default function AdminPageHeader() {
  const pathname = usePathname();
  const headerContent = getHeaderContent(pathname);

  /*
   * Internal WebApp headers must use the Premium SaaS typography standard.
   * Do not use tenant branding, football typography, or legacy fca-heading styles here.
   */
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-[var(--muted)]">
        {headerContent.eyebrow}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--foreground)] leading-tight">
        {headerContent.title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--text-2)] leading-relaxed">
        {headerContent.description}
      </p>
    </div>
  );
}
