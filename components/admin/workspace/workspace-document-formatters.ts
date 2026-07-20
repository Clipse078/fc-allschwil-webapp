export function formatWorkspaceFileSize(
  sizeBytes: number,
): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let size = sizeBytes / 1024;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const precision = size >= 10 ? 0 : 1;

  return `${size.toFixed(precision)} ${units[unitIndex]}`;
}

export function formatWorkspaceDate(
  value: Date | string,
): string {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function formatWorkspaceDateLong(
  value: Date | string,
): string {
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "long",
  }).format(new Date(value));
}
