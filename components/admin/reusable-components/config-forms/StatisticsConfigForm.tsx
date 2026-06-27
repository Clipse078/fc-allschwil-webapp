"use client";

import { Plus, Trash2 } from "lucide-react";

type StatItem = {
  label: string;
  value: string;
  icon: string;
  colourPreset: string;
};

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

const COLOUR_PRESETS = [
  { value: "default", label: "Standard" },
  { value: "primary", label: "Vereinsfarbe" },
  { value: "green", label: "Grün" },
  { value: "blue", label: "Blau" },
  { value: "amber", label: "Amber" },
  { value: "red", label: "Rot" },
];

export default function StatisticsConfigForm({ config, onChange }: Props) {
  const items: StatItem[] = Array.isArray(config.items)
    ? (config.items as StatItem[])
    : [];

  function updateItems(newItems: StatItem[]) {
    onChange({ ...config, items: newItems });
  }

  function addItem() {
    updateItems([...items, { label: "", value: "", icon: "", colourPreset: "default" }]);
  }

  function removeItem(index: number) {
    updateItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, key: keyof StatItem, value: string) {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [key]: value } : item,
    );
    updateItems(updated);
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-sm text-[var(--muted)]">Noch keine Statistiken.</p>
      )}

      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--muted)]">Kennzahl {i + 1}</span>
            <button
              onClick={() => removeItem(i)}
              className="rounded p-1 text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Label</label>
              <input
                type="text"
                value={item.label}
                onChange={(e) => updateItem(i, "label", e.target.value)}
                placeholder="Mitglieder"
                className="fca-input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Wert</label>
              <input
                type="text"
                value={item.value}
                onChange={(e) => updateItem(i, "value", e.target.value)}
                placeholder="1 200+"
                className="fca-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Icon (Lucide-Name)</label>
              <input
                type="text"
                value={item.icon}
                onChange={(e) => updateItem(i, "icon", e.target.value)}
                placeholder="Users"
                className="fca-input"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">Farbe</label>
              <select
                value={item.colourPreset}
                onChange={(e) => updateItem(i, "colourPreset", e.target.value)}
                className="fca-input"
              >
                {COLOUR_PRESETS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addItem}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--tenant-primary)] hover:text-[var(--tenant-primary)] transition-colors"
      >
        <Plus className="h-4 w-4" />
        Kennzahl hinzufügen
      </button>
    </div>
  );
}
