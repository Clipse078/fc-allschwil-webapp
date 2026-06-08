"use client";

import { useEffect, useMemo, useState } from "react";

export default function AdminHeaderDateTime() {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    update();

    const interval = window.setInterval(update, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const formattedDate = useMemo(() => {
    const raw = new Intl.DateTimeFormat("de-CH", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(now);

    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }, [now]);

  const formattedTime = useMemo(() => {
    return new Intl.DateTimeFormat("de-CH", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(now);
  }, [now]);

  return (
    <div className="rounded-[24px] border border-[var(--border)] bg-white/90 px-5 py-3 shadow-sm backdrop-blur-sm">
      <p className="text-[0.9rem] font-medium tracking-tight text-[var(--muted)]">
        {formattedDate}
      </p>
      <p className="mt-1 text-[1.625rem] font-semibold leading-none tracking-tight text-[var(--foreground)]">
        {formattedTime}
      </p>
    </div>
  );
}
