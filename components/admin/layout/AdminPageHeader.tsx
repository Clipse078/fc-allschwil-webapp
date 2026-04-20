"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type HeaderContent = {
  eyebrow: string;
  title: string;
  description: string;
};

type MeetingHeaderResponseItem = {
  slug: string;
  title: string;
  subtitle?: string | null;
};

function humanizeSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStaticHeaderContent(pathname: string): HeaderContent {
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

  if (pathname === "/vereinsleitung/meetings/new") {
    return {
      eyebrow: "Meetings",
      title: "Meeting planen",
      description: "Neues Meeting erfassen und direkt mit Pendenzen verknüpfen.",
    };
  }

  if (pathname.startsWith("/vereinsleitung/meetings/") && pathname.endsWith("/edit")) {
    const slug = pathname.replace("/vereinsleitung/meetings/", "").replace("/edit", "");
    return {
      eyebrow: "Meetings",
      title: humanizeSlug(slug),
      description: "Meeting-Daten und Pendenzen-Verknüpfungen anpassen.",
    };
  }

  if (pathname.startsWith("/vereinsleitung/meetings/")) {
    const slug = pathname.replace("/vereinsleitung/meetings/", "");
    return {
      eyebrow: "Meetings",
      title: humanizeSlug(slug),
      description: "Protokoll, Teilnehmer, Beschlüsse und Pendenzen.",
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
  const staticContent = useMemo(() => getStaticHeaderContent(pathname), [pathname]);
  const [dynamicContent, setDynamicContent] = useState<HeaderContent | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadMeetingHeader() {
      const isMeetingDetail =
        pathname.startsWith("/vereinsleitung/meetings/") &&
        pathname !== "/vereinsleitung/meetings" &&
        pathname !== "/vereinsleitung/meetings/new";

      if (!isMeetingDetail) {
        setDynamicContent(null);
        return;
      }

      const isEdit = pathname.endsWith("/edit");
      const slug = pathname
        .replace("/vereinsleitung/meetings/", "")
        .replace("/edit", "");

      try {
        const response = await fetch("/api/vereinsleitung/meetings", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Meeting header fetch failed");
        }

        const data = (await response.json()) as MeetingHeaderResponseItem[];
        const meeting = Array.isArray(data)
          ? data.find((item) => item.slug === slug)
          : null;

        if (isCancelled) {
          return;
        }

        if (!meeting) {
          setDynamicContent({
            eyebrow: "Meetings",
            title: humanizeSlug(slug),
            description: isEdit
              ? "Meeting-Daten und Pendenzen-Verknüpfungen anpassen."
              : "Protokoll, Teilnehmer, Beschlüsse und Pendenzen.",
          });
          return;
        }

        setDynamicContent({
          eyebrow: "Meetings",
          title: meeting.title,
          description:
            meeting.subtitle && meeting.subtitle.trim().length > 0
              ? meeting.subtitle
              : isEdit
                ? "Meeting-Daten und Pendenzen-Verknüpfungen anpassen."
                : "Protokoll, Teilnehmer, Beschlüsse und Pendenzen.",
        });
      } catch {
        if (isCancelled) {
          return;
        }

        setDynamicContent({
          eyebrow: "Meetings",
          title: humanizeSlug(slug),
          description: isEdit
            ? "Meeting-Daten und Pendenzen-Verknüpfungen anpassen."
            : "Protokoll, Teilnehmer, Beschlüsse und Pendenzen.",
        });
      }
    }

    void loadMeetingHeader();

    return () => {
      isCancelled = true;
    };
  }, [pathname]);

  const headerContent = dynamicContent ?? staticContent;

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
