"use client";

import { useCallback, useEffect, useState } from "react";
import {
  InfoboardScreen1,
  type InfoboardScreen1Props,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import { KioskViewportScaler } from "@/components/infoboard/shared/KioskViewportScaler";
import type { Screen1StudioCardRef } from "@/components/infoboard/studio/Screen1Studio";
import type { Screen1StudioConfig } from "@/lib/infoboard/screen1-studio-types";

const FRAME_SOURCE = "infoboard-preview-frame";
const STUDIO_SOURCE = "infoboard-preview-studio";

function notifyParent(
  page: number,
  pageCount: number,
  pages: readonly (readonly Screen1StudioCardRef[])[],
) {
  window.parent.postMessage(
    { source: FRAME_SOURCE, type: "STATE", page, pageCount, pages },
    window.location.origin,
  );
}

export function PreviewFrameScreen1({
  autoRotate,
  studio: initialStudio,
  ...screenProps
}: InfoboardScreen1Props & {
  autoRotate: boolean;
  studio?: Screen1StudioConfig | null;
}) {
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [pages, setPages] = useState<readonly (readonly Screen1StudioCardRef[])[]>([]);
  const [studio, setStudio] = useState<Screen1StudioConfig | null>(
    initialStudio ?? null,
  );

  useEffect(() => {
    setStudio(initialStudio ?? null);
  }, [initialStudio]);

  const reconcilePageCount = useCallback((nextCount: number) => {
    const safeCount = Math.max(1, nextCount);
    setPageCount(safeCount);
    setPage((current) => Math.min(current, safeCount - 1));
  }, []);

  useEffect(() => {
    notifyParent(page, pageCount, pages);
  }, [page, pageCount, pages]);

  useEffect(() => {
    function receiveCommand(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as
        | {
            source?: string;
            type?: string;
            page?: number;
            studio?: Screen1StudioConfig | null;
          }
        | undefined;
      if (data?.source !== STUDIO_SOURCE) return;

      if (data.type === "SET_PAGE" && Number.isInteger(data.page)) {
        setPage(Math.min(Math.max(0, data.page ?? 0), pageCount - 1));
      }
      if (data.type === "SET_STUDIO" && data.studio !== undefined) {
        setStudio(data.studio);
        setPage(0);
      }
    }
    window.addEventListener("message", receiveCommand);
    return () => window.removeEventListener("message", receiveCommand);
  }, [pageCount]);

  return (
    <KioskViewportScaler>
      <InfoboardScreen1
        {...screenProps}
        studio={studio}
        liveClock={false}
        previewPagination={{
          activePage: page,
          autoRotate,
          onPageChange: setPage,
          onPageCountChange: reconcilePageCount,
          onPaginationStructureChange: setPages,
        }}
      />
    </KioskViewportScaler>
  );
}

export function PreviewFrameStatic({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    notifyParent(0, 1, []);
  }, []);
  return children;
}
