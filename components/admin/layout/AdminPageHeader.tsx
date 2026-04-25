"use client";

import Link from "next/link";
import { ChevronRight, Command, Search, Users, Shield, CalendarDays, Flag, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type HeaderContent = {
  eyebrow: string;
  title: string;
  description?: string;
};

type MeetingHeaderResponseItem = {
  slug: string;
  title: string;
  subtitle?: string | null;
};

type SpotlightResult = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  type: "person" | "team" | "meeting" | "initiative";
};

type SpotlightGroup = {
  key: "person" | "team" | "meeting" | "initiative";
  label: string;
};

type AdminPageHeaderProps = {
  firstName?: string;
  currentSeasonLabel?: string;
  canManageSeasons?: boolean;
};

const SPOTLIGHT_GROUPS: SpotlightGroup[] = [
  { key: "person", label: "Personen" },
  { key: "team", label: "Teams" },
  { key: "meeting", label: "Meetings" },
  { key: "initiative", label: "Initiativen" },
];

const DUMMY_RESULTS: SpotlightResult[] = [
  {
    id: "p1",
    title: "Patrick Scotton",
    subtitle: "Vereinsleitung",
    href: "/dashboard/persons",
    type: "person",
  },
  {
    id: "p2",
    title: "Nicole NÃ¼ssli",
    subtitle: "Vereinsleitung",
    href: "/dashboard/persons",
    type: "person",
  },
  {
    id: "t1",
    title: "E4",
    subtitle: "Aktuelle Saison",
    href: "/dashboard/teams",
    type: "team",
  },
  {
    id: "m1",
    title: "Vereinsleitungssitzung Mai 2026",
    subtitle: "02.05.2026 Â· Vereinsleitung",
    href: "/vereinsleitung/meetings",
    type: "meeting",
  },
  {
    id: "i1",
    title: "Website Go-Live",
    subtitle: "Initiative Â· In Umsetzung",
    href: "/vereinsleitung/initiativen",
    type: "initiative",
  },
];

function humanizeSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getDayGreeting(firstName?: string) {
  const hour = new Date().getHours();
  const safeFirstName = (firstName ?? "").trim() || "Michael";

  if (hour < 12) {
    return `Guten Morgen, ${safeFirstName}`;
  }

  if (hour < 18) {
    return `Guten Tag, ${safeFirstName}`;
  }

  return `Guten Abend, ${safeFirstName}`;
}

function getStaticHeaderContent(pathname: string, firstName?: string): HeaderContent {
  if (pathname === "/dashboard") {
    return {
      eyebrow: "",
      title: getDayGreeting(firstName),
    };
  }

  if (pathname === "/dashboard/operations") {
    return {
      eyebrow: "2. Betrieb & Organisation",
      title: "Betrieb & Organisation",
      description:
        "Demo-ModulÃ¼bersicht fÃ¼r Finanzen, Material, Medien, AktivitÃ¤ten / Events, Business Club, Archiv, Meetings und Kommunikation HUB.",
    };
  }

  if (pathname.startsWith("/dashboard/operations/")) {
    return {
      eyebrow: "2. Betrieb & Organisation",
      title: humanizeSlug(pathname.replace("/dashboard/operations/", "")),
      description:
        "Demo-Platzhalter fÃ¼r das kommende Modul. Diese Seite dient fÃ¼r die Freitag-Demo als zukÃ¼nftiger Modulanker.",
    };
  }

  if (pathname === "/dashboard/technische-kommission") {
    return {
      eyebrow: "3. Technische Kommission",
      title: "Technische Kommission",
      description:
        "Demo-ModulÃ¼bersicht fÃ¼r Leistungsplan Aktive, Jugend-Ausbildungsplan, Meetings und Kommunikation HUB.",
    };
  }

  if (pathname.startsWith("/dashboard/technische-kommission/")) {
    return {
      eyebrow: "3. Technische Kommission",
      title: humanizeSlug(pathname.replace("/dashboard/technische-kommission/", "")),
      description:
        "Demo-Platzhalter fÃ¼r das kommende Modul der Technischen Kommission.",
    };
  }

  if (pathname === "/dashboard/current-season") {
    return {
      eyebrow: "4. Aktuelle Saison",
      title: "Aktuelle Saison",
      description:
        "ModulÃ¼bersicht fÃ¼r aktuelle Saisonprozesse mit Teams, Jahresplan, Wochenplan und Tagesplan.",
    };
  }

  if (pathname === "/dashboard/next-season") {
    return {
      eyebrow: "5. NÃ¤chste Saison",
      title: "NÃ¤chste Saison",
      description:
        "Demo-ModulÃ¼bersicht fÃ¼r die kommende Saison mit Teams, Jahresplan, Wochenplan und Tagesplan.",
    };
  }

  if (pathname.startsWith("/dashboard/next-season/")) {
    return {
      eyebrow: "5. NÃ¤chste Saison",
      title: humanizeSlug(pathname.replace("/dashboard/next-season/", "")),
      description:
        "Demo-Platzhalter fÃ¼r die kommende Saisonplanung.",
    };
  }

  if (pathname === "/dashboard/persons") {
    return {
      eyebrow: "6. Personen",
      title: "Personen",
      description:
        "Personenmodul fÃ¼r Trainer, Spieler, VereinsfunktionÃ¤re und externe Kontakte.",
    };
  }

  if (pathname === "/dashboard/vereinsfunktionaere") {
    return {
      eyebrow: "6. Personen",
      title: "VereinsfunktionÃ¤re",
      description:
        "Demo-Platzhalter fÃ¼r VereinsfunktionÃ¤re als eigenes Personen-Teilmodul.",
    };
  }

  if (pathname === "/dashboard/external-contacts") {
    return {
      eyebrow: "6. Personen",
      title: "Externe Kontakte",
      description:
        "Demo-Platzhalter fÃ¼r externe Kontakte als eigenes Personen-Teilmodul.",
    };
  }

  if (pathname === "/dashboard/trainers") {
    return {
      eyebrow: "6. Personen",
      title: "Trainer",
      description:
        "Trainerdaten strukturiert verwalten und fÃ¼r Organisation und Website bereitstellen.",
    };
  }

  if (pathname === "/dashboard/players") {
    return {
      eyebrow: "6. Personen",
      title: "Spieler",
      description:
        "Spielerdaten zentral verwalten und fÃ¼r spÃ¤tere Prozesse und Teams nutzbar machen.",
    };
  }

  if (pathname === "/dashboard/neu-anmeldungen") {
    return {
      eyebrow: "7. Neue Anmeldungen",
      title: "Neue Anmeldungen",
      description:
        "Demo-ModulÃ¼bersicht fÃ¼r neue Trainer, neue Spieler und neue VereinsfunktionÃ¤re.",
    };
  }

  if (pathname.startsWith("/dashboard/neu-anmeldungen/")) {
    return {
      eyebrow: "7. Neue Anmeldungen",
      title: humanizeSlug(pathname.replace("/dashboard/neu-anmeldungen/", "")),
      description:
        "Demo-Platzhalter fÃ¼r eingehende Neuanmeldungen.",
    };
  }

  if (pathname === "/dashboard/users" || pathname.startsWith("/dashboard/users/")) {
    return {
      eyebrow: "8. Benutzer & Rollen",
      title: "Benutzer & Rollen",
      description:
        "Benutzer, Rollen, Berechtigungen und Zugriffe sicher und zentral verwalten.",
    };
  }

  if (pathname === "/dashboard/planner") {
    return {
      eyebrow: "4. Aktuelle Saison",
      title: "Jahresplan",
      description:
        "FÃ¼hrende Saisonplanung mit Trainings, Matches, Turnieren, weiteren Events und Ferienperioden Ã¼ber die ganze Saison.",
    };
  }

  if (pathname === "/dashboard/planner/week") {
    return {
      eyebrow: "4. Aktuelle Saison",
      title: "Wochenplan",
      description:
        "Operative Wochenplanung pro Kalenderwoche. Diese Sicht ist fÃ¼r Website und spÃ¤ter Mobile App vorgesehen.",
    };
  }

  if (pathname === "/dashboard/planner/day") {
    return {
      eyebrow: "4. Aktuelle Saison",
      title: "Tagesplan",
      description:
        "Operative Tagesplanung fÃ¼r den Live-Betrieb und die direkte Ausspielung auf das Infoboard.",
    };
  }

  if (pathname === "/vereinsleitung/meetings") {
    return {
      eyebrow: "1. Vereinsleitung",
      title: "Meetings",
      description: "Ãœbersicht aller Sitzungen â€“ absteigend vom neuesten zum Ã¤ltesten Eintrag.",
    };
  }

  if (pathname === "/vereinsleitung/meetings/new") {
    return {
      eyebrow: "1. Vereinsleitung",
      title: "Meeting planen",
      description: "Neues Meeting erfassen und direkt mit Pendenzen verknÃ¼pfen.",
    };
  }

  if (pathname.startsWith("/vereinsleitung/meetings/") && pathname.endsWith("/edit")) {
    const slug = pathname.replace("/vereinsleitung/meetings/", "").replace("/edit", "");
    return {
      eyebrow: "1. Vereinsleitung",
      title: humanizeSlug(slug),
      description: "Meeting-Daten und Pendenzen-VerknÃ¼pfungen anpassen.",
    };
  }

  if (pathname.startsWith("/vereinsleitung/meetings/")) {
    const slug = pathname.replace("/vereinsleitung/meetings/", "");
    return {
      eyebrow: "1. Vereinsleitung",
      title: humanizeSlug(slug),
      description: "Protokoll, Teilnehmer, BeschlÃ¼sse und Pendenzen.",
    };
  }

  if (pathname === "/vereinsleitung/initiativen") {
    return {
      eyebrow: "1. Vereinsleitung",
      title: "Initiativen",
      description: "Ãœbersicht aller Initiativen â€“ absteigend vom neuesten zum Ã¤ltesten Eintrag.",
    };
  }

  if (pathname.startsWith("/vereinsleitung/initiativen/")) {
    return {
      eyebrow: "1. Vereinsleitung",
      title: "Initiative â€“ Details",
      description: "Fortschritt, Aufgaben, Meetings und Entscheidungen.",
    };
  }

  if (pathname === "/vereinsleitung/kommunikation-hub") {
    return {
      eyebrow: "1. Vereinsleitung",
      title: "Kommunikation HUB",
      description:
        "Demo-Platzhalter fÃ¼r den kÃ¼nftigen Kommunikations-Hub der Vereinsleitung.",
    };
  }

  if (pathname === "/vereinsleitung/kpis") {
    return {
      eyebrow: "1. Vereinsleitung",
      title: "KPIs",
      description: "Kennzahlen und Trends fÃ¼r die strategische Steuerung des Vereins.",
    };
  }

  if (pathname === "/vereinsleitung" || pathname.startsWith("/vereinsleitung/")) {
    return {
      eyebrow: "1. Vereinsleitung",
      title: "Vereinsleitung â€“ Ãœbersicht",
      description:
        "Strategische Steuerung des Vereins mit Zielen, Initiativen, Meetings, Aufgaben und Entscheidungen an einem Ort.",
    };
  }

  if (pathname === "/dashboard/seasons" || pathname.startsWith("/dashboard/seasons/")) {
    return {
      eyebrow: "Saisons",
      title: "Saisonplanung",
      description:
        "Neue zukÃ¼nftige Saisons sind in Planung. Die aktuelle Saison ist laufend. Vergangene Saisons werden nach Saisonende automatisch abgeschlossen.",
    };
  }

  if (pathname === "/dashboard/events" || pathname.startsWith("/dashboard/events/")) {
    return {
      eyebrow: "4. Aktuelle Saison",
      title: "Events",
      description:
        "Events sind saisongefÃ¼hrt und umfassen Matches, Turniere, Trainings sowie weitere Vereinsereignisse pro gewÃ¤hlter Saison.",
    };
  }

  if (pathname === "/dashboard/teams" || pathname.startsWith("/dashboard/teams/")) {
    return {
      eyebrow: "4. Aktuelle Saison",
      title: "Teams",
      description:
        "Teams sind saisongefÃ¼hrt und werden dynamisch pro Saison und Teamkategorie verwaltet.",
    };
  }

  return {
    eyebrow: "",
    title: "Dashboard",
  };
}

function getSpotlightIcon(type: SpotlightResult["type"]) {
  switch (type) {
    case "person":
      return Users;
    case "team":
      return Shield;
    case "meeting":
      return CalendarDays;
    case "initiative":
      return Flag;
    default:
      return Search;
  }
}

function SpotlightSearch() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [portalStyle, setPortalStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const filteredResults = useMemo(() => {
    const safeQuery = query.trim().toLowerCase();
    if (!safeQuery) {
      return DUMMY_RESULTS;
    }

    return DUMMY_RESULTS.filter((item) => {
      return (
        item.title.toLowerCase().includes(safeQuery) ||
        item.subtitle.toLowerCase().includes(safeQuery)
      );
    });
  }, [query]);

  const groupedResults = useMemo(() => {
    return SPOTLIGHT_GROUPS.map((group) => ({
      ...group,
      items: filteredResults.filter((item) => item.type === group.key),
    })).filter((group) => group.items.length > 0);
  }, [filteredResults]);

  function updatePortalPosition() {
    if (!containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const maxWidth = Math.min(820, viewportWidth - 32);
    const width = Math.min(rect.width, maxWidth);
    const left = Math.min(rect.left, viewportWidth - width - 16);

    setPortalStyle({
      top: rect.bottom + 14,
      left: Math.max(16, left),
      width,
    });
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setIsOpen(false);
      }

      if (!isOpen) {
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((current) =>
          Math.min(current + 1, Math.max(filteredResults.length - 1, 0)),
        );
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((current) => Math.max(current - 1, 0));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredResults.length]);

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(0);
      return;
    }

    updatePortalPosition();

    function handleWindowChange() {
      updatePortalPosition();
    }

    window.addEventListener("resize", handleWindowChange);
    window.addEventListener("scroll", handleWindowChange, true);

    return () => {
      window.removeEventListener("resize", handleWindowChange);
      window.removeEventListener("scroll", handleWindowChange, true);
    };
  }, [isOpen, query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) {
        return;
      }

      const portalElement = document.getElementById("admin-spotlight-portal");

      if (
        !containerRef.current.contains(event.target as Node) &&
        !(portalElement && portalElement.contains(event.target as Node))
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const portal =
    isOpen && portalStyle
      ? createPortal(
          <div
            id="admin-spotlight-portal"
            className="fixed inset-x-0 top-24 z-[180] flex justify-center px-4"
          >
            <div className="w-full max-w-[820px]">
            <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
              <div className="h-[3px] w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />

              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3">
                  <Search className="h-4 w-4 text-[#0b4aa2]" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Nach Personen, Teams, Meetings oder Initiativen suchen â€¦"
                    className="w-full bg-transparent text-sm text-slate-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-50"
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    ESC
                  </button>
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto">
                {groupedResults.length === 0 ? (
                  <div className="px-5 py-8 text-sm text-slate-500">
                    Keine Treffer gefunden.
                  </div>
                ) : (
                  <div>
                    {(() => {
                      let flatIndex = -1;

                      return groupedResults.map((group) => (
                        <div key={group.key} className="border-b border-slate-100 last:border-b-0">
                          <div className="px-5 py-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {group.label}
                            </div>
                          </div>

                          <div className="px-3 pb-3">
                            {group.items.map((item) => {
                              flatIndex += 1;
                              const isHighlighted = flatIndex === highlightedIndex;
                              const Icon = getSpotlightIcon(item.type);

                              return (
                                <Link
                                  key={item.id}
                                  href={item.href}
                                  onMouseEnter={() => setHighlightedIndex(flatIndex)}
                                  onClick={() => setIsOpen(false)}
                                  className={`mb-2 flex items-center justify-between gap-3 rounded-[20px] border px-4 py-3 transition last:mb-0 ${
                                    isHighlighted
                                      ? "border-[#0b4aa2]/20 bg-[#0b4aa2]/[0.05]"
                                      : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                                  }`}
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b4aa2]">
                                      <Icon className="h-4 w-4" />
                                    </div>

                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-semibold text-slate-900">
                                        {item.title}
                                      </div>
                                      <div className="truncate text-xs text-slate-500">
                                        {item.subtitle}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <span className="hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-[#0b4aa2] sm:inline-flex">
                                      {group.label.slice(0, -1)}
                                    </span>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}

                    <div className="border-t border-slate-100 px-4 py-3">
                      <Link
                        href="/dashboard"
                        onClick={() => setIsOpen(false)}
                        className="flex items-center justify-between rounded-[18px] px-4 py-3 text-sm font-semibold text-[#0b4aa2] transition hover:bg-slate-50"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Search className="h-4 w-4" />
                          Alle Ergebnisse anzeigen
                        </span>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                )}
            </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={containerRef} className="relative w-full max-w-[820px]">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex w-full items-center justify-between rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-left shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition hover:border-slate-300 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]"
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-50 text-[#0b4aa2] transition group-hover:bg-[#0b4aa2]/[0.06]">
              <Search className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">
                Global suchen
              </div>
              <div className="truncate text-sm text-slate-500">
                Spieler, Teams, Meetings, Initiativen â€¦
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-500 sm:inline-flex">
            <Command className="h-3.5 w-3.5" />
            K
          </div>
        </button>
      </div>

      {portal}
    </>
  );
}

export default function AdminPageHeader({
  firstName,
  currentSeasonLabel,
  canManageSeasons,
}: AdminPageHeaderProps) {
  const pathname = usePathname();
  const staticContent = useMemo(
    () => getStaticHeaderContent(pathname, firstName),
    [pathname, firstName],
  );
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
            eyebrow: "1. Vereinsleitung",
            title: humanizeSlug(slug),
            description: isEdit
              ? "Meeting-Daten und Pendenzen-VerknÃ¼pfungen anpassen."
              : "Protokoll, Teilnehmer, BeschlÃ¼sse und Pendenzen.",
          });
          return;
        }

        setDynamicContent({
          eyebrow: "1. Vereinsleitung",
          title: meeting.title,
          description:
            meeting.subtitle && meeting.subtitle.trim().length > 0
              ? meeting.subtitle
              : isEdit
                ? "Meeting-Daten und Pendenzen-VerknÃ¼pfungen anpassen."
                : "Protokoll, Teilnehmer, BeschlÃ¼sse und Pendenzen.",
        });
      } catch {
        if (isCancelled) {
          return;
        }

        setDynamicContent({
          eyebrow: "1. Vereinsleitung",
          title: humanizeSlug(slug),
          description: isEdit
            ? "Meeting-Daten und Pendenzen-VerknÃ¼pfungen anpassen."
            : "Protokoll, Teilnehmer, BeschlÃ¼sse und Pendenzen.",
        });
      }
    }

    void loadMeetingHeader();

    return () => {
      isCancelled = true;
    };
  }, [pathname]);

  const headerContent: HeaderContent = { eyebrow: "", title: getDayGreeting(firstName), description: undefined };
  const showDashboardSeasonPill =
    pathname === "/dashboard" &&
    Boolean(currentSeasonLabel) &&
    Boolean(canManageSeasons);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          {headerContent.eyebrow ? (
            <p className="fca-eyebrow">{headerContent.eyebrow}</p>
          ) : null}

          <h1 className="fca-heading mt-2">{headerContent.title}</h1>

          {headerContent.description ? (
            <p className="mt-3 max-w-2xl text-sm text-slate-500">
              {headerContent.description}
            </p>
          ) : null}
        </div>

        {showDashboardSeasonPill ? (
          <Link
            href="/dashboard/seasons"
            className="group inline-flex w-fit items-center gap-3 rounded-full border border-[#d7e3f8] bg-[#f3f7fd] px-4 py-2.5 text-sm font-semibold text-[#0b4aa2] shadow-sm transition hover:border-[#bdd1f3] hover:bg-white hover:shadow-[0_10px_24px_rgba(11,74,162,0.10)]"
          >
            <span className="text-slate-500">Saison</span>
            <span>{currentSeasonLabel}</span>
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
        ) : null}
      </div>

      <SpotlightSearch />
    </div>
  );
}



