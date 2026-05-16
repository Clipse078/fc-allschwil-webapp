"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  intervalSeconds: number;
  showTimestamp: boolean;
};

export default function InfoboardAutoRefresher({ intervalSeconds, showTimestamp }: Props) {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    setLastUpdated(new Date());
    const id = setInterval(() => {
      router.refresh();
      setLastUpdated(new Date());
    }, intervalSeconds * 1_000);
    return () => clearInterval(id);
  }, [router, intervalSeconds]);

  if (!showTimestamp || !lastUpdated) return null;

  return (
    <span className="text-[10px] opacity-60">
      ↻{" "}
      {lastUpdated.toLocaleTimeString("de-CH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "UTC",
      })}
    </span>
  );
}
