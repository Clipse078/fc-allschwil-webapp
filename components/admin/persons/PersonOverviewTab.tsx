"use client";

import { Building2, Users2, Calendar } from "lucide-react";
import type { PersonAssignment } from "@/lib/people/queries";
import type { PersonDetail } from "@/lib/people/queries";
import { getPersonFunctionLabel } from "@/lib/people/functions";
import { EmptyState } from "@/components/ui/page";

type PersonOverviewTabProps = {
  person: PersonDetail & { assignments: PersonAssignment[] };
};

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function AssignmentCard({ assignment }: { assignment: PersonAssignment }) {
  const fn = getPersonFunctionLabel(assignment.roleKey);
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--sce-accent)] text-[var(--sce-primary)]">
        {assignment.team ? (
          <Users2 className="h-4 w-4" />
        ) : (
          <Building2 className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {assignment.team?.name ?? assignment.orgUnit?.name ?? "—"}
          </span>
          <span className="inline-flex items-center rounded-full bg-[var(--sce-accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sce-primary)]">
            {fn || assignment.roleKey || "—"}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
          {assignment.team && assignment.orgUnit && (
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {assignment.orgUnit.name}
            </span>
          )}
          {assignment.season && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {assignment.season.name}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PersonOverviewTab({ person }: PersonOverviewTabProps) {
  const activeAssignments = person.assignments.filter((a) => a.status === "ACTIVE");

  // Group assignments by OrgUnit
  const byOrgUnit = activeAssignments.reduce<
    Record<string, { orgUnitName: string; assignments: PersonAssignment[] }>
  >((acc, a) => {
    const key = a.orgUnit?.id ?? "unknown";
    if (!acc[key]) {
      acc[key] = { orgUnitName: a.orgUnit?.name ?? "Unbekannt", assignments: [] };
    }
    acc[key].assignments.push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Aktuelle Zuordnungen */}
      <div>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Aktuelle Zuordnungen
        </h3>

        {activeAssignments.length === 0 ? (
          <EmptyState
            icon={<Users2 className="h-8 w-8" />}
            heading="Noch keine Zuordnung"
            description="Ordne diese Person einer Organisationseinheit oder einem Team zu."
          />
        ) : (
          <div className="space-y-6">
            {Object.entries(byOrgUnit).map(([, { orgUnitName, assignments }]) => (
              <div key={orgUnitName}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {orgUnitName}
                </p>
                <div className="space-y-2">
                  {assignments.map((a) => (
                    <AssignmentCard key={a.id} assignment={a} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {person.notes ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Notizen
          </h3>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-2)]">
              {person.notes}
            </p>
          </div>
        </div>
      ) : null}

      {/* Daten */}
      {person.dateOfBirth ? (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            Stammdaten
          </h3>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-[var(--muted)]" />
              <span className="text-[var(--muted)]">Geburtsdatum:</span>
              <span className="font-medium text-[var(--foreground)]">
                {formatDate(person.dateOfBirth)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
