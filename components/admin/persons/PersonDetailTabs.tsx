"use client";

/**
 * PERSON-UX-01 — Person Workspace tab shell.
 * PERSON-UX-03 — Domain-permission-aware tab visibility.
 *
 * Expands the original 3-tab layout into a workspace with up to 9 sections:
 *   Übersicht · Stammdaten · Organisation · Sport & Entwicklung ·
 *   Mitgliedschaft · Finanzen · Gesundheit · Dokumente · Zugang
 *
 * Authorization model (PERSON-UX-03):
 *   Sensitive domain tabs are only rendered when the viewer holds the
 *   corresponding domain permission. If the permission is absent the tab is
 *   completely absent — no locked state, no "access denied" placeholder, no
 *   hint about the domain's existence.
 *
 *   Tab → required permission:
 *     Finanzen    → people.finance.view
 *     Gesundheit  → people.health.view
 *     Dokumente   → people.private_documents.view
 *
 *   Sport & Entwicklung is always shown (non-sensitive sporting history), but
 *   the development/assessment section within is gated by people.development.view.
 *
 *   Mitgliedschaft has no dedicated sensitive-domain permission in this slice;
 *   it remains an always-visible deferred placeholder.
 *
 * Permission flags are computed server-side by resolvePersonDomainPermissions()
 * and passed here as `domainPermissions`. The client component performs no
 * additional authorization — it only uses the pre-resolved booleans.
 *
 * Responsive: tab bar wraps on small screens; each tab content is mobile-ready.
 */

import { useState } from "react";
import {
  LayoutDashboard,
  User,
  Building2,
  Trophy,
  CreditCard,
  DollarSign,
  HeartPulse,
  FolderOpen,
  KeyRound,
} from "lucide-react";
import type { PersonAssignment, PersonDetail, PersonSquadMembership, PersonTrainerMembership } from "@/lib/people/queries";
import type { PersonAccessRole, PersonAccessLinkedUser } from "./PersonAccessRolesCard";
import type { PersonDomainPermissions } from "@/lib/people/person-domain-auth";
import PersonWorkspaceOverviewTab from "./PersonWorkspaceOverviewTab";
import PersonAssignmentsTab from "./PersonAssignmentsTab";
import PersonContactTab from "./PersonContactTab";
import PersonSportTab from "./PersonSportTab";
import PersonZugangTab from "./PersonZugangTab";
import PersonDomainPlaceholder from "./PersonDomainPlaceholder";

type Tab =
  | "uebersicht"
  | "stammdaten"
  | "organisation"
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
  /**
   * Sensitive domain access flags resolved server-side.
   * Determines which domain tabs are rendered for this viewer.
   * Defaults to all-denied when absent (fail-closed).
   */
  domainPermissions?: PersonDomainPermissions;
};

type TabDefinition = {
  key: Tab;
  label: string;
  icon: React.ReactNode;
  count?: number;
  /** When true, shows a small indicator that the tab is deferred (not yet implemented) */
  deferred?: boolean;
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
}: PersonDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("uebersicht");

  const activeAssignmentCount = person.assignments.filter((a) => a.status === "ACTIVE").length;
  const activeSquadCount = person.squadMemberships.filter(
    (m) => m.status === "ACTIVE" || m.status === "INJURED" || m.status === "ABSENT",
  ).length;
  const activeTrainerCount = person.trainerMemberships.filter((m) => m.status === "ACTIVE").length;
  const sportCount = activeSquadCount + activeTrainerCount;

  // ── Domain permission flags ─────────────────────────────────────────────
  // Fail-closed: if domainPermissions is not provided, all sensitive tabs
  // are hidden. This matches the fail-closed design of the RPERM system.
  const canViewFinance           = domainPermissions?.canViewFinance ?? false;
  const canViewHealth            = domainPermissions?.canViewHealth ?? false;
  const canViewPrivateDocuments  = domainPermissions?.canViewPrivateDocuments ?? false;
  const canViewDevelopment       = domainPermissions?.canViewDevelopment ?? false;

  // ── Tab definitions ─────────────────────────────────────────────────────
  // Sensitive tabs are only included when the viewer holds the domain permission.
  // Absent = no tab, no locked state, no existence hint for the domain.
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
      key: "sport",
      label: "Sport & Entwicklung",
      icon: <Trophy className="h-3.5 w-3.5" />,
      count: sportCount,
    },
    {
      key: "mitgliedschaft",
      label: "Mitgliedschaft",
      icon: <CreditCard className="h-3.5 w-3.5" />,
      deferred: true,
    },
    // Sensitive domain tabs — only rendered when viewer holds the domain permission.
    ...(canViewFinance ? [{
      key: "finanzen" as Tab,
      label: "Finanzen",
      icon: <DollarSign className="h-3.5 w-3.5" />,
      deferred: true,
    }] : []),
    ...(canViewHealth ? [{
      key: "gesundheit" as Tab,
      label: "Gesundheit",
      icon: <HeartPulse className="h-3.5 w-3.5" />,
      deferred: true,
    }] : []),
    ...(canViewPrivateDocuments ? [{
      key: "dokumente" as Tab,
      label: "Dokumente",
      icon: <FolderOpen className="h-3.5 w-3.5" />,
      deferred: true,
    }] : []),
    { key: "zugang", label: "Zugang", icon: <KeyRound className="h-3.5 w-3.5" /> },
  ];

  // If the active tab is no longer visible (e.g. after permission change between renders),
  // fall back to Übersicht. This prevents rendering a hidden panel.
  const visibleKeys = new Set(ALL_TABS.map((t) => t.key));
  const safeActiveTab: Tab = visibleKeys.has(activeTab) ? activeTab : "uebersicht";

  return (
    <div className="space-y-0">
      {/* Tab navigation — wraps on small screens */}
      <div className="border-b border-[var(--border)]">
        <nav
          className="-mb-px flex flex-wrap gap-0"
          aria-label="Person Workspace Tabs"
          role="tablist"
        >
          {ALL_TABS.map((tab) => {
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

      {/* Tab panels */}
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

        {/* Sport & Entwicklung */}
        <div
          role="tabpanel"
          id="tabpanel-sport"
          aria-labelledby="tab-sport"
          hidden={safeActiveTab !== "sport"}
        >
          {safeActiveTab === "sport" ? (
            <PersonSportTab
              squadMemberships={person.squadMemberships}
              trainerMemberships={person.trainerMemberships}
              assignments={person.assignments}
              canViewDevelopment={canViewDevelopment}
            />
          ) : null}
        </div>

        {/* Mitgliedschaft — deferred, no dedicated sensitive-domain permission in this slice */}
        <div
          role="tabpanel"
          id="tabpanel-mitgliedschaft"
          aria-labelledby="tab-mitgliedschaft"
          hidden={safeActiveTab !== "mitgliedschaft"}
        >
          {safeActiveTab === "mitgliedschaft" ? (
            <PersonDomainPlaceholder
              icon={<CreditCard className="h-6 w-6" />}
              title="Mitgliedschaft"
              description="Mitgliedschaftslebenszyklus, -typ, Eintrittsdatum, Austrittsdatum und
                Mitgliedschaftshistorie werden in einem späteren Modul implementiert."
              plannedFor="PERSON-UX-02 (Mitgliedschaft)"
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
