"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import {
  formatPreviewMoment,
  parseInfoboardPreviewMoment,
  type InfoboardPreviewScreen,
} from "@/lib/infoboard/preview-time";
import {
  Screen1Studio,
  type Screen1StudioCardRef,
} from "@/components/infoboard/studio/Screen1Studio";
import type { Screen1StudioConfig } from "@/lib/infoboard/screen1-studio-types";

type PreviewStudioProps = {
  initialScreen: InfoboardPreviewScreen;
  initialDate: string;
  initialTime: string;
  timeZone: string;
  screen1BoardId?: string | null;
  initialStudio?: Screen1StudioConfig;
};

const STUDIO_SOURCE = "infoboard-preview-studio";
const FRAME_SOURCE = "infoboard-preview-frame";

export function PreviewStudio({
  initialScreen,
  initialDate,
  initialTime,
  timeZone,
  screen1BoardId = null,
  initialStudio,
}: PreviewStudioProps) {
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [isPending, startTransition] = useTransition();
  const [screen, setScreen] = useState(initialScreen);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [autoRotate, setAutoRotate] = useState(false);
  const [studioPages, setStudioPages] = useState<
    readonly (readonly Screen1StudioCardRef[])[]
  >([]);
  const [selectedCardKey, setSelectedCardKey] = useState<string | null>(null);
  const [studio, setStudio] = useState<Screen1StudioConfig>(
    initialStudio ?? { cardOverrides: {} },
  );

  useEffect(() => {
    if (initialStudio != null) setStudio(initialStudio);
  }, [initialStudio]);

  useEffect(() => {
    function receiveFrameState(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.source !== frameRef.current?.contentWindow
      ) {
        return;
      }
      const data = event.data as
        | {
            source?: string;
            type?: string;
            page?: number;
            pageCount?: number;
            pages?: readonly (readonly Screen1StudioCardRef[])[];
          }
        | undefined;
      if (
        data?.source !== FRAME_SOURCE ||
        data.type !== "STATE" ||
        !Number.isInteger(data.page) ||
        !Number.isInteger(data.pageCount)
      ) {
        return;
      }
      const nextCount = Math.max(1, data.pageCount ?? 1);
      setPageCount(nextCount);
      setPage(Math.min(Math.max(0, data.page ?? 0), nextCount - 1));
      if (Array.isArray(data.pages)) {
        setStudioPages(data.pages);
      }
    }
    window.addEventListener("message", receiveFrameState);
    return () => window.removeEventListener("message", receiveFrameState);
  }, []);

  function pushStudioToFrame(nextStudio: Screen1StudioConfig) {
    frameRef.current?.contentWindow?.postMessage(
      { source: STUDIO_SOURCE, type: "SET_STUDIO", studio: nextStudio },
      window.location.origin,
    );
  }

  function handleStudioChange(nextStudio: Screen1StudioConfig) {
    setStudio(nextStudio);
    pushStudioToFrame(nextStudio);
  }

  function updateUrl(
    nextScreen: InfoboardPreviewScreen,
    nextDate: string,
    nextTime: string,
  ) {
    const query = new URLSearchParams({
      screen: nextScreen,
      date: nextDate,
      time: nextTime,
    });
    startTransition(() => {
      router.replace(`/dashboard/infoboard/preview?${query.toString()}`, {
        scroll: false,
      });
    });
  }

  function applyMoment(nextDate: string, nextTime: string) {
    setDate(nextDate);
    setTime(nextTime);
    setPage(0);
    setPageCount(1);
    setSelectedCardKey(null);
    updateUrl(screen, nextDate, nextTime);
  }

  function shiftMinutes(minutes: number) {
    const current = parseInfoboardPreviewMoment(
      { screen, date, time },
      timeZone,
    ).now;
    const shifted = new Date(current.getTime() + minutes * 60_000);
    const next = formatPreviewMoment(shifted, timeZone);
    applyMoment(next.date, next.time);
  }

  function resetToNow() {
    const next = formatPreviewMoment(new Date(), timeZone);
    applyMoment(next.date, next.time);
  }

  function selectScreen(nextScreen: InfoboardPreviewScreen) {
    setScreen(nextScreen);
    setPage(0);
    setPageCount(1);
    setSelectedCardKey(null);
    updateUrl(nextScreen, date, time);
  }

  function requestPage(nextPage: number) {
    const safePage = Math.min(Math.max(0, nextPage), pageCount - 1);
    frameRef.current?.contentWindow?.postMessage(
      { source: STUDIO_SOURCE, type: "SET_PAGE", page: safePage },
      window.location.origin,
    );
  }

  const frameQuery = new URLSearchParams({
    screen,
    date,
    time,
    auto: autoRotate ? "1" : "0",
  });

  return (
    <section className="space-y-4" aria-busy={isPending}>
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm">
        <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
          Screen
          <select
            aria-label="Screen"
            value={screen}
            onChange={(event) =>
              selectScreen(event.target.value === "2" ? "2" : "1")
            }
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm font-medium text-[var(--foreground)]"
          >
            <option value="1">Screen 1</option>
            <option value="2">Screen 2</option>
          </select>
        </label>

        <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
          Datum
          <input
            aria-label="Datum"
            type="date"
            value={date}
            onChange={(event) => applyMoment(event.target.value, time)}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]"
          />
        </label>

        <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
          Zeit
          <input
            aria-label="Zeit"
            type="time"
            value={time}
            onChange={(event) => applyMoment(date, event.target.value)}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm text-[var(--foreground)]"
          />
        </label>

        <div className="flex flex-wrap gap-1.5" aria-label="Schnelle Zeitanpassung">
          {[
            [-30, "−30 min"],
            [-15, "−15 min"],
            [15, "+15 min"],
            [30, "+30 min"],
          ].map(([minutes, label]) => (
            <button
              key={minutes}
              type="button"
              onClick={() => shiftMinutes(Number(minutes))}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={resetToNow}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--sce-primary)] px-3 text-xs font-semibold text-white hover:opacity-90"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Jetzt
        </button>

        <span className="ml-auto pb-2 text-xs text-[var(--muted)]">
          {timeZone}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-xl">
          <div className="aspect-video w-full">
            <iframe
              ref={frameRef}
              key={frameQuery.toString()}
              src={`/infoboard/preview-frame?${frameQuery.toString()}`}
              title={`Infoboard Vorschau Screen ${screen}`}
              className="h-full w-full border-0"
              onLoad={() => {
                setPage(0);
                setPageCount(1);
                pushStudioToFrame(studio);
              }}
            />
          </div>
        </div>

        {screen === "1" && screen1BoardId != null && (
          <Screen1Studio
            boardId={screen1BoardId}
            initialStudio={studio}
            pages={studioPages}
            selectedKey={selectedCardKey}
            onSelectKey={setSelectedCardKey}
            onStudioChange={handleStudioChange}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Vorherige Seite"
            disabled={screen !== "1" || pageCount <= 1}
            onClick={() => requestPage((page - 1 + pageCount) % pageCount)}
            className="sce-icon-button disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-28 text-center text-sm font-semibold text-[var(--foreground)]">
            Seite {page + 1} von {pageCount}
          </span>
          <button
            type="button"
            aria-label="Nächste Seite"
            disabled={screen !== "1" || pageCount <= 1}
            onClick={() => requestPage((page + 1) % pageCount)}
            className="sce-icon-button disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-5">
          <span className="text-xs font-medium text-[var(--muted)]">
            {pageCount} {pageCount === 1 ? "Seite" : "Seiten"}
          </span>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--foreground)]">
            <input
              type="checkbox"
              checked={autoRotate}
              disabled={screen !== "1" || pageCount <= 1}
              onChange={(event) => setAutoRotate(event.target.checked)}
              className="h-4 w-4 accent-[var(--sce-primary)]"
            />
            Auto-Rotation
          </label>
        </div>
      </div>
    </section>
  );
}
