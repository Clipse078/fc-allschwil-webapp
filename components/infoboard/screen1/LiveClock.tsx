"use client";

/**
 * components/infoboard/screen1/LiveClock.tsx
 *
 * Purely visual client component — updates the displayed time every 10 seconds.
 * Intentionally isolated so InfoboardScreen1 remains a pure server component.
 */

import type { ReactElement } from "react";
import { useState, useEffect } from "react";

type LiveClockProps = {
  className?: string;
};

export function LiveClock({ className }: LiveClockProps): ReactElement {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const update = () => {
      setTime(
        new Intl.DateTimeFormat("de-CH", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    };
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, []);

  return <span className={className}>{time}</span>;
}
