"use client";

type WochenplanRoomConflictBadgeProps = {
  count: number;
};

export default function WochenplanRoomConflictBadge({
  count,
}: WochenplanRoomConflictBadgeProps) {
  const hasConflicts = count > 0;

  return (
    <span
      className={[
        "inline-flex min-w-[1.75rem] items-center justify-center rounded-full border px-2 py-1 text-xs font-semibold transition-colors",
        hasConflicts
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      ].join(" ")}
      aria-label={
        hasConflicts
          ? count + " Garderobenkonflikte"
          : "Keine Garderobenkonflikte"
      }
      title={
        hasConflicts
          ? count + " Garderobenkonflikte"
          : "Keine Garderobenkonflikte"
      }
    >
      {count}
    </span>
  );
}
