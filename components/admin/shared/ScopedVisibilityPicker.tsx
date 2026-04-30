"use client";

import { useMemo } from "react";
import VisibilityPeoplePicker from "./VisibilityPeoplePicker";
import VisibilityRolePicker from "./VisibilityRolePicker";

export type VisibilityAudience = {
  isPublic?: boolean;
  personIds?: string[];
  roleIds?: string[];
};

type VisibilityMode = "public" | "persons" | "roles";

type Props = {
  value?: VisibilityAudience;
  onChange: (value: VisibilityAudience) => void;
};

function getMode(value?: VisibilityAudience): VisibilityMode {
  if (!value || value.isPublic !== false) return "public";
  if ((value.personIds ?? []).length > 0) return "persons";
  if ((value.roleIds ?? []).length > 0) return "roles";
  return "persons";
}

export default function ScopedVisibilityPicker({ value, onChange }: Props) {
  const audience = value ?? { isPublic: true };
  const mode = useMemo(() => getMode(audience), [audience]);

  function setPublic() {
    onChange({ isPublic: true, personIds: [], roleIds: [] });
  }

  function setPersons(personIds: string[]) {
    onChange({ isPublic: false, personIds, roleIds: [] });
  }

  function setRoles(roleIds: string[]) {
    onChange({ isPublic: false, personIds: [], roleIds });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <div className="text-sm font-semibold text-slate-950">Sichtbarkeit</div>
        <div className="mt-1 text-sm text-slate-500">
          Lege fest, wer diesen Inhalt sehen darf.
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={setPublic}
          className={[
            "rounded-xl border px-3 py-2 text-sm font-medium transition",
            mode === "public"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          Alle
        </button>

        <button
          type="button"
          onClick={() => setPersons(audience.personIds ?? [])}
          className={[
            "rounded-xl border px-3 py-2 text-sm font-medium transition",
            mode === "persons"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          Personen
        </button>

        <button
          type="button"
          onClick={() => setRoles(audience.roleIds ?? [])}
          className={[
            "rounded-xl border px-3 py-2 text-sm font-medium transition",
            mode === "roles"
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          Rollen
        </button>
      </div>

      {mode === "persons" ? (
        <VisibilityPeoplePicker
          value={audience.personIds ?? []}
          onChange={setPersons}
        />
      ) : null}

      {mode === "roles" ? (
        <VisibilityRolePicker
          value={audience.roleIds ?? []}
          onChange={setRoles}
        />
      ) : null}
    </div>
  );
}
