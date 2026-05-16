"use client";

import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Plus,
  Save,
  X,
} from "lucide-react";
import { saveBlockVersion } from "@/app/(admin)/dashboard/website/pages/[pageId]/actions";
import { BLOCK_CATALOG } from "@/lib/website/block-catalog";

type Block = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  sortOrder: number;
};

// ── Prop field definitions ────────────────────────────────────────────────────

type PropFieldDef = {
  label: string;
  kind: "text" | "textarea" | "url" | "number" | "checkbox" | "select" | "json";
  options?: string[];
};

const PROP_FIELDS: Record<string, PropFieldDef> = {
  title: { label: "Titel", kind: "text" },
  heading: { label: "Überschrift", kind: "text" },
  eyebrow: { label: "Eyebrow", kind: "text" },
  subtitle: { label: "Untertitel", kind: "textarea" },
  body: { label: "Text", kind: "textarea" },
  text: { label: "Text", kind: "textarea" },
  html: { label: "HTML-Inhalt", kind: "textarea" },
  ctaLabel: { label: "Button Text", kind: "text" },
  ctaHref: { label: "Button Link (URL)", kind: "url" },
  imageSrc: { label: "Bild-URL", kind: "url" },
  backgroundImage: { label: "Hintergrundbild-URL", kind: "url" },
  imageAlt: { label: "Bild-Beschreibung", kind: "text" },
  caption: { label: "Bildunterschrift", kind: "text" },
  address: { label: "Adresse", kind: "text" },
  phone: { label: "Telefon", kind: "text" },
  email: { label: "E-Mail", kind: "text" },
  mapEmbedUrl: { label: "Karten-Embed-URL", kind: "url" },
  limit: { label: "Anzahl Einträge", kind: "number" },
  showImages: { label: "Mit Bildern", kind: "checkbox" },
  showPastEvents: { label: "Vergangene Events anzeigen", kind: "checkbox" },
  showCategory: { label: "Kategorie anzeigen", kind: "checkbox" },
  linkToDetail: { label: "Link zur Detailseite", kind: "checkbox" },
  layout: { label: "Layout", kind: "select", options: ["image-left", "image-right"] },
  spacing: { label: "Abstand", kind: "select", options: ["sm", "md", "lg"] },
};

// ── PropField ─────────────────────────────────────────────────────────────────

function PropField({
  propKey,
  value,
  onChange,
}: {
  propKey: string;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const def = PROP_FIELDS[propKey];
  const base =
    "w-full rounded-[12px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10";

  if (!def) {
    return (
      <div>
        <label className="text-[11px] font-semibold text-slate-400">
          {propKey} (JSON)
        </label>
        <textarea
          rows={2}
          className={`mt-1 ${base} resize-none py-2 font-mono text-[11px]`}
          value={typeof value === "string" ? value : JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try { onChange(JSON.parse(e.target.value)); } catch { onChange(e.target.value); }
          }}
        />
      </div>
    );
  }

  if (def.kind === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="accent-[#0b4aa2]" />
        {def.label}
      </label>
    );
  }

  if (def.kind === "select") {
    return (
      <div>
        <label className="text-[11px] font-semibold text-slate-500">{def.label}</label>
        <select className={`mt-1 h-9 ${base}`} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          <option value="">— wählen —</option>
          {def.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (def.kind === "textarea") {
    return (
      <div>
        <label className="text-[11px] font-semibold text-slate-500">{def.label}</label>
        <textarea rows={3} className={`mt-1 resize-none py-2 ${base}`} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }

  if (def.kind === "number") {
    return (
      <div>
        <label className="text-[11px] font-semibold text-slate-500">{def.label}</label>
        <input type="number" min={1} className={`mt-1 h-9 ${base}`} value={Number(value ?? 0)} onChange={(e) => onChange(Number(e.target.value))} />
      </div>
    );
  }

  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500">{def.label}</label>
      <input type="text" className={`mt-1 h-9 ${base}`} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={def.kind === "url" ? "https://" : ""} />
    </div>
  );
}

// ── BlockSection ──────────────────────────────────────────────────────────────

function BlockSection({
  block,
  blockLabel,
  isFirst,
  isLast,
  defaultOpen,
  onUpdateProp,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  block: Block;
  blockLabel: string;
  isFirst: boolean;
  isLast: boolean;
  defaultOpen: boolean;
  onUpdateProp: (id: string, key: string, val: unknown) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const propKeys = Object.keys(block.props).filter((k) => block.props[k] !== null);

  return (
    <div className="rounded-[18px] border border-slate-200/80 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="flex items-center gap-1 px-3 py-2.5">
        {/* Reorder */}
        <div className="flex flex-col gap-0.5">
          <button type="button" onClick={() => onMoveUp(block.id)} disabled={isFirst} title="Nach oben"
            className="flex h-5 w-5 items-center justify-center rounded text-slate-300 hover:text-slate-600 disabled:opacity-30">
            <ArrowUp className="h-3 w-3" />
          </button>
          <button type="button" onClick={() => onMoveDown(block.id)} disabled={isLast} title="Nach unten"
            className="flex h-5 w-5 items-center justify-center rounded text-slate-300 hover:text-slate-600 disabled:opacity-30">
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>

        {/* Expand toggle */}
        <button type="button" onClick={() => setOpen(!open)} className="flex flex-1 items-center gap-2 px-1 text-left">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {block.sortOrder}
          </span>
          <span className="text-sm font-semibold text-slate-900">{blockLabel}</span>
          <span className="text-[11px] text-slate-400">{block.type}</span>
          {open ? <ChevronUp className="ml-auto h-4 w-4 text-slate-400" /> : <ChevronDown className="ml-auto h-4 w-4 text-slate-400" />}
        </button>

        {/* Remove */}
        <button type="button" onClick={() => onRemove(block.id)} title="Block entfernen"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-300 hover:border-rose-200 hover:text-rose-500">
          <X className="h-3 w-3" />
        </button>
      </div>

      {open && (
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
          {propKeys.length === 0 ? (
            <p className="text-xs text-slate-400">Kein editierbarer Inhalt.</p>
          ) : (
            propKeys.map((key) => (
              <PropField key={key} propKey={key} value={block.props[key]} onChange={(val) => onUpdateProp(block.id, key, val)} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Block picker ──────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  hero: "Hero",
  content: "Inhalt",
  media: "Medien",
  data: "Daten",
  utility: "Hilfselemente",
};

function BlockPicker({ onAdd, onClose }: { onAdd: (type: string) => void; onClose: () => void }) {
  const categories = [...new Set(BLOCK_CATALOG.map((b) => b.category))];

  return (
    <div className="rounded-[18px] border border-[#0b4aa2]/20 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">Block hinzufügen</p>
        <button type="button" onClick={onClose} className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:text-slate-600">
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-3">
        {categories.map((cat) => {
          const blocks = BLOCK_CATALOG.filter((b) => b.category === cat);
          return (
            <div key={cat}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {CATEGORY_LABELS[cat] ?? cat}
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {blocks.map((b) => (
                  <button key={b.type} type="button" onClick={() => { onAdd(b.type); onClose(); }}
                    className="flex items-start gap-2 rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-[#0b4aa2]/30 hover:bg-[#0b4aa2]/5">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-slate-800">{b.label}</p>
                      <p className="truncate text-[10px] text-slate-400">{b.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── BlockEditor ───────────────────────────────────────────────────────────────

type Props = {
  pageId: string;
  initialBlocks: Block[];
  blockLabels: Record<string, string>;
  currentVersion: number;
};

function newBlockId() {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function BlockEditor({ pageId, initialBlocks, blockLabels, currentVersion }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [showPicker, setShowPicker] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function markDirty() { setSavedVersion(null); }

  function updateProp(blockId: string, propKey: string, value: unknown) {
    markDirty();
    setBlocks((prev) => prev.map((b) => b.id === blockId ? { ...b, props: { ...b.props, [propKey]: value } } : b));
  }

  function moveBlock(blockId: string, dir: "up" | "down") {
    markDirty();
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      const newIdx = dir === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const updated = [...prev];
      [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
      return updated.map((b, i) => ({ ...b, sortOrder: i + 1 }));
    });
  }

  function removeBlock(blockId: string) {
    markDirty();
    setBlocks((prev) => prev.filter((b) => b.id !== blockId).map((b, i) => ({ ...b, sortOrder: i + 1 })));
  }

  function addBlock(type: string) {
    const def = BLOCK_CATALOG.find((b) => b.type === type);
    if (!def) return;
    markDirty();
    setBlocks((prev) => {
      const nextOrder = (prev[prev.length - 1]?.sortOrder ?? 0) + 1;
      return [
        ...prev,
        { id: newBlockId(), type, props: { ...def.defaultProps } as Record<string, unknown>, sortOrder: nextOrder },
      ];
    });
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("pageId", pageId);
      fd.append("blocksJson", JSON.stringify(blocks));
      if (changeNote.trim()) fd.append("changeNote", changeNote.trim());
      const result = await saveBlockVersion(fd);
      if (result.ok) { setSavedVersion(result.version); setChangeNote(""); }
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {/* SmartSuggestion */}
      {blocks.length === 0 && (
        <div className="flex items-start gap-2.5 rounded-[14px] border border-[#0b4aa2]/15 bg-[#0b4aa2]/5 px-4 py-3">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0b4aa2]" />
          <p className="text-[12px] text-slate-600">
            Seiten Schritt für Schritt aufbauen. Beginne mit einem Hero-Block oder einer Einleitung.
          </p>
        </div>
      )}
      {blocks.length > 0 && blocks.length <= 2 && (
        <div className="flex items-start gap-2.5 rounded-[14px] border border-[#0b4aa2]/15 bg-[#0b4aa2]/5 px-4 py-3">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0b4aa2]" />
          <p className="text-[12px] text-slate-600">
            Seiten Schritt für Schritt aufbauen. Beginne mit wenigen starken Abschnitten.
          </p>
        </div>
      )}

      {/* Saved / error feedback */}
      {savedVersion !== null && (
        <div className="flex items-center gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <p className="text-[12px] text-emerald-800">Version {savedVersion} gespeichert.</p>
        </div>
      )}
      {error && (
        <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12px] text-rose-800">
          {error}
        </div>
      )}

      {/* Block list */}
      <div className="space-y-2">
        {blocks.map((block, i) => (
          <BlockSection
            key={block.id}
            block={block}
            blockLabel={blockLabels[block.type] ?? block.type}
            isFirst={i === 0}
            isLast={i === blocks.length - 1}
            defaultOpen={i === 0 && initialBlocks.length === 0}
            onUpdateProp={updateProp}
            onMoveUp={(id) => moveBlock(id, "up")}
            onMoveDown={(id) => moveBlock(id, "down")}
            onRemove={removeBlock}
          />
        ))}
      </div>

      {/* Add block */}
      {showPicker ? (
        <BlockPicker onAdd={addBlock} onClose={() => setShowPicker(false)} />
      ) : (
        <button type="button" onClick={() => setShowPicker(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-dashed border-slate-300 py-3 text-[12px] font-semibold text-slate-400 transition hover:border-[#0b4aa2]/50 hover:text-[#0b4aa2]">
          <Plus className="h-4 w-4" />
          Block hinzufügen
        </button>
      )}

      {/* Save bar */}
      <div className="flex items-start gap-3 rounded-[16px] border border-slate-200/80 bg-white p-4">
        <div className="flex-1 space-y-2">
          <input type="text" placeholder="Änderungsnotiz (optional)" value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0b4aa2]"
          />
          <p className="text-[11px] text-slate-400">
            Aktuell: Version {currentVersion}
            {savedVersion !== null ? ` → Version ${savedVersion} gespeichert` : ""}
          </p>
        </div>
        <button type="button" onClick={handleSave} disabled={isPending}
          className="flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#08357a] disabled:opacity-50">
          <Save className="h-3.5 w-3.5" />
          {isPending ? "Speichern …" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
