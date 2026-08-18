"use client";

/**
 * PERSON-UX-01 — Person Workspace tab shell.
 * PERSON-UX-02 — Capacity-aware tab visibility.
 * PERSON-UX-03 — Domain-permission-aware tab visibility.
 * PERSON-UX-07 — Profile & capacity flags drive role-specific workspace tabs.
 *
 * Workspace tabs:
 *   Übersicht · Stammdaten · Organisation
 *   · [Spieler]             — visible iff person.isPlayer is true
 *   · [Trainer]             — visible iff person.isTrainer is true
 *   · [Sport & Entwicklung] — visible iff isPlayer OR isTrainer (OR relationship evidence)
 *   · Mitgliedschaft
 *   · [Finanzen]            — visible iff viewer holds people.finance.view
 *   · [Gesundheit]          — visible iff viewer holds people.health.view
 *   · [Dokumente]           — visible iff viewer holds people.private_documents.view
 *   · Zugang
 *
 * PERSON-UX-07 Capacity model:
 *   Tab visibility for Spieler and Trainer is driven by the explicit capacity
 *   flags (person.isPlayer, person.isTrainer), NOT solely by membership evidence.
 *   Removing a capacity flag hides the tab but does NOT delete historical data.
 *   Multiple capacities may be true simultaneously — tabs for each are shown.
 *   Custom functions (Weitere Funktion) do NOT generate dedicated tabs.
 *
 * Authorization model (PERSON-UX-03):
 *   Sensitive domain tabs require viewer domain permissions. Absent → no tab,
 *   no placeholder, no hint about the domain's existence. Fail-closed.
 *
 * Capacity ≠ Assignment ≠ Authorization:
 *   isPlayer=true means "this Person has a player profile".
 *   It does NOT grant team assignment or assessment permissions automatically.
 *
 * IMPORTANT: Do NOT hardcode role names. Only permission keys may appear here.
 *
 * Simultaneous capacities are always first-class: a Person may hold Spieler +
 * Trainer + Funktionär at once. No single "primary" capacity is selected.
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
import type { PersonAssignment, PersonDetail, PersonSquadMembership, PersonTrainerMembership, PersonMembershipRecord, PersonAssessmentRecord, TenantCriterion } from "@/lib/people/queries";
import type { PersonAccessRole, PersonAccessLinkedUser } from "./PersonAccessRolesCard";
import type { PersonDomainPermissions } from "@/lib/people/person-domain-auth";
import { resolvePersonCapacities } from "@/lib/people/capacity";
import PersonWorkspaceOverviewTab from "./PersonWorkspaceOverviewTab";
import PersonAssignmentsTab from "./PersonAssignmentsTab";
import PersonContactTab from "./PersonContactTab";
import PersonSpielerTab from "./PersonSpielerTab";
import PersonTrainerTab from "./PersonTrainerTab";
import PersonSportTab from "./PersonSportTab";
import PersonZugangTab from "./PersonZugangTab";
import PersonDomainPlaceholder from "./PersonDomainPlaceholder";
import PersonMembershipTab from "./PersonMembershipTab";

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
    // PERSON-UX-07: capacity flags must be present on person object
    isPlayer: boolean;
    isTrainer: boolean;
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
  /**
   * Sensitive domain access flags resolved server-side.
   * Determines which domain tabs are rendered for this viewer.
   * Defaults to all-denied when absent (fail-closed).
   */
  domainPermissions?: PersonDomainPermissions;
  /** PERSON-UX-04: Club membership records, newest first. */
  memberships?: PersonMembershipRecord[];
  /** PERSON-UX-05: Development assessments, newest first. Pre-fetched server-side. */
  assessments?: PersonAssessmentRecord[];
  /** PERSON-UX-05: Active criteria for assessment forms. */
  criteria?: TenantCriterion[];
};

/**
 * Tab descriptor for the registry.
 *
 * hidden:
 *   When true, the tab is not rendered at all (no DOM node, no empty space).
 *   Computed from Person capacity (hasPlayerEvidence, etc.) and viewer permissions.
 *
 * requiredPermission (reserved for future use):
 *   A permission key string (e.g. "people.view.assessments") that a viewer
 *   must hold for this tab to be shown. Do NOT put role names here.
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
  domainPermissions,
  memberships = [],
  assessments = [],
  criteria = [],
}: PersonDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("uebersicht");

  // ── Capacity resolution ────────────────────────────────────────────────────
  // PERSON-UX-07: Spieler / Trainer tab visibility is driven by explicit
  // capacity flags. Membership evidence is used as a secondary signal for the
  // Sport & Entwicklung cross-view tab and for content within the Spieler/Trainer tabs.
  const capacities = resolvePersonCapacities(
    person.squadMemberships,
    person.trainerMemberships,
  );

  // Primary capacity flags (PERSON-UX-07)
  const showSpielerTab = person.isPlayer === true;
  const showTrainerTab = person.isTrainer === true;
  // Sport & Entwicklung: visible when either capacity is active OR there is
  // any sporting membership evidence (preserves cross-role biography value).
  const showSportTab = showSpielerTab || showTrainerTab || capacities.hasSportingEvidence;

  // ── Domain permission flags ─────────────────────────────────────────────
  // Fail-closed: if domainPermissions is not provided, all sensitive tabs
  // are hidden. This matches the fail-closed design of the RPERM system.
  const canViewFinance           = domainPermissions?.canViewFinance ?? false;
  const canViewHealth            = domainPermissions?.canViewHealth ?? false;
  const canViewPrivateDocuments  = domainPermissions?.canViewPrivateDocuments ?? false;
  const canViewDevelopment       = domainPermissions?.canViewDevelopment ?? false;
  const canViewAssessments       = domainPermissions?.canViewAssessments ?? false;
  const canManageAssessments     = domainPermissions?.canManageAssessments ?? false;

  // ── Counts for badges ──────────────────────────────────────────────────────
  const activeAssignmentCount = person.assignments.filter(
    (a: PersonAssignment) => a.status === "ACTIVE",
  ).length;
  // Active squad (ACTIVE | INJURED | ABSENT) + active trainer roles
  const activeSportingRoleCount =
    person.squadMemberships.filter((m: PersonSquadMembership) =>
      (["ACTIVE", "INJURED", "ABSENT"] as string[]).includes(m.status),
    ).length +
    person.trainerMemberships.filter((m: PersonTrainerMembership) => m.status === "ACTIVE").length;

  // ── Tab registry ───────────────────────────────────────────────────────────
  // Tab visibility is determined by two orthogonal concerns:
  //   1. Person capacity (hasPlayerEvidence, hasSportingEvidence, etc.)
  //   2. Viewer domain permissions (canViewFinance, canViewHealth, etc.)
  // Both are expressed via the `hidden` flag. Structural shape is ready for
  // future permission-gating additions without a rewrite.
  const ALL_TABS: TabDefinition[] = [
    { key: "uebersicht", label: "Übersicht", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
    { key: "stammdaten", label: "Stammdaten", icon: <User className="h-3.5 w-3.5" /> },
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
      // PERSON-UX-07: tab driven by isPlayer capacity flag, not membership evidence.
      // Removing the flag hides the tab; historical data is preserved.
      hidden: !showSpielerTab,
    },
    {
      key: "trainer",
      label: "Trainer",
      icon: <UserCheck className="h-3.5 w-3.5" />,
      // PERSON-UX-07: tab driven by isTrainer capacity flag, not membership evidence.
      hidden: !showTrainerTab,
    },
    {
      key: "sport",
      label: "Sport & Entwicklung",
      icon: <Trophy className="h-3.5 w-3.5" />,
      // Cross-role season biography visible when any sporting capacity or evidence exists.
      hidden: !showSportTab,
      count: activeSportingRoleCount > 0 ? activeSportingRoleCount : undefined,
    },
    {
      key: "mitgliedschaft",
      label: "Mitgliedschaft",
      icon: <CreditCard className="h-3.5 w-3.5" />,
      // PERSON-UX-04: No longer deferred — real implementation.
    },
    {
      key: "finanzen",
      label: "Finanzen",
      icon: <DollarSign className="h-3.5 w-3.5" />,
      deferred: true,
      // Absent entirely when viewer lacks people.finance.view — no hint about existence.
      hidden: !canViewFinance,
    },
    {
      key: "gesundheit",
      label: "Gesundheit",
      icon: <HeartPulse className="h-3.5 w-3.5" />,
      deferred: true,
      // Absent entirely when viewer lacks people.health.view — no hint about existence.
      hidden: !canViewHealth,
    },
    {
      key: "dokumente",
      label: "Dokumente",
      icon: <FolderOpen className="h-3.5 w-3.5" />,
      deferred: true,
      // Absent entirely when viewer lacks people.private_documents.view — no hint about existence.
      hidden: !canViewPrivateDocuments,
    },
    { key: "zugang", label: "Zugang", icon: <KeyRound className="h-3.5 w-3.5" /> },
  ];

  // Only render visible tabs in the nav bar
  const visibleTabs = ALL_TABS.filter((t) => !t.hidden);

  // If the active tab is no longer visible (e.g. after permission change between renders),
  // fall back to Übersicht. This prevents rendering a hidden panel.
  const visibleKeys = new Set(visibleTabs.map((t) => t.key));
  const safeActiveTab: Tab = visibleKeys.has(activeTab) ? activeTab : "uebersicht";

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
            const isActive = safeActiveTab === tab.key;
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
          hidden={safeActiveTab !== "uebersicht"}
        >
          {safeActiveTab === "uebersicht" ? (
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
          hidden={safeActiveTab !== "stammdaten"}
        >
          {safeActiveTab === "stammdaten" ? (
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
          hidden={safeActiveTab !== "organisation"}
        >
          {safeActiveTab === "organisation" ? (
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

        {/* Spieler — only rendered when isPlayer capacity is active (PERSON-UX-07) */}
        {showSpielerTab ? (
          <div
            role="tabpanel"
            id="tabpanel-spieler"
            aria-labelledby="tab-spieler"
            hidden={safeActiveTab !== "spieler"}
          >
            {safeActiveTab === "spieler" ? (
              <PersonSpielerTab
                squadMemberships={person.squadMemberships}
                personId={person.id}
                canViewDevelopment={canViewDevelopment}
                canViewAssessments={canViewAssessments}
                canManageAssessments={canManageAssessments}
                assessments={assessments}
                criteria={criteria}
              />
            ) : null}
          </div>
        ) : null}

        {/* Trainer — only rendered when isTrainer capacity is active (PERSON-UX-07) */}
        {showTrainerTab ? (
          <div
            role="tabpanel"
            id="tabpanel-trainer"
            aria-labelledby="tab-trainer"
            hidden={safeActiveTab !== "trainer"}
          >
            {safeActiveTab === "trainer" ? (
              <PersonTrainerTab trainerMemberships={person.trainerMemberships} />
            ) : null}
          </div>
        ) : null}

        {/* Sport & Entwicklung — cross-role biography visible when any sporting capacity/evidence */}
        {showSportTab ? (
          <div
            role="tabpanel"
            id="tabpanel-sport"
            aria-labelledby="tab-sport"
            hidden={safeActiveTab !== "sport"}
          >
            {safeActiveTab === "sport" ? (
              <PersonSportTab
                personId={person.id}
                squadMemberships={person.squadMemberships}
                trainerMemberships={person.trainerMemberships}
                assignments={person.assignments}
                canViewDevelopment={canViewDevelopment}
                canViewAssessments={canViewAssessments}
                canManageAssessments={canManageAssessments}
                assessments={assessments}
                criteria={criteria}
              />
            ) : null}
          </div>
        ) : null}

        {/* Mitgliedschaft — PERSON-UX-04: real implementation */}
        <div
          role="tabpanel"
          id="tabpanel-mitgliedschaft"
          aria-labelledby="tab-mitgliedschaft"
          hidden={safeActiveTab !== "mitgliedschaft"}
        >
          {safeActiveTab === "mitgliedschaft" ? (
            <PersonMembershipTab
              personId={person.id}
              memberships={memberships}
              canManage={canManage}
            />
          ) : null}
        </div>

        {/* Finanzen — rendered only when viewer holds people.finance.view */}
        {canViewFinance ? (
          <div
            role="tabpanel"
            id="tabpanel-finanzen"
            aria-labelledby="tab-finanzen"
            hidden={safeActiveTab !== "finanzen"}
          >
            {safeActiveTab === "finanzen" ? (
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
        ) : null}

        {/* Gesundheit — rendered only when viewer holds people.health.view */}
        {canViewHealth ? (
          <div
            role="tabpanel"
            id="tabpanel-gesundheit"
            aria-labelledby="tab-gesundheit"
            hidden={safeActiveTab !== "gesundheit"}
          >
            {safeActiveTab === "gesundheit" ? (
              <PersonDomainPlaceholder
                icon={<HeartPulse className="h-6 w-6" />}
                title="Gesundheit"
                description="Medizinische Informationen (Erkrankungen, Allergien, Notfallkontakte)
                  werden in einem späteren Modul mit dedizierter Feinabstufung der Zugriffsrechte
                  implementiert."
                plannedFor="PERSON-UX-0x (Gesundheit)"
              />
            ) : null}
          </div>
        ) : null}

        {/* Dokumente — rendered only when viewer holds people.private_documents.view */}
        {canViewPrivateDocuments ? (
          <div
            role="tabpanel"
            id="tabpanel-dokumente"
            aria-labelledby="tab-dokumente"
            hidden={safeActiveTab !== "dokumente"}
          >
            {safeActiveTab === "dokumente" ? (
              <PersonDomainPlaceholder
                icon={<FolderOpen className="h-6 w-6" />}
                title="Persönliche Dokumente"
                description="Vereinbarungen, Formulare, Zertifikate und streng private Dokumente
                  dieser Person werden in einem späteren Modul implementiert."
                plannedFor="PERSON-UX-0x (Dokumente)"
              />
            ) : null}
          </div>
        ) : null}

        {/* Zugang */}
        <div
          role="tabpanel"
          id="tabpanel-zugang"
          aria-labelledby="tab-zugang"
          hidden={safeActiveTab !== "zugang"}
        >
          {safeActiveTab === "zugang" ? (
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
