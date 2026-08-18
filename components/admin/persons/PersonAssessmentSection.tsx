"use client";

/**
 * PERSON-UX-05 — Entwicklungs-Bewertungen (Development Assessment) section.
 *
 * Replaces the assessment placeholder in PersonSportTab when the viewer
 * holds people.assessments.view. Completely absent when permission is missing.
 *
 * Sections:
 *   A) LATEST ASSESSMENT   — most recent assessment with all criterion ratings
 *   B) HISTORY             — all assessments newest first (season progression)
 *   C) CREATE ASSESSMENT   — dialog for authorized managers
 *   D) EMPTY STATE         — quiet, no fabricated scores
 *
 * Authorization invariant (enforced by parent PersonSportTab):
 *   This component is only rendered when canViewAssessments=true.
 *   The canManageAssessments flag controls create/edit actions.
 *   Server-side is authoritative — this component only uses pre-resolved flags.
 *
 * Score: integer 0–100. Derived overall = arithmetic mean (labeled as "Ø").
 * Historical snapshots: criterion names come from criterionNameSnapshot,
 * never from live criterion data.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  Plus,
  ChevronDown,
  ChevronRight,
  BarChart2,
} from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/page";
import type { PersonAssessmentRecord, TenantCriterion } from "@/lib/people/queries";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function deriveOverall(ratings: Array<{ normalizedScore: number }>): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + r.normalizedScore, 0);
  return Math.round(sum / ratings.length);
}

function ScorePill({
  score,
  size = "sm",
}: {
  score: number;
  size?: "sm" | "md" | "lg";
}) {
  const color =
    score >= 75
      ? "bg-emerald-100 text-emerald-700"
      : score >= 50
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  const sizeClass =
    size === "lg"
      ? "text-xl font-bold px-3 py-1 rounded-lg"
      : size === "md"
      ? "text-sm font-semibold px-2.5 py-0.5 rounded-md"
      : "text-xs font-semibold px-2 py-0.5 rounded";
  return <span className={`inline-block ${color} ${sizeClass}`}>{score}</span>;
}

// ── Score bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color =
    pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
        aria-hidden="true"
      />
    </div>
  );
}

// ── Rating row ────────────────────────────────────────────────────────────────

function RatingRow({
  rating,
}: {
  rating: PersonAssessmentRecord["ratings"][number];
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-xs text-[var(--foreground)]">
            {rating.criterionNameSnapshot}
          </span>
          <ScorePill score={rating.normalizedScore} />
        </div>
        <ScoreBar score={rating.normalizedScore} />
        {rating.comment ? (
          <p className="mt-0.5 text-[11px] italic text-[var(--muted)]">{rating.comment}</p>
        ) : null}
      </div>
    </div>
  );
}

// ── Grouped ratings (by category snapshot) ───────────────────────────────────

function GroupedRatings({ ratings }: { ratings: PersonAssessmentRecord["ratings"] }) {
  const byCategory = new Map<string, typeof ratings>();
  for (const r of ratings) {
    const cat = r.criterionCategorySnapshot ?? "Allgemein";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(r);
  }
  const categories = Array.from(byCategory.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return (
    <div className="space-y-3">
      {categories.map(([cat, catRatings]) => (
        <div key={cat}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {cat}
          </p>
          <div className="divide-y divide-[var(--border)]">
            {catRatings.map((r) => (
              <RatingRow key={r.id} rating={r} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Assessment card ───────────────────────────────────────────────────────────

function AssessmentCard({
  assessment,
  isLatest,
  canManage,
  onEdit,
}: {
  assessment: PersonAssessmentRecord;
  isLatest: boolean;
  canManage: boolean;
  onEdit: (a: PersonAssessmentRecord) => void;
}) {
  const [open, setOpen] = useState(isLatest);
  const overall = deriveOverall(assessment.ratings);

  return (
    <div
      className={`overflow-hidden rounded-xl border ${
        isLatest
          ? "border-[var(--sce-primary)] bg-[var(--sce-accent)]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[var(--surface-2)]"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <TrendingUp
            className={`h-4 w-4 shrink-0 ${
              isLatest ? "text-[var(--sce-primary)]" : "text-[var(--muted)]"
            }`}
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                {assessment.season.name}
              </span>
              {isLatest ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Aktuell
                </span>
              ) : null}
              {assessment.teamSeason ? (
                <span className="rounded-full bg-[var(--surface-3)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                  {assessment.teamSeason.team.name}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-[var(--muted)]">
              {formatDate(assessment.assessedAt)}
              {assessment.assessor
                ? ` · ${assessment.assessor.firstName} ${assessment.assessor.lastName}`
                : null}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {overall !== null ? (
            <div className="text-right">
              <span className="text-[10px] text-[var(--muted)]">Ø</span>
              <ScorePill score={overall} size="md" />
            </div>
          ) : null}
          {open ? (
            <ChevronDown className="h-4 w-4 text-[var(--muted)]" />
          ) : (
            <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
          )}
        </div>
      </button>

      {open ? (
        <div className="border-t border-[var(--border)] px-4 py-4">
          {assessment.ratings.length > 0 ? (
            <GroupedRatings ratings={assessment.ratings} />
          ) : (
            <p className="text-xs text-[var(--muted)]">Keine Einzelbewertungen erfasst.</p>
          )}
          {assessment.notes ? (
            <div className="mt-3 rounded-lg bg-[var(--surface-2)] px-3 py-2">
              <p className="text-xs text-[var(--foreground)]">{assessment.notes}</p>
            </div>
          ) : null}
          {canManage ? (
            <div className="mt-3 flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(assessment)}
              >
                Bearbeiten
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ── History progression row ───────────────────────────────────────────────────

function HistoryRow({ assessment }: { assessment: PersonAssessmentRecord }) {
  const overall = deriveOverall(assessment.ratings);
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 text-xs text-[var(--muted)]">
        {assessment.season.name}
      </span>
      <div className="flex-1">
        {overall !== null ? (
          <ScoreBar score={overall} />
        ) : (
          <div className="h-1.5 w-full rounded-full bg-[var(--surface-3)]" />
        )}
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-semibold text-[var(--foreground)]">
        {overall !== null ? overall : "—"}
      </span>
    </div>
  );
}

// ── Create/Edit form ──────────────────────────────────────────────────────────

type RatingDraft = {
  criterionId: string;
  normalizedScore: number;
  comment: string;
};

function AssessmentForm({
  personId,
  criteria,
  initialAssessment,
  onSuccess,
  onCancel,
}: {
  personId: string;
  criteria: TenantCriterion[];
  initialAssessment?: PersonAssessmentRecord;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [seasonId, setSeasonId] = useState(initialAssessment?.seasonId ?? "");
  const [assessedAt, setAssessedAt] = useState(
    initialAssessment
      ? new Date(initialAssessment.assessedAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(initialAssessment?.notes ?? "");
  const [ratings, setRatings] = useState<RatingDraft[]>(() => {
    if (initialAssessment) {
      return initialAssessment.ratings.map((r) => ({
        criterionId: r.criterionId,
        normalizedScore: r.normalizedScore,
        comment: r.comment ?? "",
      }));
    }
    return criteria.map((c) => ({
      criterionId: c.id,
      normalizedScore: 50,
      comment: "",
    }));
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!initialAssessment;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const url = isEdit
        ? `/api/people/${personId}/assessments/${initialAssessment!.id}`
        : `/api/people/${personId}/assessments`;
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { assessedAt, notes: notes || null, ratings }
        : { seasonId, assessedAt, notes: notes || null, ratings };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Unbekannter Fehler.");
        return;
      }
      onSuccess();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSubmitting(false);
    }
  }

  function updateRating(criterionId: string, field: "normalizedScore" | "comment", value: number | string) {
    setRatings((prev) =>
      prev.map((r) =>
        r.criterionId === criterionId ? { ...r, [field]: value } : r,
      ),
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!isEdit ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
            Saison-ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={seasonId}
            onChange={(e) => setSeasonId(e.target.value)}
            placeholder="z.B. cmbxyz… (Saison-ID)"
            required
            className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--sce-primary)] focus:outline-none"
          />
        </div>
      ) : null}

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
          Bewertungsdatum <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={assessedAt}
          onChange={(e) => setAssessedAt(e.target.value)}
          required
          className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--sce-primary)] focus:outline-none"
        />
      </div>

      {ratings.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--foreground)]">
            Kriterien (0–100)
          </p>
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            {ratings.map((r) => {
              const criterion = criteria.find((c) => c.id === r.criterionId);
              const label = criterion?.name ?? r.criterionId;
              const category = criterion?.category ?? null;
              return (
                <div key={r.criterionId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {category ? (
                        <span className="text-[10px] text-[var(--muted)]">{category} · </span>
                      ) : null}
                      <span className="text-xs font-medium text-[var(--foreground)]">{label}</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={r.normalizedScore}
                      onChange={(e) => {
                        const v = Math.round(Number(e.target.value));
                        if (!isNaN(v) && v >= 0 && v <= 100) {
                          updateRating(r.criterionId, "normalizedScore", v);
                        }
                      }}
                      className="w-16 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-right text-sm font-semibold text-[var(--foreground)] focus:border-[var(--sce-primary)] focus:outline-none"
                    />
                  </div>
                  <ScoreBar score={r.normalizedScore} />
                  <input
                    type="text"
                    value={r.comment}
                    onChange={(e) => updateRating(r.criterionId, "comment", e.target.value)}
                    placeholder="Kommentar (optional)"
                    className="block w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--sce-primary)] focus:outline-none"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-xs text-[var(--muted)]">
          Keine aktiven Kriterien vorhanden. Kriterien müssen zuerst unter{" "}
          <code className="font-mono">/api/people/criteria</code> erstellt werden.
        </p>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-[var(--foreground)]">
          Allgemeine Notizen
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Freitextnotizen zur Bewertung…"
          className="block w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--sce-primary)] focus:outline-none"
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={submitting}>
          Abbrechen
        </Button>
        <Button type="submit" size="sm" disabled={submitting || ratings.length === 0}>
          {submitting ? "Speichern…" : isEdit ? "Aktualisieren" : "Bewertung erfassen"}
        </Button>
      </div>
    </form>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

type PersonAssessmentSectionProps = {
  personId: string;
  assessments: PersonAssessmentRecord[];
  criteria: TenantCriterion[];
  /** Viewer holds people.assessments.manage. Controls create/edit actions. */
  canManage: boolean;
};

export default function PersonAssessmentSection({
  personId,
  assessments,
  criteria,
  canManage,
}: PersonAssessmentSectionProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PersonAssessmentRecord | null>(null);

  const hasAssessments = assessments.length > 0;
  const latest = hasAssessments ? assessments[0] : null;

  function handleSuccess() {
    setCreateOpen(false);
    setEditTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-[var(--sce-primary)]" />
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)]">
            Entwicklungs-Bewertungen
          </h3>
        </div>
        {canManage ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Bewertung erfassen
          </Button>
        ) : null}
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!hasAssessments ? (
        <EmptyState
          icon={<TrendingUp className="h-8 w-8" />}
          heading="Noch keine Bewertungen"
          description="Für diese Person wurden noch keine Entwicklungs-Bewertungen erfasst."
        />
      ) : null}

      {/* ── Latest assessment ────────────────────────────────────────────────── */}
      {latest ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Neueste Bewertung
          </p>
          <AssessmentCard
            assessment={latest}
            isLatest
            canManage={canManage}
            onEdit={setEditTarget}
          />
        </div>
      ) : null}

      {/* ── History ──────────────────────────────────────────────────────────── */}
      {hasAssessments && assessments.length > 1 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Verlauf (Ø-Wert, neueste zuerst)
          </p>
          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
            {assessments.map((a) => (
              <HistoryRow key={a.id} assessment={a} />
            ))}
          </div>
          {/* All historical cards below latest */}
          <div className="mt-4 space-y-3">
            {assessments.slice(1).map((a) => (
              <AssessmentCard
                key={a.id}
                assessment={a}
                isLatest={false}
                canManage={canManage}
                onEdit={setEditTarget}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Create dialog ────────────────────────────────────────────────────── */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Entwicklungs-Bewertung erfassen"
        size="lg"
      >
        <AssessmentForm
          personId={personId}
          criteria={criteria}
          onSuccess={handleSuccess}
          onCancel={() => setCreateOpen(false)}
        />
      </Dialog>

      {/* ── Edit dialog ──────────────────────────────────────────────────────── */}
      <Dialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Bewertung bearbeiten"
        size="lg"
      >
        {editTarget ? (
          <AssessmentForm
            personId={personId}
            criteria={criteria}
            initialAssessment={editTarget}
            onSuccess={handleSuccess}
            onCancel={() => setEditTarget(null)}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
