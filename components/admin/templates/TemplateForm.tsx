"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { TEMPLATE_VARIABLES, renderTemplate, buildSampleContext } from "@/lib/communication/variables";

type TemplateFormProps = {
  mode: "create" | "edit";
  templateId?: string;
  defaultValues?: {
    title?: string;
    subject?: string;
    bodyMarkdown?: string;
    category?: string;
    moduleKey?: string;
    status?: string;
  };
};

const CATEGORIES = [
  { value: "GENERAL", label: "Allgemein" },
  { value: "MATCH_INVITATION", label: "Spieleinladung" },
  { value: "MEETING_FOLLOWUP", label: "Meeting Nachfass" },
  { value: "INITIATIVE_UPDATE", label: "Initiativupdate" },
  { value: "TARGET_PROGRESS", label: "Zielfortschritt" },
  { value: "TOURNAMENT_REMINDER", label: "Turniererinnerung" },
  { value: "GOVERNANCE_FOLLOWUP", label: "Governance Nachfass" },
  { value: "SPONSOR_OUTREACH", label: "Sponsorenansprache" },
  { value: "PARENT_COMMUNICATION", label: "Elterninformation" },
] as const;

const MODULE_KEYS = [
  { value: "", label: "Kein Modul" },
  { value: "events", label: "Events" },
  { value: "meetings", label: "Meetings" },
  { value: "targets", label: "Ziele" },
  { value: "initiatives", label: "Initiativen" },
] as const;

export default function TemplateForm({ mode, templateId, defaultValues }: TemplateFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultValues?.title ?? "");
  const [subject, setSubject] = useState(defaultValues?.subject ?? "");
  const [bodyMarkdown, setBodyMarkdown] = useState(defaultValues?.bodyMarkdown ?? "");
  const [category, setCategory] = useState(defaultValues?.category ?? "GENERAL");
  const [moduleKey, setModuleKey] = useState(defaultValues?.moduleKey ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null);

  const availableVars = TEMPLATE_VARIABLES.filter(
    (v) => !v.moduleKey || v.moduleKey === moduleKey,
  );

  function insertVariable(key: string) {
    setBodyMarkdown((prev) => prev + `{{${key}}}`);
  }

  function handlePreview() {
    const ctx = buildSampleContext();
    setPreview({
      subject: renderTemplate(subject, ctx),
      body: renderTemplate(bodyMarkdown, ctx),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !subject.trim() || !bodyMarkdown.trim()) {
      setError("Titel, Betreff und Inhalt sind erforderlich.");
      return;
    }
    setLoading(true);
    try {
      const url = mode === "edit" ? `/api/templates/${templateId}` : "/api/templates";
      const method = mode === "edit" ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subject, bodyMarkdown, category, moduleKey: moduleKey || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Fehler beim Speichern.");
        return;
      }
      router.push("/vereinsleitung/templates?status=saved");
      router.refresh();
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  }

  const fieldClass = "w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3f63b5]/30";
  const labelClass = "block text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-500 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700">{error}</div> : null}

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <h3 className="mb-5 text-[1.05rem] font-semibold text-slate-900">Vorlage</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelClass}>Titel *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Spieleinladung E4" className={fieldClass} required />
          </div>
          <div>
            <label className={labelClass}>Kategorie</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={fieldClass}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Modul-Kontext</label>
            <select value={moduleKey} onChange={(e) => setModuleKey(e.target.value)} className={fieldClass}>
              {MODULE_KEYS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelClass}>Betreff *</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="z.B. Einladung: {{event.title}} am {{event.date}}" className={fieldClass} required />
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[1.05rem] font-semibold text-slate-900">Inhalt (Markdown)</h3>
          <button type="button" onClick={handlePreview} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-50">
            <Sparkles className="h-3.5 w-3.5" />Vorschau
          </button>
        </div>
        <textarea value={bodyMarkdown} onChange={(e) => setBodyMarkdown(e.target.value)} rows={12} placeholder="Schreibe den Inhalt in Markdown. Verwende {{variable.key}} für dynamische Inhalte." className={`${fieldClass} font-mono text-[13px]`} required />

        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Verfügbare Variablen</p>
          <div className="flex flex-wrap gap-1.5">
            {availableVars.slice(0, 16).map((v) => (
              <button key={v.key} type="button" onClick={() => insertVariable(v.key)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-mono text-slate-600 hover:border-[#3f63b5]/30 hover:bg-[#3f63b5]/5 hover:text-[#3f63b5]"
                title={v.label}>
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
        </div>
      </section>

      {preview ? (
        <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/50 p-6">
          <h3 className="mb-4 text-[1.05rem] font-semibold text-emerald-800">Vorschau (Beispieldaten)</h3>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Betreff</p>
          <p className="mb-5 rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900">{preview.subject}</p>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Inhalt</p>
          <pre className="whitespace-pre-wrap rounded-[14px] border border-slate-200 bg-white p-4 font-sans text-sm leading-7 text-slate-800">{preview.body}</pre>
        </section>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => router.back()} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Abbrechen</button>
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-full bg-[#3f63b5] px-6 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 hover:bg-[#08357a]">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {mode === "create" ? "Vorlage erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
