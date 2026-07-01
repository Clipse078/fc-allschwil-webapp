/**
 * components/admin/website-preview
 *
 * Reusable Website Preview Shell for admin builders.
 *
 * Primary export:
 *   WebsitePreviewShell — full-screen overlay with mode + device switching.
 *
 * Sub-components (for custom compositions):
 *   WebsitePreviewToolbar
 *   WebsitePreviewFrame
 *   WebsitePreviewModeSwitch
 *   WebsitePreviewDeviceSwitch
 *   WebsitePreviewEmptyState
 *
 * Types:
 *   WebsitePreviewSection — normalised section shape accepted by the shell
 *   PreviewMode           — "draft" | "published"
 *   PreviewDevice         — "desktop" | "tablet" | "mobile"
 */

export { default as WebsitePreviewShell } from "./WebsitePreviewShell";
export type { WebsitePreviewSection } from "./WebsitePreviewShell";

export { default as WebsitePreviewToolbar } from "./WebsitePreviewToolbar";
export { default as WebsitePreviewFrame } from "./WebsitePreviewFrame";
export { default as WebsitePreviewModeSwitch } from "./WebsitePreviewModeSwitch";
export type { PreviewMode } from "./WebsitePreviewModeSwitch";
export { default as WebsitePreviewDeviceSwitch } from "./WebsitePreviewDeviceSwitch";
export type { PreviewDevice } from "./WebsitePreviewDeviceSwitch";
export { default as WebsitePreviewEmptyState } from "./WebsitePreviewEmptyState";
