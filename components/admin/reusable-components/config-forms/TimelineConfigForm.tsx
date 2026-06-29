"use client";

/**
 * TimelineConfigForm — CMS V4.2 Component Library
 * Timeline component config editor.
 */

import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";

type TimelineItem = {
  id: string;
  date: string;
  title: string;
  description: string;
  icon: string;
};

type TimelineConfig = {
  title: string;
  description: string;
  items: TimelineItem[];
  orientation: "vertical" | "horizontal";
  stylePreset: "default" | "minimal" | "bold";
};

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

const labelClass = "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

function newItem(): TimelineItem {
  return { id: Math.random().toString(36).slice(2), date: "", title: "", description: "", icon: "" };
}

export default function TimelineConfigForm({ config, onChange }: Props) {
  const c = config as TimelineConfig;
  const items: TimelineItem[] = Array.isArray(c.items) ? c.items : [];

  function set<K extends keyof TimelineConfig>(key: K, value: TimelineConfig[K]) {
    onChange({ ...config, [key]: value });
  }

  function updateItem(id: string, field: keyof TimelineItem, value: string) {
    set("items", items.map((item) => item.id === id ? { ...item, [field]: value } : item));
  }

  function addItem() {
    set("items", [...items, newItem()]);
  }

  function removeItem(id: string) {
    set("items", items.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass}>Titel</label>
        <input type="text" value={c.title} onChange={(e) => set("title", e.target.value)}
          placeholder="Vereinsgeschichte" className="fca-input" />
      </div>
      <div>
        <label className={labelClass}>Beschreibung</label>
        <textarea value={c.description} onChange={(e) => set("description", e.target.value)}
          placeholder="Die wichtigsten Meilensteine im Überblick…" rows={2}
          className="fca-input resize-none" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Ausrichtung</label>
          <select value={c.orientation} onChange={(e) => set("orientation", e.target.value as TimelineConfig["orientation"])}
            className="fca-input">
            <option value="vertical">Vertikal</option>
            <option value="horizontal">Horizontal</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Stil</label>
          <select value={c.stylePreset} onChange={(e) => set("stylePreset", e.target.value as TimelineConfig["stylePreset"])}
            className="fca-input">
            <option value="default">Standard</option>
            <option value="minimal">Minimal</option>
            <option value="bold">Fett</option>
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelClass}>Einträge ({items.length})</label>
          <button type="button" onClick={addItem}
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline">
            <Plus className="h-3 w-3" /> Eintrag hinzufügen
          </button>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="flex items-start gap-2">
                <GripVertical className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" value={item.date} onChange={(e) => updateItem(item.id, "date", e.target.value)}
                      placeholder="Datum (z.B. 1985)" className="fca-input text-xs" />
                    <input type="text" value={item.title} onChange={(e) => updateItem(item.id, "title", e.target.value)}
                      placeholder="Meilenstein" className="fca-input text-xs" />
                  </div>
                  <textarea value={item.description} onChange={(e) => updateItem(item.id, "description", e.target.value)}
                    placeholder="Beschreibung…" rows={2} className="fca-input resize-none text-xs" />
                </div>
                <button type="button" onClick={() => removeItem(item.id)}
                  className="mt-1 rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <button type="button" onClick={addItem}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] py-3 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]">
              <Plus className="h-3.5 w-3.5" /> Ersten Eintrag hinzufügen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
