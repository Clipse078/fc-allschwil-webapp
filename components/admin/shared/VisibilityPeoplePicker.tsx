"use client";

import { useEffect, useState } from "react";

type Person = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
};

type Props = {
  value: string[];
  onChange: (ids: string[]) => void;
};

function getPersonLabel(person: Person) {
  const fullName = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return fullName || person.name || "Unbekannte Person";
}

export default function VisibilityPeoplePicker({ value, onChange }: Props) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadPeople() {
      setLoading(true);

      try {
        const response = await fetch("/api/people", { cache: "no-store" });

        if (!response.ok) {
          setPeople([]);
          return;
        }

        const data = await response.json();
        setPeople(Array.isArray(data) ? data : data.people ?? []);
      } finally {
        setLoading(false);
      }
    }

    loadPeople();
  }, []);

  function togglePerson(personId: string) {
    if (value.includes(personId)) {
      onChange(value.filter((id) => id !== personId));
      return;
    }

    onChange([...value, personId]);
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-900">Personen auswählen</div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          Personen werden geladen...
        </div>
      ) : (
        <div className="max-h-56 space-y-1 overflow-auto rounded-xl border border-slate-200 bg-white p-2">
          {people.length === 0 ? (
            <div className="px-2 py-2 text-sm text-slate-500">Keine Personen gefunden.</div>
          ) : (
            people.map((person) => {
              const active = value.includes(person.id);

              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => togglePerson(person.id)}
                  className={[
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                    active
                      ? "bg-slate-900 text-white"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  <span>{getPersonLabel(person)}</span>
                  {active ? <span className="text-xs">Ausgewählt</span> : null}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
