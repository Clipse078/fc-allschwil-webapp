"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui";

type ClubProviderMapping = {
  id: string;
  provider: string;
  providerClubId: number;
  providerClubName: string | null;
  providerIsActive: boolean;
  lastSyncedAt: string | null;
};

type TeamProviderMapping = {
  id: string;
  provider: string;
  providerTeamId: number;
  providerSeasonId: number;
  providerTeamName: string | null;
  providerIsActive: boolean;
  lastSyncedAt: string | null;
};

type ProviderLinkPanelProps =
  | { resource: "club"; id: string; mappings: ClubProviderMapping[] }
  | { resource: "team"; id: string; mappings: TeamProviderMapping[] };

const fieldClass =
  "w-full rounded-[12px] border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30";
const labelClass = "block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 mb-1";

/**
 * Manual provider-identity linking form. No live provider (SFV) call is
 * made — the admin enters the provider-reported numeric id and name
 * directly. See CLUB-DIRECTORY-01 deliverable notes for why this is
 * intentionally manual in this slice.
 */
export function ProviderLinkPanel(props: ProviderLinkPanelProps) {
  const router = useRouter();
  const [provider, setProvider] = useState("SFV");
  const [providerId, setProviderId] = useState("");
  const [providerName, setProviderName] = useState("");
  const [seasonId, setSeasonId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const numericId = Number(providerId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      setError("Anbieter-ID muss eine positive Zahl sein.");
      return;
    }

    setLoading(true);
    try {
      const endpoint =
        props.resource === "club"
          ? `/api/club-directory/clubs/${props.id}/provider-link`
          : `/api/club-directory/teams/${props.id}/provider-link`;

      const body =
        props.resource === "club"
          ? { provider, providerClubId: numericId, providerClubName: providerName || null }
          : {
              provider,
              providerTeamId: numericId,
              providerTeamName: providerName || null,
              ...(seasonId ? { providerSeasonId: Number(seasonId) } : {}),
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Verknüpfung fehlgeschlagen.");
        return;
      }
      setProviderId("");
      setProviderName("");
      setSeasonId("");
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {props.mappings.length > 0 ? (
        <ul className="space-y-2">
          {props.mappings.map((mapping) => (
            <li
              key={mapping.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="info" size="sm">
                    {mapping.provider}
                  </Badge>
                  <span className="truncate text-sm font-medium text-[var(--foreground)]">
                    {"providerClubName" in mapping
                      ? mapping.providerClubName ?? `#${mapping.providerClubId}`
                      : mapping.providerTeamName ?? `#${mapping.providerTeamId}`}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  {"providerClubId" in mapping
                    ? `Anbieter-ID ${mapping.providerClubId}`
                    : `Anbieter-ID ${mapping.providerTeamId} · Saison ${mapping.providerSeasonId}`}
                  {mapping.lastSyncedAt
                    ? ` · zuletzt synchronisiert ${new Date(mapping.lastSyncedAt).toLocaleDateString("de-CH")}`
                    : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          Noch keine Anbieter-Verknüpfung. {props.resource === "club" ? "Verein" : "Team"} kann
          weiterhin ohne Anbieter verwaltet werden.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Anbieter</label>
            <select value={provider} onChange={(e) => setProvider(e.target.value)} className={fieldClass}>
              <option value="SFV">SFV</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Anbieter-ID *</label>
            <input
              type="number"
              min={1}
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              placeholder={props.resource === "club" ? "z.B. 483" : "z.B. 51234"}
              className={fieldClass}
              required
            />
          </div>
          <div className={props.resource === "team" ? "" : "sm:col-span-2"}>
            <label className={labelClass}>Anbieter-Name</label>
            <input
              type="text"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="Optional"
              className={fieldClass}
            />
          </div>
          {props.resource === "team" ? (
            <div>
              <label className={labelClass}>Saison-ID</label>
              <input
                type="number"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
                placeholder="0 = saisonlos"
                className={fieldClass}
              />
            </div>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60 hover:bg-[#08357a]"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          Verknüpfen
        </button>
      </form>
    </div>
  );
}
