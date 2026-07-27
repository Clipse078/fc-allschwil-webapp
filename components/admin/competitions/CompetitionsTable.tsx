"use client";

/**
 * CompetitionsTable
 *
 * Server-rendered table listing canonical Competition records.
 * Supports search, provider/season filtering, and shows assigned team count.
 *
 * German UI as required.
 */

import { Trophy, Archive } from "lucide-react";
import type { CompetitionListItem } from "@/lib/competitions/dto";
import { SectionCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/Badge";

// ── Label helpers ─────────────────────────────────────────────────────────────

const COMPETITION_TYPE_LABELS: Record<string, string> = {
  LEAGUE: "Liga",
  CUP: "Cup",
  TOURNAMENT_SERIES: "Turnierserie",
  OTHER: "Sonstige",
};

const GENDER_LABELS: Record<string, string> = {
  MALE: "Herren",
  FEMALE: "Frauen",
  MIXED: "Mixed",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  competitions: CompetitionListItem[];
};

export default function CompetitionsTable({ competitions }: Props) {
  if (competitions.length === 0) {
    return null;
  }

  return (
    <SectionCard noPadding>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                Wettkampf
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                Saison
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                Provider
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                Gruppe
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                Zugeordnete Teams
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                Letzte Synchronisation
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {competitions.map((competition) => (
              <tr
                key={competition.id}
                className={competition.isArchived ? "opacity-50 bg-gray-50" : "hover:bg-gray-50"}
              >
                {/* Wettkampf */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-gray-400 shrink-0" />
                    <div>
                      <div className="font-medium text-gray-900">
                        {competition.shortName ?? competition.officialName}
                      </div>
                      {competition.shortName && (
                        <div className="text-xs text-gray-500">{competition.officialName}</div>
                      )}
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge size="sm">
                          {COMPETITION_TYPE_LABELS[competition.competitionType] ?? competition.competitionType}
                        </Badge>
                        {competition.gender && (
                          <Badge size="sm">
                            {GENDER_LABELS[competition.gender] ?? competition.gender}
                          </Badge>
                        )}
                        {competition.ageCategory && (
                          <Badge size="sm">
                            {competition.ageCategory}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </td>

                {/* Saison */}
                <td className="px-4 py-3 text-gray-700">
                  {competition.externalSeasonId ?? "—"}
                </td>

                {/* Provider */}
                <td className="px-4 py-3">
                  <Badge size="sm">
                    {competition.provider}
                  </Badge>
                </td>

                {/* Gruppe */}
                <td className="px-4 py-3 text-gray-700">
                  {competition.groupName ?? "—"}
                </td>

                {/* Zugeordnete Teams */}
                <td className="px-4 py-3 text-gray-700">
                  {competition.assignedTeamCount > 0 ? (
                    <Badge size="sm">
                      {competition.assignedTeamCount} Team{competition.assignedTeamCount !== 1 ? "s" : ""}
                    </Badge>
                  ) : (
                    <span className="text-gray-400">Keine</span>
                  )}
                </td>

                {/* Letzte Synchronisation */}
                <td className="px-4 py-3 text-gray-600 text-xs">
                  {formatDate(competition.lastSyncedAt)}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  {competition.isArchived ? (
                    <div className="flex items-center gap-1 text-gray-400">
                      <Archive className="h-3.5 w-3.5" />
                      <span className="text-xs">Archiviert</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
                      <span className="text-xs text-gray-600">Aktiv</span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
