"use client";

import Link from "next/link";
import { useEffect } from "react";

type AdminErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

function isDatabaseConfigurationError(error: Error): boolean {
  return (
    error.message.includes("DATABASE_URL") ||
    error.message.includes("Prisma") ||
    error.message.includes("database")
  );
}

export default function AdminErrorPage({ error, reset }: AdminErrorPageProps) {
  useEffect(() => {
    console.error("[admin-runtime-error]", error);
  }, [error]);

  const isDbConfigIssue = isDatabaseConfigurationError(error);

  return (
    <div className="mx-auto max-w-3xl space-y-6 rounded-[30px] border border-amber-200 bg-white p-8 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
          Runtime warning
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">
          {isDbConfigIssue
            ? "Database configuration is currently unavailable."
            : "The admin route could not be rendered."}
        </h2>
        <p className="mt-3 text-sm text-slate-600">
          The app is still running. Start with <code>/api/health</code> to inspect
          deployment checks and missing environment variables. On Vercel, verify this
          on the canonical STAGE production deployment, not a random preview URL.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/api/health"
          className="inline-flex items-center rounded-full bg-[#3f63b5] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2f52a0]"
        >
          Open /api/health
        </Link>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
