"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  InfoboardScreen1,
  type InfoboardScreen1Props,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import { KioskViewportScaler } from "@/components/infoboard/shared/KioskViewportScaler";

const FRAME_SOURCE = "infoboard-preview-frame";
const STUDIO_SOURCE = "infoboard-preview-studio";

function notifyParent(page: number, pageCount: number) {
  window.parent.postMessage(
    { source: FRAME_SOURCE, type: "STATE", page, pageCount },
    window.location.origin,
  );
}

export function PreviewFrameScreen1({
  autoRotate,
  ...screenProps
}: InfoboardScreen1Props & { autoRotate: boolean }) {
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const reconcilePageCount = useCallback((nextCount: number) => {
    const safeCount = Math.max(1, nextCount);
    setPageCount(safeCount);
    setPage((current) => Math.min(current, safeCount - 1));
  }, []);

  useEffect(() => {
    notifyParent(page, pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    function receiveCommand(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as
        | { source?: string; type?: string; page?: number }
        | undefined;
      if (
        data?.source !== STUDIO_SOURCE ||
        data.type !== "SET_PAGE" ||
        !Number.isInteger(data.page)
      ) {
        return;
      }
      setPage(Math.min(Math.max(0, data.page ?? 0), pageCount - 1));
    }
    window.addEventListener("message", receiveCommand);
    return () => window.removeEventListener("message", receiveCommand);
  }, [pageCount]);

  return (
    <KioskViewportScaler>
      <InfoboardScreen1
        {...screenProps}
        liveClock={false}
        previewPagination={{
          activePage: page,
          autoRotate,
          onPageChange: setPage,
          onPageCountChange: reconcilePageCount,
        }}
      />
    </KioskViewportScaler>
  );
}

export function PreviewFrameStatic({ children }: { children: ReactNode }) {
  useEffect(() => {
    notifyParent(0, 1);
  }, []);
  return children;
}
