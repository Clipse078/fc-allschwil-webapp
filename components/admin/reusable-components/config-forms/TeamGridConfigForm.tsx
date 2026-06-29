"use client";

/**
 * TeamGridConfigForm — CMS V4.2 Component Library
 * Team grid component config editor.
 */

import { Plus, Trash2 } from "lucide-react";

type TeamMember = {
  id: string;
  name: string;
  role: string;
  imageUrl: string;
  email: string;
  phone: string;
};

type TeamGridConfig = {
  title: string;
  description: string;
  members: TeamMember[];
  columns: number;
  showContactInfo: boolean;
  showSocialLinks: boolean;
};

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

const labelClass = "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

function newMember(): TeamMember {
  return { id: Math.random().toString(36).slice(2), name: "", role: "", imageUrl: "", email: "", phone: "" };
}

export default function TeamGridConfigForm({ config, onChange }: Props) {
  const c = config as TeamGridConfig;
  const members: TeamMember[] = Array.isArray(c.members) ? c.members : [];

  function set<K extends keyof TeamGridConfig>(key: K, value: TeamGridConfig[K]) {
    onChange({ ...config, [key]: value });
  }

  function updateMember(id: string, field: keyof TeamMember, value: string) {
    set("members", members.map((m) => m.id === id ? { ...m, [field]: value } : m));
  }

  function addMember() {
    set("members", [...members, newMember()]);
  }

  function removeMember(id: string) {
    set("members", members.filter((m) => m.id !== id));
  }

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass}>Titel</label>
        <input type="text" value={c.title} onChange={(e) => set("title", e.target.value)}
          placeholder="Unser Team" className="fca-input" />
      </div>
      <div>
        <label className={labelClass}>Beschreibung</label>
        <textarea value={c.description} onChange={(e) => set("description", e.target.value)}
          placeholder="Lernen Sie unser engagiertes Team kennen…" rows={2}
          className="fca-input resize-none" />
      </div>

      <div>
        <label className={labelClass}>Spalten ({c.columns ?? 3})</label>
        <input type="range" min={2} max={6} step={1} value={c.columns ?? 3}
          onChange={(e) => set("columns", parseInt(e.target.value))}
          className="w-full" />
        <div className="flex justify-between text-[10px] text-[var(--muted)]">
          <span>2</span><span>3</span><span>4</span><span>5</span><span>6</span>
        </div>
      </div>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={c.showContactInfo} onChange={(e) => set("showContactInfo", e.target.checked)}
            className="rounded" />
          <span className="text-sm text-[var(--text-2)]">Kontaktinfos anzeigen</span>
        </label>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelClass}>Mitglieder ({members.length})</label>
          <button type="button" onClick={addMember}
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline">
            <Plus className="h-3 w-3" /> Mitglied hinzufügen
          </button>
        </div>
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={member.name} onChange={(e) => updateMember(member.id, "name", e.target.value)}
                      placeholder="Vorname Nachname" className="fca-input text-xs" />
                    <input type="text" value={member.role} onChange={(e) => updateMember(member.id, "role", e.target.value)}
                      placeholder="Rolle / Funktion" className="fca-input text-xs" />
                  </div>
                  {c.showContactInfo && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="email" value={member.email} onChange={(e) => updateMember(member.id, "email", e.target.value)}
                        placeholder="E-Mail" className="fca-input text-xs" />
                      <input type="tel" value={member.phone} onChange={(e) => updateMember(member.id, "phone", e.target.value)}
                        placeholder="Telefon" className="fca-input text-xs" />
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => removeMember(member.id)}
                  className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {members.length === 0 && (
            <button type="button" onClick={addMember}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] py-3 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
              <Plus className="h-3.5 w-3.5" /> Erstes Mitglied hinzufügen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
