import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderClosed,
  Presentation,
} from "lucide-react";

import type { WorkspaceFileCategory } from "@/lib/workspace/file-type-util";

type WorkspaceFileIconSize = "sm" | "md" | "lg" | "xl";

type WorkspaceFileIconProps = {
  category: WorkspaceFileCategory;
  size?: WorkspaceFileIconSize;
  className?: string;
};

const SIZE_CLASS: Record<WorkspaceFileIconSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
  xl: "h-10 w-10",
};

const CATEGORY_COLOR: Record<WorkspaceFileCategory, string> = {
  pdf: "text-[#e2392a]",
  word: "text-[#2b579a]",
  excel: "text-[#217346]",
  powerpoint: "text-[#d24726]",
  image: "text-[var(--blue)]",
  video: "text-[#8b5cf6]",
  audio: "text-[#ec4899]",
  archive: "text-[var(--muted)]",
  text: "text-[var(--text-2)]",
  unknown: "text-[var(--muted)]",
};

function IconForCategory({
  category,
  className,
}: {
  category: WorkspaceFileCategory;
  className: string;
}) {
  switch (category) {
    case "pdf":
      return <FileText className={className} />;
    case "word":
      return <FileText className={className} />;
    case "excel":
      return <FileSpreadsheet className={className} />;
    case "powerpoint":
      return <Presentation className={className} />;
    case "image":
      return <FileImage className={className} />;
    case "video":
      return <FileVideo className={className} />;
    case "audio":
      return <FileAudio className={className} />;
    case "archive":
      return <FileArchive className={className} />;
    case "text":
      return <FileText className={className} />;
    default:
      return <File className={className} />;
  }
}

export function WorkspaceFileIcon({
  category,
  size = "md",
  className,
}: WorkspaceFileIconProps) {
  const sizeClass = SIZE_CLASS[size];
  const colorClass = CATEGORY_COLOR[category];
  const combined = [sizeClass, colorClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <IconForCategory
      category={category}
      className={combined}
    />
  );
}

export function WorkspaceFolderIcon({
  size = "md",
  className,
}: {
  size?: WorkspaceFileIconSize;
  className?: string;
}) {
  const sizeClass = SIZE_CLASS[size];
  const combined = [sizeClass, "text-[var(--muted)]", className]
    .filter(Boolean)
    .join(" ");

  return <FolderClosed className={combined} />;
}
