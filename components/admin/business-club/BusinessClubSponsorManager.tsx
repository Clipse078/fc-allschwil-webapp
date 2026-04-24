"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type SponsorTier = "MAIN" | "GOLD" | "SILVER" | "BRONZE" | "PARTNER";

type Sponsor = {
  id: string;
  displayName: string;
  companyName: string | null;
  tier: SponsorTier;
  active: boolean;
  infoboardVisible: boolean;
  infoboardWeight: number;
  infoboardSortOrder: number;
  remarks: string | null;
  logoUrl: string | null;
};

type BusinessClubSponsorManagerProps = {
  sponsors: Sponsor[];
};

const tiers: { value: SponsorTier; label: string }[] = [
  { value: "MAIN", label: "Hauptsponsor" },
  { value: "GOLD", label: "Gold" },
  { value: "SILVER", label: "Silber" },
  { value: "BRONZE", label: "Bronze" },
  { value: "PARTNER", label: "Partner" },
];

function tierLabel(value: SponsorTier) {
  return tiers.find((tier) => tier.value === value)?.label ?? "Partner";
}

export default function BusinessClubSponsorManager({ sponsors }: BusinessClubSponsorManagerProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newTier, setNewTier] = useState<SponsorTier>("PARTNER");
  const [error, setError] = useState<string | null>(null);

  async function patchSponsor(id: string, body: Record<string, unknown>) {
    setPendingId(id);
    setError(null);

    const response = await fetch(`/api/business-club/sponsors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setPendingId(null);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Sponsor konnte nicht gespeichert werden.");
      return;
    }

    router.refresh();
  }

  async function uploadLogo(id: string, file: File | null) {
    if (!file) return;

    setPendingId(id);
    setError(null);

    const formData = new FormData();
    formData.append("logo", file);

    const response = await fetch(`/api/business-club/sponsors/${id}/logo`, {
      method: "POST",
      body: formData,
    });

    setPendingId(null);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Logo konnte nicht hochgeladen werden.");
      return;
    }

    router.refresh();
  }

  async function createSponsor() {
    if (!newName.trim()) {
      setError("Sponsorname fehlt.");
      return;
    }

    setPendingId("new");
    setError(null);

    const response = await fetch("/api/business-club/sponsors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: newName,
        companyName: newCompany,
        tier: newTier,
        infoboardVisible: true,
        infoboardWeight: 1,
      }),
    });

    setPendingId(null);

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error ?? "Sponsor konnte nicht erstellt werden.");
      return;
    }

    setNewName("");
    setNewCompany("");
    setNewTier("PARTNER");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Sponsor Anzeigename
            </label>
            <input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="z.B. Muster AG"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            />
          </div>

          <div className="flex-1">
            <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Firma / Zusatz
            </label>
            <input
              value={newCompany}
              onChange={(event) => setNewCompany(event.target.value)}
              placeholder="optional"
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              Stufe
            </label>
            <select
              value={newTier}
              onChange={(event) => setNewTier(event.target.value as SponsorTier)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400"
            >
              {tiers.map((tier) => (
                <option key={tier.value} value={tier.value}>
                  {tier.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={createSponsor}
            disabled={pendingId === "new"}
            className="rounded-full bg-[#0b4aa2] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#083a7d] disabled:opacity-50"
          >
            Sponsor hinzufügen
          </button>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </p>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
            Business Club
          </p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-tight text-[#0b4aa2]">
            Sponsoren & Infoboard
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Steuere hier, welche Sponsoren im Infoboard-Screensaver erscheinen.
          </p>
        </div>

        {sponsors.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {sponsors.map((sponsor) => (
              <div key={sponsor.id} className="grid gap-4 px-6 py-5 lg:grid-cols-[1.4fr_0.75fr_0.65fr_0.75fr_1fr_0.65fr] lg:items-center">
                <div>
                  <p className="text-lg font-black text-slate-950">{sponsor.displayName}</p>
                  <p className="text-sm font-semibold text-slate-500">
                    {sponsor.companyName ?? "Kein Firmenzusatz"} · {tierLabel(sponsor.tier)}
                  </p>
                  {sponsor.logoUrl ? (
                    <p className="mt-1 text-xs font-bold text-emerald-600">Logo hinterlegt</p>
                  ) : (
                    <p className="mt-1 text-xs font-bold text-slate-400">Noch kein Logo</p>
                  )}
                </div>

                <select
                  value={sponsor.tier}
                  disabled={pendingId === sponsor.id}
                  onChange={(event) => patchSponsor(sponsor.id, { tier: event.target.value })}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400"
                >
                  {tiers.map((tier) => (
                    <option key={tier.value} value={tier.value}>
                      {tier.label}
                    </option>
                  ))}
                </select>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
                  Aktiv
                  <input
                    type="checkbox"
                    checked={sponsor.active}
                    disabled={pendingId === sponsor.id}
                    onChange={(event) => patchSponsor(sponsor.id, { active: event.target.checked })}
                    className="h-5 w-5"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">
                  Infoboard
                  <input
                    type="checkbox"
                    checked={sponsor.infoboardVisible}
                    disabled={pendingId === sponsor.id}
                    onChange={(event) =>
                      patchSponsor(sponsor.id, { infoboardVisible: event.target.checked })
                    }
                    className="h-5 w-5"
                  />
                </label>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Logo
                  </label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    disabled={pendingId === sponsor.id}
                    onChange={(event) => uploadLogo(sponsor.id, event.target.files?.[0] ?? null)}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-black file:text-slate-700"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                    Gewichtung
                  </label>
                  <select
                    value={sponsor.infoboardWeight}
                    disabled={pendingId === sponsor.id}
                    onChange={(event) =>
                      patchSponsor(sponsor.id, { infoboardWeight: Number(event.target.value) })
                    }
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold outline-none focus:border-blue-400"
                  >
                    {[1, 2, 3, 4, 5].map((weight) => (
                      <option key={weight} value={weight}>
                        {weight}x
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-lg font-black text-slate-900">Noch keine Sponsoren erfasst</p>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Erstelle den ersten Sponsor und aktiviere ihn direkt für das Infoboard.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

