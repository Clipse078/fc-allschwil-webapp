"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Save } from "lucide-react";

type Qualification = {
  id: string;
  title: string;
  type: string;
  status: string;
  issuer: string | null;
  isClubVerified: boolean;
};

export default function TrainerQualificationsCard({
  personId,
  initialQualifications,
  canEdit,
}: {
  personId: string;
  initialQualifications: Qualification[];
  canEdit: boolean;
}) {
  const [items, setItems] = useState(initialQualifications);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  async function create() {
    startTransition(async () => {
      const res = await fetch(`/api/people/${personId}/trainer-qualifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, type: "DIPLOMA", status: "UNKNOWN" }),
      });

      if (res.ok) {
        const data = await res.json();
        setItems([data.qualification, ...items]);
        setTitle("");
      }
    });
  }

  async function remove(id: string) {
    startTransition(async () => {
      await fetch(`/api/people/${personId}/trainer-qualifications/${id}`, {
        method: "DELETE",
      });
      setItems(items.filter((i) => i.id !== id));
    });
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5">
      <h3 className="font-black text-slate-900">Trainer-Diplome (zentral)</h3>

      {canEdit && (
        <div className="mt-4 flex gap-2">
          <input
            className="fca-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Neues Diplom"
          />
          <button onClick={create} className="fca-button-primary">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {items.length === 0 && (
          <p className="text-sm text-slate-500">Keine Diplome vorhanden</p>
        )}

        {items.map((q) => (
          <div key={q.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
            <span className="text-sm font-semibold">{q.title}</span>
            {canEdit && (
              <button onClick={() => remove(q.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
