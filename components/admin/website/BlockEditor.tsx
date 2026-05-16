"use client";

import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, Save } from "lucide-react";
import { saveBlockVersion } from "@/app/(admin)/dashboard/website/pages/[pageId]/actions";

type Block = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  sortOrder: number;
};

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
  layout: {
    label: "Layout",
    kind: "select",
    options: ["image-left", "image-right"],
  },
  spacing: {
    label: "Abstand",
    kind: "select",
    options: ["sm", "md", "lg"],
  },
};

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
    // Unknown prop: show JSON textarea
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
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              onChange(e.target.value);
            }
          }}
        />
      </div>
    );
  }

  if (def.kind === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-[#0b4aa2]"
        />
        {def.label}
      </label>
    );
  }

  if (def.kind === "select") {
    return (
      <div>
        <label className="text-[11px] font-semibold text-slate-500">{def.label}</label>
        <select
          className={`mt-1 h-9 ${base}`}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— wählen —</option>
          {def.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (def.kind === "textarea") {
    return (
      <div>
        <label className="text-[11px] font-semibold text-slate-500">{def.label}</label>
        <textarea
          rows={3}
          className={`mt-1 resize-none py-2 ${base}`}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (def.kind === "number") {
    return (
      <div>
        <label className="text-[11px] font-semibold text-slate-500">{def.label}</label>
        <input
          type="number"
          min={1}
          className={`mt-1 h-9 ${base}`}
          value={Number(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500">{def.label}</label>
      <input
        type={def.kind === "url" ? "text" : "text"}
        className={`mt-1 h-9 ${base}`}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={def.kind === "url" ? "https://" : ""}
      />
    </div>
  );
}

function BlockSection({
  block,
  blockLabel,
  onUpdateProp,
  defaultOpen,
}: {
  block: Block;
  blockLabel: string;
  onUpdateProp: (id: string, key: string, val: unknown) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const propKeys = Object.keys(block.props).filter((k) => block.props[k] !== null);

  return (
    <div className="rounded-[18px] border border-slate-200/80 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
            {block.sortOrder}
          </span>
          <span className="text-sm font-semibold text-slate-900">{blockLabel}</span>
          <span className="text-[11px] text-slate-400">{block.type}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
          {propKeys.length === 0 ? (
            <p className="text-xs text-slate-400">
              Dieser Block hat keine editierbaren Felder.
            </p>
          ) : (
            propKeys.map((key) => (
              <PropField
                key={key}
                propKey={key}
                value={block.props[key]}
                onChange={(val) => onUpdateProp(block.id, key, val)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  pageId: string;
  initialBlocks: Block[];
  blockLabels: Record<string, string>;
  currentVersion: number;
};

export default function BlockEditor({
  pageId,
  initialBlocks,
  blockLabels,
  currentVersion,
}: Props) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [changeNote, setChangeNote] = useState("");
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateProp(blockId: string, propKey: string, value: unknown) {
    setSavedVersion(null);
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === blockId ? { ...b, props: { ...b.props, [propKey]: value } } : b,
      ),
    );
  }

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("pageId", pageId);
      fd.append("blocksJson", JSON.stringify(blocks));
      if (changeNote.trim()) fd.append("changeNote", changeNote.trim());

      const result = await saveBlockVersion(fd);
      if (result.ok) {
        setSavedVersion(result.version);
        setChangeNote("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Saved feedback */}
      {savedVersion !== null && (
        <div className="flex items-center gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <p className="text-[12px] text-emerald-800">
            Version {savedVersion} gespeichert. Status bleibt Entwurf.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12px] text-rose-800">
          {error}
        </div>
      )}

      {/* Blocks */}
      <div className="space-y-2">
        {blocks.map((block, i) => (
          <BlockSection
            key={block.id}
            block={block}
            blockLabel={blockLabels[block.type] ?? block.type}
            onUpdateProp={updateProp}
            defaultOpen={i === 0}
          />
        ))}
      </div>

      {blocks.length === 0 && (
        <p className="rounded-[14px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-400 text-center">
          Keine Blöcke in dieser Version.
        </p>
      )}

      {/* Save */}
      <div className="flex items-start gap-3 rounded-[16px] border border-slate-200/80 bg-white p-4">
        <div className="flex-1 space-y-2">
          <input
            type="text"
            placeholder="Änderungsnotiz (optional)"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            className="w-full rounded-[10px] border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0b4aa2]"
          />
          <p className="text-[11px] text-slate-400">
            Aktuell: Version {currentVersion}
            {savedVersion !== null ? ` → Version ${savedVersion} gespeichert` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex items-center gap-2 rounded-full bg-[#0b4aa2] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#08357a] disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {isPending ? "Speichern …" : "Speichern"}
        </button>
      </div>
    </div>
  );
}
