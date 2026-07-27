"use client";

/**
 * CompetitionsTable
 *
 * Client-side table listing canonical Competition records.
 * Supports inline archive / restore actions.
 *
 * German UI as required.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Archive, RotateCcw, Edit2 } from "lucide-react";
import type { CompetitionListItem } from "@/lib/competitions/dto";
import { SectionCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/Badge";
import CompetitionEditDialog from "./CompetitionEditDialog";

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
  canManage?: boolean;
};

export default function CompetitionsTable({ competitions, canManage = false }: Props) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<CompetitionListItem | null>(null);

  async function handleArchive(id: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/competitions/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRestore(id: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/competitions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false }),
      });
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  }

  if (competitions.length === 0) {
    return null;
  }

  return (
    <>
    {editTarget && (
      <CompetitionEditDialog
        competition={editTarget}
        open={true}
        onClose={() => setEditTarget(null)}
      />
    )}
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
              {canManage && (
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">
                  Aktionen
                </th>
              )}
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

                {/* Aktionen */}
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        title="Bearbeiten"
                        onClick={() => setEditTarget(competition)}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {competition.isArchived ? (
                        <button
                          type="button"
                          title="Wiederherstellen"
                          disabled={actionLoading === competition.id}
                          onClick={() => handleRestore(competition.id)}
                          className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-40"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          title="Archivieren"
                          disabled={actionLoading === competition.id}
                          onClick={() => handleArchive(competition.id)}
                          className="rounded p-1 text-gray-400 hover:bg-amber-50 hover:text-amber-600 transition-colors disabled:opacity-40"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
    </>
  );
}
