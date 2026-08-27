"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  InfoboardScreen1,
  type InfoboardScreen1Props,
} from "@/components/infoboard/screen1/InfoboardScreen1";
import { KioskViewportScaler } from "@/components/infoboard/shared/KioskViewportScaler";
import type { Screen1StudioCardRef } from "@/components/infoboard/studio/Screen1Studio";
import { resolveStudioPageIndex } from "@/lib/infoboard/screen1-studio-page-retention";
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
  const selectedKeyRef = useRef<string | null>(null);
  const [studio, setStudio] = useState<Screen1StudioConfig | null>(
    initialStudio ?? null,
  );

  const updateSelectedKey = useCallback((key: string | null) => {
    selectedKeyRef.current = key;
  }, []);

  useEffect(() => {
    setStudio(initialStudio ?? null);
  }, [initialStudio]);

  const reconcilePageCount = useCallback((nextCount: number) => {
    setPageCount(Math.max(1, nextCount));
  }, []);

  const applyPageRetention = useCallback(
    (nextPages: readonly (readonly Screen1StudioCardRef[])[]) => {
      setPages(nextPages);
      setPage((current) =>
        resolveStudioPageIndex({
          pages: nextPages,
          selectedKey: selectedKeyRef.current,
          previousPageIndex: current,
        }),
      );
    },
    [],
  );

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
            selectedKey?: string | null;
          }
        | undefined;
      if (data?.source !== STUDIO_SOURCE) return;

      if (data.type === "SET_PAGE" && Number.isInteger(data.page)) {
        setPage(Math.min(Math.max(0, data.page ?? 0), pageCount - 1));
      }
      if (data.type === "SET_STUDIO" && data.studio !== undefined) {
        setStudio(data.studio);
        if (data.selectedKey !== undefined) {
          updateSelectedKey(data.selectedKey);
        }
      }
      if (data.type === "SET_SELECTED_KEY") {
        updateSelectedKey(data.selectedKey ?? null);
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
          onPaginationStructureChange: applyPageRetention,
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
