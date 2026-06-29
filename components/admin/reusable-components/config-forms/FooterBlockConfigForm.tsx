"use client";

/**
 * FooterBlockConfigForm — CMS V4.2 Component Library
 * Footer block component config editor.
 */

import { Plus, Trash2 } from "lucide-react";

type FooterColumn = {
  id: string;
  heading: string;
  links: { label: string; url: string }[];
};

type FooterBlockConfig = {
  title: string;
  tagline: string;
  columns: FooterColumn[];
  showSocialLinks: boolean;
  socialLinks: { platform: string; url: string }[];
  showAddress: boolean;
  address: string;
  copyrightText: string;
};

type Props = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

const labelClass = "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

function newColumn(): FooterColumn {
  return { id: Math.random().toString(36).slice(2), heading: "", links: [] };
}

export default function FooterBlockConfigForm({ config, onChange }: Props) {
  const c = config as FooterBlockConfig;
  const columns: FooterColumn[] = Array.isArray(c.columns) ? c.columns : [];
  const socialLinks: { platform: string; url: string }[] = Array.isArray(c.socialLinks) ? c.socialLinks : [];

  function set<K extends keyof FooterBlockConfig>(key: K, value: FooterBlockConfig[K]) {
    onChange({ ...config, [key]: value });
  }

  function addColumn() {
    set("columns", [...columns, newColumn()]);
  }

  function removeColumn(id: string) {
    set("columns", columns.filter((col) => col.id !== id));
  }

  function updateColumnHeading(id: string, heading: string) {
    set("columns", columns.map((col) => col.id === id ? { ...col, heading } : col));
  }

  function addLink(colId: string) {
    set("columns", columns.map((col) =>
      col.id === colId ? { ...col, links: [...col.links, { label: "", url: "" }] } : col
    ));
  }

  function updateLink(colId: string, li: number, field: "label" | "url", value: string) {
    set("columns", columns.map((col) =>
      col.id === colId
        ? { ...col, links: col.links.map((link, i) => i === li ? { ...link, [field]: value } : link) }
        : col
    ));
  }

  function removeLink(colId: string, li: number) {
    set("columns", columns.map((col) =>
      col.id === colId ? { ...col, links: col.links.filter((_, i) => i !== li) } : col
    ));
  }

  return (
    <div className="space-y-5">
      <div>
        <label className={labelClass}>Name / Marke</label>
        <input type="text" value={c.title} onChange={(e) => set("title", e.target.value)}
          placeholder="FC Allschwil" className="fca-input" />
      </div>
      <div>
        <label className={labelClass}>Tagline</label>
        <input type="text" value={c.tagline} onChange={(e) => set("tagline", e.target.value)}
          placeholder="Ihr Fussballverein in Basel-Land" className="fca-input" />
      </div>

      {/* Footer columns */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelClass}>Spalten ({columns.length})</label>
          <button type="button" onClick={addColumn}
            className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline">
            <Plus className="h-3 w-3" /> Spalte
          </button>
        </div>
        <div className="space-y-3">
          {columns.map((col) => (
            <div key={col.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
              <div className="flex items-center gap-2 mb-2">
                <input type="text" value={col.heading} onChange={(e) => updateColumnHeading(col.id, e.target.value)}
                  placeholder="Spaltenüberschrift" className="fca-input flex-1 text-xs" />
                <button type="button" onClick={() => removeColumn(col.id)}
                  className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1.5">
                {col.links.map((link, li) => (
                  <div key={li} className="flex items-center gap-2">
                    <input type="text" value={link.label} onChange={(e) => updateLink(col.id, li, "label", e.target.value)}
                      placeholder="Linktext" className="fca-input flex-1 text-xs" />
                    <input type="text" value={link.url} onChange={(e) => updateLink(col.id, li, "url", e.target.value)}
                      placeholder="/seite" className="fca-input flex-1 font-mono text-xs" />
                    <button type="button" onClick={() => removeLink(col.id, li)}
                      className="text-[var(--muted)] hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addLink(col.id)}
                  className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
                  <Plus className="h-2.5 w-2.5" /> Link hinzufügen
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Address */}
      <div className="flex items-center gap-3">
        <button type="button" role="switch" aria-checked={c.showAddress}
          onClick={() => set("showAddress", !c.showAddress)}
          className={`relative h-5 w-9 rounded-full transition-colors ${c.showAddress ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`}>
          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${c.showAddress ? "translate-x-4.5" : "translate-x-0.5"}`} />
        </button>
        <span className="text-sm text-[var(--text-2)]">Adresse anzeigen</span>
      </div>
      {c.showAddress && (
        <div>
          <label className={labelClass}>Adresse</label>
          <textarea value={c.address} onChange={(e) => set("address", e.target.value)}
            placeholder="Musterstrasse 1\n4123 Allschwil\nSchweiz" rows={3}
            className="fca-input resize-none text-xs" />
        </div>
      )}

      {/* Copyright */}
      <div>
        <label className={labelClass}>Copyright-Text</label>
        <input type="text" value={c.copyrightText} onChange={(e) => set("copyrightText", e.target.value)}
          placeholder="© 2026 FC Allschwil. Alle Rechte vorbehalten." className="fca-input text-xs" />
      </div>
    </div>
  );
}
