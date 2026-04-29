"use client";

import { useEffect, useState } from "react";

type Step = {
  id: string;
  title: string;
  defaultDueDays: number;
};

export default function RegistrationWorkflowTemplateStepsEditor({ templateId }: { templateId: string }) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(3);

  async function load() {
    const res = await fetch(`/api/admin/registration-workflows/${templateId}/steps`);
    const data = await res.json();
    setSteps(data.steps || []);
  }

  useEffect(() => {
    load();
  }, [templateId]);

  async function addStep() {
    if (!title) return;

    await fetch(`/api/admin/registration-workflows/${templateId}/steps`, {
      method: "POST",
      body: JSON.stringify({
        title,
        defaultDueDays: days,
      }),
    });

    setTitle("");
    setDays(3);
    load();
  }

  return (
    <div className="mt-4 rounded-[20px] border border-slate-200 p-4">
      <div className="text-sm font-bold text-slate-900 mb-2">Workflow Schritte</div>

      <div className="space-y-2">
        {steps.map((step) => (
          <div key={step.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span>{step.title}</span>
            <span className="text-slate-500">{step.defaultDueDays} Tage</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Neuer Schritt"
          className="flex-1 rounded-lg border px-2 py-1 text-sm"
        />
        <input
          type="number"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-16 rounded-lg border px-2 py-1 text-sm"
        />
        <button
          onClick={addStep}
          className="rounded-lg bg-blue-600 px-3 py-1 text-white text-sm"
        >
          +
        </button>
      </div>
    </div>
  );
}
