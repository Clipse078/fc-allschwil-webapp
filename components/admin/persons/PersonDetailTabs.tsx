"use client";

/**
 * PERSON-UX-01 — Person Workspace tab shell.
 *
 * Expands the original 3-tab layout into a 9-section workspace:
 *   Übersicht · Stammdaten · Organisation · Sport & Entwicklung ·
 *   Mitgliedschaft · Finanzen · Gesundheit · Dokumente · Zugang
 *
 * Tabs backed by current data show live functionality.
 * Tabs for deferred domains show clean architectural placeholders.
 * No fake data is ever shown.
 *
 * Responsive: tab bar wraps on small screens; each tab content is
 * mobile-ready without relying on desktop-only layout.
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
}: PersonDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("uebersicht");

  const activeAssignmentCount = person.assignments.filter((a) => a.status === "ACTIVE").length;
  const activeSquadCount = person.squadMemberships.filter(
    (m) => m.status === "ACTIVE" || m.status === "INJURED" || m.status === "ABSENT",
  ).length;
  const activeTrainerCount = person.trainerMemberships.filter((m) => m.status === "ACTIVE").length;
  const sportCount = activeSquadCount + activeTrainerCount;

  const TABS: TabDefinition[] = [
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
    { key: "zugang", label: "Zugang", icon: <KeyRound className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-0">
      {/* Tab navigation — wraps on small screens */}
      <div className="border-b border-[var(--border)]">
        <nav
          className="-mb-px flex flex-wrap gap-0"
          aria-label="Person Workspace Tabs"
          role="tablist"
        >
          {TABS.map((tab) => {
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

      {/* Tab panels */}
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

        {/* Sport & Entwicklung */}
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
              plannedFor="PERSON-UX-02 (Mitgliedschaft)"
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
