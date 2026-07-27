"use client";

/**
 * ProviderMappingTable
 *
 * Overview table for provider team mappings.
 * Shows TeamSeason, participation type, competition context,
 * provider, mapped external team, confidence, and status.
 *
 * German UI. Client Component for interactive actions.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Unlink, Edit2, ExternalLink } from "lucide-react";
import type { ProviderMappingDto } from "@/lib/provider-mapping/types";
import { SectionCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";

// ── Label helpers ─────────────────────────────────────────────────────────────

const CONFIDENCE_LABELS: Record<string, { label: string; colorClass: string }> = {
  HIGH: { label: "Hoch", colorClass: "bg-green-100 text-green-700 border-green-200" },
  MEDIUM: { label: "Mittel", colorClass: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  LOW: { label: "Niedrig", colorClass: "bg-orange-100 text-orange-700 border-orange-200" },
};

const SOURCE_LABELS: Record<string, { label: string; colorClass: string }> = {
  MANUAL: { label: "Manuell", colorClass: "bg-blue-100 text-blue-700 border-blue-200" },
  SYNC: { label: "Sync", colorClass: "bg-gray-100 text-gray-600 border-gray-200" },
};

function ConfidenceBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-gray-400 text-xs">—</span>;
  const cfg = CONFIDENCE_LABELS[level];
  if (!cfg) return <span className="text-gray-400 text-xs">{level}</span>;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.colorClass}`}
    >
      {cfg.label}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_LABELS[source] ?? { label: source, colorClass: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.colorClass}`}
    >
      {cfg.label}
    </span>
  );
}

function StatusBadge({ isMapped, isActive }: { isMapped: boolean; isActive: boolean }) {
  if (!isMapped) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
        Nicht verknüpft
      </span>
    );
  }
  if (!isActive) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600 border border-red-200">
        Inaktiv
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
      Aktiv
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  mappings: ProviderMappingDto[];
  canManage?: boolean;
};

export default function ProviderMappingTable({ mappings, canManage = false }: Props) {
  const router = useRouter();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  async function handleRemove(mappingId: string) {
    if (confirmRemove !== mappingId) {
      setConfirmRemove(mappingId);
      return;
    }
    setActionLoading(mappingId);
    setConfirmRemove(null);
    try {
      await fetch(`/api/provider-mapping/${mappingId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setActionLoading(null);
    }
  }

  if (mappings.length === 0) {
    return null;
  }

  return (
    <SectionCard noPadding>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
                TeamSeason
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
                Wettbewerb (Kontext)
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
                Anbieter
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
                Anbieter-Team
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
                Konfidenz
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
                Quelle
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider text-xs">
                Status
              </th>
              {canManage && (
                <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider text-xs">
                  Aktionen
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {mappings.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                {/* TeamSeason */}
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">
                    {m.teamSeasonDisplayName ?? m.teamName}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{m.teamName}</div>
                </td>

                {/* Competition context */}
                <td className="px-4 py-3">
                  {m.mappingCompetitionName ? (
                    <span className="text-gray-700 text-xs">{m.mappingCompetitionName}</span>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>

                {/* Provider */}
                <td className="px-4 py-3">
                  <span className="font-mono text-xs font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                    {m.provider}
                  </span>
                </td>

                {/* Provider team */}
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 text-xs">
                    {m.providerTeamName ?? `ID ${m.externalTeamId}`}
                  </div>
                  {m.providerLeagueName && (
                    <div className="text-xs text-gray-400 mt-0.5">{m.providerLeagueName}</div>
                  )}
                  <div className="text-xs text-gray-300 mt-0.5">
                    Team-ID: {m.externalTeamId} · Saison-ID: {m.externalSeasonId}
                  </div>
                </td>

                {/* Confidence */}
                <td className="px-4 py-3">
                  <ConfidenceBadge level={m.confidenceLevel} />
                </td>

                {/* Source */}
                <td className="px-4 py-3">
                  <SourceBadge source={m.mappingSource} />
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <StatusBadge
                    isMapped={m.teamSeasonId !== null}
                    isActive={m.providerIsActive}
                  />
                </td>

                {/* Actions */}
                {canManage && (
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={
                          m.teamSeasonId
                            // MAPPED: go to the TeamSeason-based mapping page, focus this mapping.
                            ? `/dashboard/teams/provider-mapping/${m.teamSeasonId}?mappingId=${m.id}`
                            // UNMAPPED: go to the mapping assignment page for this specific row.
                            : `/dashboard/teams/provider-mapping/mapping/${m.id}`
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                        title="Zuordnung bearbeiten"
                      >
                        <Edit2 className="w-3 h-3" />
                        Bearbeiten
                      </Link>
                      {m.teamSeasonId && (
                        <button
                          onClick={() => handleRemove(m.id)}
                          disabled={actionLoading === m.id}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                            confirmRemove === m.id
                              ? "bg-red-100 text-red-700 hover:bg-red-200"
                              : "text-red-500 hover:text-red-700 hover:bg-red-50"
                          }`}
                          title="Zuordnung entfernen"
                        >
                          <Unlink className="w-3 h-3" />
                          {confirmRemove === m.id ? "Bestätigen?" : "Entfernen"}
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
  );
}
