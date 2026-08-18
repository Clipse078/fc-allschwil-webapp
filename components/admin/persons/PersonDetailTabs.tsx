"use client";

/**
 * PERSON-UX-02 — Person Workspace tab shell.
 *
 * Evolves the PERSON-UX-01 9-tab layout into a permission-ready, capacity-aware
 * workspace:
 *
 *   Übersicht · Stammdaten · Organisation
 *   · [Spieler]   — visible iff Person has player evidence (current or historical)
 *   · [Trainer]   — visible iff Person has trainer evidence (current or historical)
 *   · [Sport & Entwicklung] — visible iff any sporting evidence exists
 *   · Mitgliedschaft · Finanzen · Gesundheit · Dokumente · Zugang
 *
 * Tab visibility contract:
 *   Each tab definition carries a `hidden` boolean. A hidden tab is removed
 *   from the DOM entirely — no layout/spacing cost, no empty-state clutter for
 *   external/non-sporting Persons.
 *
 * Permission-ready architecture:
 *   The tab registry is structured so future permission checks can be added
 *   without a rewrite. Each tab can carry a `requiredPermission` string key.
 *   IMPORTANT: Do NOT hardcode role names (e.g. "Club Admin", "Sportleitung").
 *   Roles are configurable containers for permissions; only permission keys
 *   (e.g. "people.view.assessments") must appear here in a future slice.
 *   The current slice does not evaluate permissions for content tabs — that
 *   is a server-side concern. The `requiredPermission` field is reserved for
 *   the future tab-gating slice.
 *
 * Simultaneous roles are always first-class: a Person may hold Spieler +
 * Trainer + Funktionär in the same season. No single "primary" role is selected.
 *
 * Responsive: tab bar wraps on small screens (flex-wrap, no overflow-x-scroll).
 * Hidden tabs consume zero DOM space.
 */

import { useState } from "react";
import {
  LayoutDashboard,
  User,
  Building2,
  Users2,
  UserCheck,
  Trophy,
  CreditCard,
  DollarSign,
  HeartPulse,
  FolderOpen,
  KeyRound,
} from "lucide-react";
import type { PersonAssignment, PersonDetail, PersonSquadMembership, PersonTrainerMembership } from "@/lib/people/queries";
import type { PersonAccessRole, PersonAccessLinkedUser } from "./PersonAccessRolesCard";
import { resolvePersonCapacities } from "@/lib/people/capacity";
import PersonWorkspaceOverviewTab from "./PersonWorkspaceOverviewTab";
import PersonAssignmentsTab from "./PersonAssignmentsTab";
import PersonContactTab from "./PersonContactTab";
import PersonSpielerTab from "./PersonSpielerTab";
import PersonTrainerTab from "./PersonTrainerTab";
import PersonSportTab from "./PersonSportTab";
import PersonZugangTab from "./PersonZugangTab";
import PersonDomainPlaceholder from "./PersonDomainPlaceholder";

type Tab =
  | "uebersicht"
  | "stammdaten"
  | "organisation"
  | "spieler"
  | "trainer"
  | "sport"
  | "mitgliedschaft"
  | "finanzen"
  | "gesundheit"
  | "dokumente"
  | "zugang";

type PersonDetailTabsProps = {
  person: PersonDetail & {
    assignments: PersonAssignment[];
    squadMemberships: PersonSquadMembership[];
    trainerMemberships: PersonTrainerMembership[];
  };
  canManage: boolean;
  canDelete: boolean;
  orgUnits: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string; shortName?: string | null }>;
  activeSeason: { id: string; name: string; key: string } | null;
  accessRolesCard: {
    linkedUser: PersonAccessLinkedUser | null;
    isActiveTenantMember: boolean;
    roles: PersonAccessRole[];
    assignedRoleIds: string[];
    canAssign: boolean;
  } | null;
};

/**
 * Tab descriptor for the registry.
 *
 * hidden:
 *   When true, the tab is not rendered at all (no DOM node, no empty space).
 *   Computed from Person capacity (hasPlayerEvidence, etc.) and, in future,
 *   viewer permissions.
 *
 * requiredPermission (reserved for future use):
 *   A permission key string (e.g. "people.view.assessments") that a viewer
 *   must hold for this tab to be shown. Do NOT put role names here.
 *   Currently unused — the field is present so the registry shape is ready
 *   for the future permission-gating slice without a structural rewrite.
 */
type TabDefinition = {
  key: Tab;
  label: string;
  icon: React.ReactNode;
  count?: number;
  /** Deferred domain — placeholder content, not yet implemented. */
  deferred?: boolean;
  /** Tab is hidden: not rendered in DOM. Zero layout cost. */
  hidden?: boolean;
  /** Reserved: future permission key required to show this tab. */
  requiredPermission?: string;
};

export default function PersonDetailTabs({
  person,
  canManage,
  canDelete,
  orgUnits,
  teams,
  activeSeason,
  accessRolesCard,
}: PersonDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("uebersicht");

  // ── Capacity resolution ────────────────────────────────────────────────────
  // Derived from persisted relationship chains, not from isPlayer/isTrainer flags.
  const capacities = resolvePersonCapacities(
    person.squadMemberships,
    person.trainerMemberships,
  );

  // ── Counts for badges ──────────────────────────────────────────────────────
  const activeAssignmentCount = person.assignments.filter((a) => a.status === "ACTIVE").length;

  // ── Tab registry ───────────────────────────────────────────────────────────
  // Tab visibility = Person relevance + (future) viewer permission.
  // Structural design: adding permission checks later requires only setting
  // `hidden` based on a permission resolver — no structural rewrite.
  const TABS: TabDefinition[] = [
    {
      key: "uebersicht",
      label: "Übersicht",
      icon: <LayoutDashboard className="h-3.5 w-3.5" />,
    },
    {
      key: "stammdaten",
      label: "Stammdaten",
      icon: <User className="h-3.5 w-3.5" />,
    },
    {
      key: "organisation",
      label: "Organisation",
      icon: <Building2 className="h-3.5 w-3.5" />,
      count: activeAssignmentCount,
    },
    {
      key: "spieler",
      label: "Spieler",
      icon: <Users2 className="h-3.5 w-3.5" />,
      // Visible for current AND former players. Never shown for persons who were never players.
      hidden: !capacities.hasPlayerEvidence,
    },
    {
      key: "trainer",
      label: "Trainer",
      icon: <UserCheck className="h-3.5 w-3.5" />,
      // Visible for current AND former trainers. Never shown for never-trainers.
      hidden: !capacities.hasTrainerEvidence,
    },
    {
      key: "sport",
      label: "Sport & Entwicklung",
      icon: <Trophy className="h-3.5 w-3.5" />,
      // Cross-role season biography + development placeholder.
      // Hidden for external/non-sporting Persons: no sports-centric clutter.
      hidden: !capacities.hasSportingEvidence,
    },
    {
      key: "mitgliedschaft",
      label: "Mitgliedschaft",
      icon: <CreditCard className="h-3.5 w-3.5" />,
      deferred: true,
    },
    {
      key: "finanzen",
      label: "Finanzen",
      icon: <DollarSign className="h-3.5 w-3.5" />,
      deferred: true,
    },
    {
      key: "gesundheit",
      label: "Gesundheit",
      icon: <HeartPulse className="h-3.5 w-3.5" />,
      deferred: true,
    },
    {
      key: "dokumente",
      label: "Dokumente",
      icon: <FolderOpen className="h-3.5 w-3.5" />,
      deferred: true,
    },
    {
      key: "zugang",
      label: "Zugang",
      icon: <KeyRound className="h-3.5 w-3.5" />,
    },
  ];

  // Only render visible tabs
  const visibleTabs = TABS.filter((t) => !t.hidden);

  return (
    <div className="space-y-0">
      {/* Tab navigation — wraps on small screens; hidden tabs consume no space */}
      <div className="border-b border-[var(--border)]">
        <nav
          className="-mb-px flex flex-wrap gap-0"
          aria-label="Person Workspace Tabs"
          role="tablist"
        >
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab.key}`}
                id={`tab-${tab.key}`}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "border-[var(--sce-primary)] text-[var(--sce-primary)]"
                    : "border-transparent text-[var(--text-2)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab.icon}
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive
                        ? "bg-[var(--sce-accent)] text-[var(--sce-primary)]"
                        : "bg-[var(--surface-3)] text-[var(--muted)]"
                    }`}
                  >
                    {tab.count}
                  </span>
                ) : null}
                {tab.deferred ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--border-strong)]" title="Geplant" />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab panels — only active tab content is mounted */}
      <div className="pt-6">
        {/* Übersicht */}
        <div
          role="tabpanel"
          id="tabpanel-uebersicht"
          aria-labelledby="tab-uebersicht"
          hidden={activeTab !== "uebersicht"}
        >
          {activeTab === "uebersicht" ? (
            <PersonWorkspaceOverviewTab
              person={person}
              activeSeason={activeSeason}
            />
          ) : null}
        </div>

        {/* Stammdaten */}
        <div
          role="tabpanel"
          id="tabpanel-stammdaten"
          aria-labelledby="tab-stammdaten"
          hidden={activeTab !== "stammdaten"}
        >
          {activeTab === "stammdaten" ? (
            <PersonContactTab
              person={person}
              canManage={canManage}
              canDelete={canDelete}
            />
          ) : null}
        </div>

        {/* Organisation */}
        <div
          role="tabpanel"
          id="tabpanel-organisation"
          aria-labelledby="tab-organisation"
          hidden={activeTab !== "organisation"}
        >
          {activeTab === "organisation" ? (
            <PersonAssignmentsTab
              personId={person.id}
              assignments={person.assignments}
              canManage={canManage}
              orgUnits={orgUnits}
              teams={teams}
              activeSeason={activeSeason}
            />
          ) : null}
        </div>

        {/* Spieler — only rendered when tab is visible */}
        {!TABS.find((t) => t.key === "spieler")!.hidden ? (
          <div
            role="tabpanel"
            id="tabpanel-spieler"
            aria-labelledby="tab-spieler"
            hidden={activeTab !== "spieler"}
          >
            {activeTab === "spieler" ? (
              <PersonSpielerTab squadMemberships={person.squadMemberships} />
            ) : null}
          </div>
        ) : null}

        {/* Trainer — only rendered when tab is visible */}
        {!TABS.find((t) => t.key === "trainer")!.hidden ? (
          <div
            role="tabpanel"
            id="tabpanel-trainer"
            aria-labelledby="tab-trainer"
            hidden={activeTab !== "trainer"}
          >
            {activeTab === "trainer" ? (
              <PersonTrainerTab trainerMemberships={person.trainerMemberships} />
            ) : null}
          </div>
        ) : null}

        {/* Sport & Entwicklung — only rendered when tab is visible */}
        {!TABS.find((t) => t.key === "sport")!.hidden ? (
          <div
            role="tabpanel"
            id="tabpanel-sport"
            aria-labelledby="tab-sport"
            hidden={activeTab !== "sport"}
          >
            {activeTab === "sport" ? (
              <PersonSportTab
                squadMemberships={person.squadMemberships}
                trainerMemberships={person.trainerMemberships}
                assignments={person.assignments}
              />
            ) : null}
          </div>
        ) : null}

        {/* Mitgliedschaft — deferred */}
        <div
          role="tabpanel"
          id="tabpanel-mitgliedschaft"
          aria-labelledby="tab-mitgliedschaft"
          hidden={activeTab !== "mitgliedschaft"}
        >
          {activeTab === "mitgliedschaft" ? (
            <PersonDomainPlaceholder
              icon={<CreditCard className="h-6 w-6" />}
              title="Mitgliedschaft"
              description="Mitgliedschaftslebenszyklus, -typ, Eintrittsdatum, Austrittsdatum und
                Mitgliedschaftshistorie werden in einem späteren Modul implementiert."
              plannedFor="PERSON-UX-03 (Mitgliedschaft)"
            />
          ) : null}
        </div>

        {/* Finanzen — deferred */}
        <div
          role="tabpanel"
          id="tabpanel-finanzen"
          aria-labelledby="tab-finanzen"
          hidden={activeTab !== "finanzen"}
        >
          {activeTab === "finanzen" ? (
            <PersonDomainPlaceholder
              icon={<DollarSign className="h-6 w-6" />}
              title="Finanzen"
              description="Beitrags- und Rechnungsdaten folgen dem Pfad:
                Person → Mitgliedschaft → Beitragspflicht → Rechnung → Zahlung.
                Dieses Modul erfordert ein separates Buchhaltungssystem und wird
                nicht direkt in die Person integriert."
              plannedFor="PERSON-UX-0x (Finanzen)"
            />
          ) : null}
        </div>

        {/* Gesundheit — deferred, restricted access */}
        <div
          role="tabpanel"
          id="tabpanel-gesundheit"
          aria-labelledby="tab-gesundheit"
          hidden={activeTab !== "gesundheit"}
        >
          {activeTab === "gesundheit" ? (
            <PersonDomainPlaceholder
              icon={<HeartPulse className="h-6 w-6" />}
              title="Gesundheit"
              description="Medizinische Informationen (Erkrankungen, Allergien, Notfallkontakte)
                werden in einem späteren Modul mit dedizierter Feinabstufung der Zugriffsrechte
                implementiert."
              plannedFor="PERSON-UX-0x (Gesundheit)"
              variant="restricted"
              accessNote="Kritisch: Medizinische Informationen dürfen NICHT den allgemeinen
                people.view-Berechtigungen erben. Sie erfordern eine dedizierte, eigenständige
                Autorisierung. Allgemeiner Personenzugriff gewährt keinen Zugang zu diesem Modul."
            />
          ) : null}
        </div>

        {/* Dokumente — deferred, restricted access */}
        <div
          role="tabpanel"
          id="tabpanel-dokumente"
          aria-labelledby="tab-dokumente"
          hidden={activeTab !== "dokumente"}
        >
          {activeTab === "dokumente" ? (
            <PersonDomainPlaceholder
              icon={<FolderOpen className="h-6 w-6" />}
              title="Persönliche Dokumente"
              description="Vereinbarungen, Formulare, Zertifikate und streng private Dokumente
                dieser Person werden in einem späteren Modul implementiert."
              plannedFor="PERSON-UX-0x (Dokumente)"
              variant="restricted"
              accessNote="Kritisch: Persönliche Dokumente werden NICHT Bestandteil generischer
                Workspace-Dateien. Sie erfordern eigenständige Zugriffsrechte mit vollständiger
                Protokollierung (Auditierbarkeit) und werden separat von people.view autorisiert."
            />
          ) : null}
        </div>

        {/* Zugang */}
        <div
          role="tabpanel"
          id="tabpanel-zugang"
          aria-labelledby="tab-zugang"
          hidden={activeTab !== "zugang"}
        >
          {activeTab === "zugang" ? (
            <PersonZugangTab
              personId={person.id}
              accessRolesCard={accessRolesCard}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
