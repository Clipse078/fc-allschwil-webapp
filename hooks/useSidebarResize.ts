"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clampSidebarWidth,
  persistSidebarWidth,
  readStoredSidebarWidth,
} from "@/lib/shell/sidebar-width";

type UseSidebarResizeOptions = {
  collapsed: boolean;
};

export function useSidebarResize({ collapsed }: UseSidebarResizeOptions) {
  const [width, setWidth] = useState(() => readStoredSidebarWidth());
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(width);

  useEffect(() => {
    widthRef.current = width;
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
  }, [width]);

  useEffect(() => {
    if (!collapsed) {
      document.documentElement.style.setProperty("--sidebar-width", `${widthRef.current}px`);
    }
  }, [collapsed]);

  const applyWidth = useCallback((nextWidth: number) => {
    const clamped = clampSidebarWidth(nextWidth);
    widthRef.current = clamped;
    setWidth(clamped);
    document.documentElement.style.setProperty("--sidebar-width", `${clamped}px`);
  }, []);

  const startResize = useCallback(
    (clientX: number) => {
      if (collapsed) return;
      setIsResizing(true);

      const onMove = (event: MouseEvent) => {
        event.preventDefault();
        applyWidth(event.clientX);
      };

      const onUp = () => {
        setIsResizing(false);
        persistSidebarWidth(widthRef.current);
        document.body.style.removeProperty("user-select");
        document.body.style.removeProperty("cursor");
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      applyWidth(clientX);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [applyWidth, collapsed],
  );

  const onResizePointerDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (collapsed) return;
      event.preventDefault();
      startResize(event.clientX);
    },
    [collapsed, startResize],
  );

  const onResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (collapsed) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        applyWidth(widthRef.current - 8);
        persistSidebarWidth(widthRef.current);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        applyWidth(widthRef.current + 8);
        persistSidebarWidth(widthRef.current);
      }
    },
    [applyWidth, collapsed],
  );

  return {
    width,
    isResizing,
    onResizePointerDown,
    onResizeKeyDown,
  };
}
