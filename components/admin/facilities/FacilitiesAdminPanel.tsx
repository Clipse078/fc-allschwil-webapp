"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Pencil,
  Archive,
  ChevronDown,
  ChevronRight,
  Building2,
  MapPin,
} from "lucide-react";
import type { FacilityType, FacilityResourceType, FacilityStatus } from "@prisma/client";

// ── Types matching lib/facilities/queries.ts ─────────────────────────────────

type ResourceRow = {
  id: string;
  name: string;
  code: string;
  type: FacilityResourceType;
  status: FacilityStatus;
  sortOrder: number;
};

type FacilityRow = {
  id: string;
  name: string;
  type: FacilityType;
  status: FacilityStatus;
  sortOrder: number;
  resources: ResourceRow[];
};

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  initialFacilities: FacilityRow[];
  canManage: boolean;
  tenantId: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  PITCH: "Spielfeld",
  DRESSING_ROOM_BLOCK: "Garderobenblock",
  INDOOR_HALL: "Innenhalle",
  OTHER: "Sonstiges",
};

const RESOURCE_TYPE_LABELS: Record<FacilityResourceType, string> = {
  FULL_PITCH: "Ganzes Feld",
  HALF_PITCH: "Halbes Feld",
  DRESSING_ROOM: "Garderobe",
  OTHER: "Sonstiges",
};

const STATUS_LABELS: Record<FacilityStatus, string> = {
  ACTIVE: "Aktiv",
  INACTIVE: "Inaktiv",
  ARCHIVED: "Archiviert",
};

// ── Inline edit form component ────────────────────────────────────────────────

function InlineEditForm({
  value,
  onSave,
  onCancel,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = draft.trim();
        if (!trimmed) return;
        startTransition(() => onSave(trimmed));
      }}
      className="flex items-center gap-2"
    >
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-[var(--blue)]/40 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
      />
      <button
        type="submit"
        disabled={pending || !draft.trim()}
        className="fca-button-primary disabled:opacity-50"
      >
        Speichern
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
      >
        Abbrechen
      </button>
    </form>
  );
}

// ── Create Facility dialog ────────────────────────────────────────────────────

function CreateFacilityForm({
  onCreated,
  onCancel,
}: {
  onCreated: (facility: FacilityRow) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<FacilityType>("PITCH");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Fehler beim Erstellen.");
        return;
      }
      const data = await res.json();
      onCreated({ ...data.facility, resources: [] });
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-[var(--blue)]/20 bg-[var(--blue-light)] p-5 space-y-4"
    >
      <p className="text-sm font-semibold text-[var(--blue)]">Neue Anlage erstellen</p>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-slate-600">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Hauptplatz"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600">Typ</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FacilityType)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
          >
            {(Object.keys(FACILITY_TYPE_LABELS) as FacilityType[]).map((t) => (
              <option key={t} value={t}>
                {FACILITY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="fca-button-primary disabled:opacity-50"
        >
          {pending ? "Wird erstellt…" : "Anlage erstellen"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="fca-button-secondary"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

// ── Create Resource form ──────────────────────────────────────────────────────

function CreateResourceForm({
  facilityId,
  onCreated,
  onCancel,
}: {
  facilityId: string;
  onCreated: (resource: ResourceRow) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<FacilityResourceType>("OTHER");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/facilities/${facilityId}/resources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), code: code.trim(), type }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Fehler beim Erstellen.");
        return;
      }
      const data = await res.json();
      onCreated(data.resource);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3"
    >
      <p className="text-xs font-semibold text-slate-700">Neue Ressource hinzufügen</p>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-slate-500">Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Hauptplatz A"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="z.B. STADION_A"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono outline-none focus:ring-2 focus:ring-[var(--blue)]/20"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Typ</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FacilityResourceType)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none"
          >
            {(Object.keys(RESOURCE_TYPE_LABELS) as FacilityResourceType[]).map((t) => (
              <option key={t} value={t}>
                {RESOURCE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !name.trim() || !code.trim()}
          className="fca-button-primary disabled:opacity-50"
        >
          {pending ? "Wird hinzugefügt…" : "Hinzufügen"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="fca-button-secondary"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

// ── Resource row ──────────────────────────────────────────────────────────────

function ResourceItem({
  facilityId,
  resource,
  canManage,
  onUpdate,
}: {
  facilityId: string;
  resource: ResourceRow;
  canManage: boolean;
  onUpdate: (updated: ResourceRow) => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [, startTransition] = useTransition();

  const isArchived = resource.status === "ARCHIVED";

  async function patchResource(data: Record<string, unknown>) {
    const res = await fetch(`/api/facilities/${facilityId}/resources/${resource.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      onUpdate({ ...resource, ...data } as ResourceRow);
    }
  }

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
        isArchived
          ? "border-slate-100 bg-slate-50 opacity-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <div className="min-w-0">
          {editingName ? (
            <InlineEditForm
              value={resource.name}
              placeholder="Ressourcenname"
              onSave={(name) => {
                startTransition(async () => {
                  await patchResource({ name });
                  setEditingName(false);
                });
              }}
              onCancel={() => setEditingName(false)}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-slate-800">{resource.name}</span>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-500">
                {resource.code}
              </code>
              <span className="text-[11px] text-slate-400">
                {RESOURCE_TYPE_LABELS[resource.type]}
              </span>
            </div>
          )}
        </div>
      </div>

      {canManage && !editingName ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => setEditingName(true)}
            disabled={isArchived}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none"
            title="Name bearbeiten"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() =>
              startTransition(async () => {
                await patchResource({
                  status: isArchived ? "ACTIVE" : "ARCHIVED",
                });
              })
            }
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title={isArchived ? "Wiederherstellen" : "Archivieren"}
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ── Facility card ─────────────────────────────────────────────────────────────

function FacilityCard({
  facility,
  canManage,
  onUpdate,
}: {
  facility: FacilityRow;
  canManage: boolean;
  onUpdate: (updated: FacilityRow) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [addingResource, setAddingResource] = useState(false);
  const [, startTransition] = useTransition();

  const isArchived = facility.status === "ARCHIVED";

  async function patchFacility(data: Record<string, unknown>) {
    const res = await fetch(`/api/facilities/${facility.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      onUpdate({ ...facility, ...data } as FacilityRow);
    }
  }

  function updateResource(updated: ResourceRow) {
    onUpdate({
      ...facility,
      resources: facility.resources.map((r) => (r.id === updated.id ? updated : r)),
    });
  }

  return (
    <div
      className={`rounded-2xl border bg-white shadow-[0_4px_12px_rgba(15,23,42,0.04)] ${
        isArchived ? "opacity-60" : ""
      }`}
    >
      {/* Facility header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-slate-400 hover:text-slate-600"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <Building2 className="h-4 w-4 shrink-0 text-[var(--blue)]" />

        <div className="min-w-0 flex-1">
          {editingName ? (
            <InlineEditForm
              value={facility.name}
              placeholder="Anlagenname"
              onSave={(name) => {
                startTransition(async () => {
                  await patchFacility({ name });
                  setEditingName(false);
                });
              }}
              onCancel={() => setEditingName(false)}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.95rem] font-semibold text-slate-900">
                {facility.name}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
                {FACILITY_TYPE_LABELS[facility.type]}
              </span>
              {isArchived ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  Archiviert
                </span>
              ) : null}
              <span className="text-[11px] text-slate-400">
                {facility.resources.filter((r) => r.status !== "ARCHIVED").length} Ressource(n)
              </span>
            </div>
          )}
        </div>

        {canManage && !editingName ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setEditingName(true)}
              disabled={isArchived}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:pointer-events-none"
              title="Name bearbeiten"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() =>
                startTransition(async () => {
                  await patchFacility({
                    status: isArchived ? "ACTIVE" : "ARCHIVED",
                  });
                })
              }
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              title={isArchived ? "Wiederherstellen" : "Archivieren"}
            >
              <Archive className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      {/* Resources */}
      {expanded ? (
        <div className="border-t border-slate-100 px-5 pb-5 pt-4">
          <div className="space-y-2">
            {facility.resources.length === 0 ? (
              <p className="text-sm text-slate-400">Noch keine Ressourcen konfiguriert.</p>
            ) : (
              facility.resources.map((resource) => (
                <ResourceItem
                  key={resource.id}
                  facilityId={facility.id}
                  resource={resource}
                  canManage={canManage}
                  onUpdate={updateResource}
                />
              ))
            )}
          </div>

          {canManage && !isArchived ? (
            addingResource ? (
              <CreateResourceForm
                facilityId={facility.id}
                onCreated={(resource) => {
                  onUpdate({ ...facility, resources: [...facility.resources, resource] });
                  setAddingResource(false);
                }}
                onCancel={() => setAddingResource(false)}
              />
            ) : (
              <button
                onClick={() => setAddingResource(true)}
                className="mt-3 flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 transition hover:border-[var(--blue)]/40 hover:bg-[var(--blue-light)] hover:text-[var(--blue)]"
              >
                <Plus className="h-3.5 w-3.5" />
                Ressource hinzufügen
              </button>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function FacilitiesAdminPanel({
  initialFacilities,
  canManage,
}: Props) {
  const [facilities, setFacilities] = useState<FacilityRow[]>(initialFacilities);
  const [showCreate, setShowCreate] = useState(false);

  function updateFacility(updated: FacilityRow) {
    setFacilities((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
  }

  return (
    <div className="space-y-5">
      {/* Action bar */}
      {canManage ? (
        showCreate ? (
          <CreateFacilityForm
            onCreated={(facility) => {
              setFacilities((prev) => [...prev, facility]);
              setShowCreate(false);
            }}
            onCancel={() => setShowCreate(false)}
          />
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="fca-button-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Anlage erstellen
          </button>
        )
      ) : null}

      {/* Facility list */}
      {facilities.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <Building2 className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">
            Noch keine Anlagen konfiguriert
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Erstelle deine erste Anlage mit dem Button oben.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {facilities.map((facility) => (
            <FacilityCard
              key={facility.id}
              facility={facility}
              canManage={canManage}
              onUpdate={updateFacility}
            />
          ))}
        </div>
      )}

      {/* Info banner */}
      <div className="rounded-2xl border border-blue-100 bg-[var(--blue-light)] p-4">
        <p className="text-sm font-semibold text-[var(--blue)]">Wie funktioniert das?</p>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
          <li>
            <span className="font-medium">Anlagen</span> sind physische Standorte (Spielfeld,
            Garderobenblock, Halle).
          </li>
          <li>
            <span className="font-medium">Ressourcen</span> sind buchbare Einheiten mit einem
            stabilen Code (z.B. <code className="font-mono text-xs">STADION_A</code>).
          </li>
          <li>
            Infoboard und Wochenplanung zeigen automatisch die hier konfigurierten Bezeichnungen.
          </li>
          <li>
            Bestehende Codes werden als Fallback auf die FCA-Standardbezeichnungen aufgelöst,
            wenn keine Ressource konfiguriert ist.
          </li>
        </ul>
      </div>
    </div>
  );
}
