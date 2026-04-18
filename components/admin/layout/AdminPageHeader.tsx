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

  if (pathname === "/vereinsleitung" || pathname.startsWith("/vereinsleitung/")) {
    return {
      eyebrow: "Vereinsleitung",
      title: "Vereinsleitung – Übersicht",
      description:
        "Strategische Steuerung des Vereins mit Zielen, Initiativen, Meetings, Aufgaben und Entscheidungen an einem Ort.",
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
    eyebrow: "FC Allschwil WebApp",
    title: "Dashboard",
    description:
      "Saisongeführte Einstiegsseite. Saisons sind führend; Teams, Events und Planner werden dynamisch pro Saison aufgebaut.",
  };
}

export default function AdminPageHeader() {
  const pathname = usePathname();
  const headerContent = getHeaderContent(pathname);

  return (
    <div>
      <p className="fca-eyebrow">{headerContent.eyebrow}</p>
      <h1 className="fca-heading mt-2">{headerContent.title}</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate-500">
        {headerContent.description}
      </p>
    </div>
  );
}
