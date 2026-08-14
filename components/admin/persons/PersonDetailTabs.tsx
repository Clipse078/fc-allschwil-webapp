"use client";

import { useState } from "react";
import type { PersonAssignment } from "@/lib/people/queries";
import type { PersonDetail } from "@/lib/people/queries";
import PersonOverviewTab from "./PersonOverviewTab";
import PersonAssignmentsTab from "./PersonAssignmentsTab";
import PersonContactTab from "./PersonContactTab";

type Tab = "uebersicht" | "zuordnungen" | "kontakt";

type PersonDetailTabsProps = {
  person: PersonDetail & { assignments: PersonAssignment[] };
  canManage: boolean;
  canDelete: boolean;
  orgUnits: Array<{ id: string; name: string }>;
  teams: Array<{ id: string; name: string; shortName?: string | null }>;
  activeSeason: { id: string; name: string } | null;
};

export default function PersonDetailTabs({
  person,
  canManage,
  canDelete,
  orgUnits,
  teams,
  activeSeason,
}: PersonDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("uebersicht");

  const TABS: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "uebersicht", label: "Übersicht" },
    {
      key: "zuordnungen",
      label: "Zuordnungen",
      count: person.assignments.filter((a) => a.status === "ACTIVE").length,
    },
    { key: "kontakt", label: "Kontaktdaten" },
  ];

  return (
    <div className="space-y-0">
      {/* Tab nav */}
      <div className="border-b border-[var(--border)]">
        <nav className="-mb-px flex gap-0" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-[var(--sce-primary)] text-[var(--sce-primary)]"
                  : "border-transparent text-[var(--text-2)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 ? (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeTab === tab.key
                      ? "bg-[var(--sce-accent)] text-[var(--sce-primary)]"
                      : "bg-[var(--surface-3)] text-[var(--muted)]"
                  }`}
                >
                  {tab.count}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="pt-6">
        {activeTab === "uebersicht" ? (
          <PersonOverviewTab person={person} />
        ) : activeTab === "zuordnungen" ? (
          <PersonAssignmentsTab
            personId={person.id}
            assignments={person.assignments}
            canManage={canManage}
            orgUnits={orgUnits}
            teams={teams}
            activeSeason={activeSeason}
          />
        ) : (
          <PersonContactTab person={person} canManage={canManage} canDelete={canDelete} />
        )}
      </div>
    </div>
  );
}
