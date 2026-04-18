"use client";

import { useEffect, useState } from "react";

type AuditLogItem = {
  id: string;
  moduleKey: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
};

function formatDateTime(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AuditLogsTable() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadLogs() {
      try {
        const response = await fetch("/api/audit-logs", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error ?? "Audit Logs konnten nicht geladen werden.");
        }

        if (!active) {
          return;
        }

        setLogs(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!active) {
          return;
        }

        setError(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadLogs();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">Lade Audit Logs...</p>;
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Noch keine Audit Logs vorhanden.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.18em] text-slate-500">
            <th className="px-6 py-4">Zeit</th>
            <th className="px-6 py-4">Benutzer</th>
            <th className="px-6 py-4">Modul</th>
            <th className="px-6 py-4">Aktion</th>
            <th className="px-6 py-4">Entity</th>
          </tr>
        </thead>

        <tbody>
          {logs.map((log) => (
            <tr
              key={log.id}
              className="border-b border-slate-100 last:border-b-0"
            >
              <td className="px-6 py-4 text-sm text-slate-600">
                {formatDateTime(log.createdAt)}
              </td>

              <td className="px-6 py-4">
                <div className="text-sm font-medium text-slate-900">
                  {log.actorName ?? "System"}
                </div>
                <div className="text-xs text-slate-500">
                  {log.actorEmail ?? "-"}
                </div>
              </td>

              <td className="px-6 py-4 text-sm text-slate-600">
                {log.moduleKey}
              </td>

              <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                {log.action}
              </td>

              <td className="px-6 py-4">
                <div className="text-sm text-slate-900">{log.entityType}</div>
                <div className="text-xs text-slate-500">{log.entityId}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}