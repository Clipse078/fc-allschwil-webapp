"use client";

import { useState, useCallback } from "react";
import TargetForm from "./TargetForm";
import TargetTemplateSuggestions from "./TargetTemplateSuggestions";
import type { TargetTemplate } from "@/lib/targets/templates";

type DefaultValues = {
  title?: string;
  description?: string;
  category?: string;
  status?: string;
  period?: string;
  periodLabel?: string;
  moduleKey?: string;
  sportCategory?: string;
  ageGroupHint?: string;
  startsAt?: string;
  endsAt?: string;
  metrics?: Array<{
    label: string;
    type: "PERCENTAGE" | "NUMERIC" | "CURRENCY" | "BOOLEAN";
    direction: "INCREASE" | "DECREASE" | "MAINTAIN";
    targetValue: string;
    currentValue: string;
    unit: string;
    notes: string;
  }>;
};

export default function TargetNewPageClient() {
  const [formKey, setFormKey] = useState(0);
  const [defaults, setDefaults] = useState<DefaultValues>({});
  const [appliedTemplate, setAppliedTemplate] = useState<string | null>(null);

  const handleTemplateSelect = useCallback((template: TargetTemplate) => {
    setDefaults({
      title: template.title,
      description: template.description,
      category: template.category,
      period: template.period,
      periodLabel: template.periodLabel ?? "",
      moduleKey: template.moduleKey ?? "",
      sportCategory: template.sportCategory ?? "",
      ageGroupHint: template.ageGroupHint ?? "",
      metrics: template.metrics.map((m) => ({
        label: m.label,
        type: m.type,
        direction: m.direction,
        targetValue: String(m.targetValue),
        currentValue: "0",
        unit: m.unit ?? "",
        notes: m.notes ?? "",
      })),
    });
    setAppliedTemplate(template.title);
    setFormKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="space-y-6">
      {appliedTemplate ? (
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-800">
          Vorlage &ldquo;{appliedTemplate}&rdquo; wurde übernommen. Du kannst alle Felder noch anpassen.
        </div>
      ) : null}

      <TargetForm key={formKey} mode="create" defaultValues={defaults} />

      <TargetTemplateSuggestions onSelect={handleTemplateSelect} />
    </div>
  );
}
