"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { useState } from "react";

type InviteAcceptFormProps = {
  token: string;
};

export default function InviteAcceptForm({ token }: InviteAcceptFormProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    if (password !== confirmPassword) {
      setError("Die Passwörter stimmen nicht überein.");
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Einladung konnte nicht angenommen werden.");
      }

      setMessage(data?.message ?? "Einladung erfolgreich angenommen.");
      setPassword("");
      setConfirmPassword("");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#eef3ff] via-white to-[#f7f9fc] text-[#1f2937]">
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px] rounded-[14px] border border-slate-200 bg-white/95 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.10)] backdrop-blur">
          <div className="mb-8 flex items-center justify-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#4f67e8] text-white shadow-[0_8px_20px_rgba(79,103,232,0.25)]">
              <Shield className="h-5 w-5" />
            </div>
            <span className="text-[18px] font-semibold tracking-tight text-[#4f67e8]">
              FC Allschwil
            </span>
          </div>

          <div className="mb-7 text-center">
            <h1 className="text-[18px] font-semibold text-[#1f2937]">Einladung annehmen</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Bitte setze jetzt dein persönliches Passwort, um den Zugang zum Clubmanager zu aktivieren.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[#374151]">Neues Passwort</span>
              <input
                type="password"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-[#4f67e8] focus:ring-2 focus:ring-[#4f67e8]/15"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-[#374151]">Passwort bestätigen</span>
              <input
                type="password"
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-[#4f67e8] focus:ring-2 focus:ring-[#4f67e8]/15"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>

            {message ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {message} <Link href="/login" className="font-semibold underline">Zum Login</Link>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-[#4f67e8] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(79,103,232,0.24)] transition hover:bg-[#4459d2] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Speichern..." : "Passwort setzen"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}