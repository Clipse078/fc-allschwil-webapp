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
    { key: "mitgliedschaft", label: "Mitgliedschaft", icon: <CreditCard className="h-3.5 w-3.5" /> },
    { key: "finanzen", label: "Finanzen", icon: <DollarSign className="h-3.5 w-3.5" /> },
    { key: "gesundheit", label: "Gesundheit", icon: <HeartPulse className="h-3.5 w-3.5" /> },
    { key: "dokumente", label: "Dokumente", icon: <FolderOpen className="h-3.5 w-3.5" /> },
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
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
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
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab panel — only the active tab is mounted; inactive tabs have zero DOM presence */}
      <div
        className="pt-6"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "uebersicht" && (
          <PersonWorkspaceOverviewTab person={person} activeSeason={activeSeason} />
        )}
        {activeTab === "stammdaten" && (
          <PersonContactTab person={person} canManage={canManage} canDelete={canDelete} />
        )}
        {activeTab === "organisation" && (
          <PersonAssignmentsTab
            personId={person.id}
            assignments={person.assignments}
            canManage={canManage}
            orgUnits={orgUnits}
            teams={teams}
            activeSeason={activeSeason}
          />
        )}
        {activeTab === "sport" && (
          <PersonSportTab
            squadMemberships={person.squadMemberships}
            trainerMemberships={person.trainerMemberships}
            assignments={person.assignments}
          />
        )}
        {activeTab === "mitgliedschaft" && (
          <PersonDomainPlaceholder
            icon={<CreditCard className="h-6 w-6" />}
            title="Mitgliedschaft"
            description="Mitgliedschaftslebenszyklus, -typ, Eintrittsdatum, Austrittsdatum und Mitgliedschaftshistorie werden in einem späteren Modul implementiert."
            plannedFor="PERSON-UX-02 (Mitgliedschaft)"
          />
        )}
        {activeTab === "finanzen" && (
          <PersonDomainPlaceholder
            icon={<DollarSign className="h-6 w-6" />}
            title="Finanzen"
            description="Beitrags- und Rechnungsdaten folgen dem Pfad: Person → Mitgliedschaft → Beitragspflicht → Rechnung → Zahlung. Dieses Modul erfordert ein separates Buchhaltungssystem."
            plannedFor="PERSON-UX-0x (Finanzen)"
          />
        )}
        {activeTab === "gesundheit" && (
          <PersonDomainPlaceholder
            icon={<HeartPulse className="h-6 w-6" />}
            title="Gesundheit"
            description="Medizinische Informationen (Erkrankungen, Allergien, Notfallkontakte) werden in einem späteren Modul mit dedizierter Feinabstufung der Zugriffsrechte implementiert."
            plannedFor="PERSON-UX-0x (Gesundheit)"
            variant="restricted"
            accessNote="Kritisch: Medizinische Informationen dürfen NICHT den allgemeinen people.view-Berechtigungen erben. Sie erfordern eine dedizierte, eigenständige Autorisierung. Allgemeiner Personenzugriff gewährt keinen Zugang zu diesem Modul."
          />
        )}
        {activeTab === "dokumente" && (
          <PersonDomainPlaceholder
            icon={<FolderOpen className="h-6 w-6" />}
            title="Persönliche Dokumente"
            description="Vereinbarungen, Formulare, Zertifikate und streng private Dokumente dieser Person werden in einem späteren Modul implementiert."
            plannedFor="PERSON-UX-0x (Dokumente)"
            variant="restricted"
            accessNote="Kritisch: Persönliche Dokumente werden NICHT Bestandteil generischer Workspace-Dateien. Sie erfordern eigenständige Zugriffsrechte mit vollständiger Protokollierung (Auditierbarkeit) und werden separat von people.view autorisiert."
          />
        )}
        {activeTab === "zugang" && (
          <PersonZugangTab personId={person.id} accessRolesCard={accessRolesCard} />
        )}
      </div>
    </div>
  );
}
