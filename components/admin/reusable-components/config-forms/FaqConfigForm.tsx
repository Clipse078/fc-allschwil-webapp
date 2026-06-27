"use client";

import { Plus, Trash2, GripVertical } from "lucide-react";

type FaqItem = { question: string; answer: string };

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

export default function FaqConfigForm({ config, onChange }: Props) {
  const items: FaqItem[] = Array.isArray(config.items)
    ? (config.items as FaqItem[])
    : [];

  function updateItems(newItems: FaqItem[]) {
    onChange({ ...config, items: newItems });
  }

  function addItem() {
    updateItems([...items, { question: "", answer: "" }]);
  }

  function removeItem(index: number) {
    updateItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, key: keyof FaqItem, value: string) {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [key]: value } : item,
    );
    updateItems(updated);
  }

  function moveItem(index: number, direction: "up" | "down") {
    const newItems = [...items];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newItems.length) return;
    [newItems[index], newItems[target]] = [newItems[target], newItems[index]];
    updateItems(newItems);
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-sm text-[var(--muted)]">Noch keine FAQ-Einträge.</p>
      )}

      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]">
              <GripVertical className="h-3.5 w-3.5" />
              Frage {i + 1}
            </span>
            <div className="flex items-center gap-1">
              {i > 0 && (
                <button
                  onClick={() => moveItem(i, "up")}
                  className="rounded px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  ↑
                </button>
              )}
              {i < items.length - 1 && (
                <button
                  onClick={() => moveItem(i, "down")}
                  className="rounded px-1.5 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                >
                  ↓
                </button>
              )}
              <button
                onClick={() => removeItem(i)}
                className="rounded p-1 text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <input
            type="text"
            value={item.question}
            onChange={(e) => updateItem(i, "question", e.target.value)}
            placeholder="Frage eingeben…"
            className="fca-input"
          />
          <textarea
            value={item.answer}
            onChange={(e) => updateItem(i, "answer", e.target.value)}
            rows={3}
            placeholder="Antwort eingeben…"
            className="fca-input resize-none"
          />
        </div>
      ))}

      <button
        onClick={addItem}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] hover:border-[var(--tenant-primary)] hover:text-[var(--tenant-primary)] transition-colors"
      >
        <Plus className="h-4 w-4" />
        Frage hinzufügen
      </button>
    </div>
  );
}
