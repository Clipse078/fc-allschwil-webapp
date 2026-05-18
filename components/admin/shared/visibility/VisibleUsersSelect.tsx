"use client";

import { useState, useMemo } from "react";
import { X, ChevronDown } from "lucide-react";

export type UserOption = { id: string; name: string; email: string };

type VisibleUsersSelectProps = {
  selected: string[];
  options: UserOption[];
  onChange: (ids: string[]) => void;
};

export default function VisibleUsersSelect({
  selected,
  options,
  onChange,
}: VisibleUsersSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const available = useMemo(
    () =>
      options.filter(
        (o) =>
          !selected.includes(o.id) &&
          (query === "" ||
            o.name.toLowerCase().includes(query.toLowerCase()) ||
            o.email.toLowerCase().includes(query.toLowerCase())),
      ),
    [options, selected, query],
  );

  function addUser(id: string) {
    onChange([...selected, id]);
    setQuery("");
  }

  function removeUser(id: string) {
    onChange(selected.filter((s) => s !== id));
  }

  const selectedUsers = options.filter((o) => selected.includes(o.id));

  function initials(name: string) {
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  }

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
        Erlaubte Benutzer
      </p>
      <p className="mb-3 text-[11px] text-slate-400">
        Diese Personen können diesen Eintrag sehen, unabhängig von ihrer Rolle.
      </p>

      {selectedUsers.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {selectedUsers.map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-medium text-slate-800 shadow-sm"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[9px] font-semibold text-[#0b4aa2]">
                {initials(user.name)}
              </span>
              {user.name}
              <button
                type="button"
                onClick={() => removeUser(user.id)}
                aria-label={`${user.name} entfernen`}
                className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500 hover:border-slate-300"
        >
          <span>Person hinzufügen…</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open ? (
          <div className="absolute z-20 mt-1 w-full rounded-[16px] border border-slate-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.1)]">
            <div className="p-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name oder E-Mail…"
                autoFocus
                className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0b4aa2]/30"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto pb-2">
              {available.length === 0 ? (
                <li className="px-4 py-3 text-[12px] text-slate-400 italic">
                  Keine weiteren Personen gefunden
                </li>
              ) : (
                available.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => { addUser(user.id); setOpen(false); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0b4aa2]/10 text-[10px] font-semibold text-[#0b4aa2]">
                        {initials(user.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="truncate text-[11px] text-slate-500">{user.email}</p>
                      </div>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
