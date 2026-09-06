/**
 * Node's spawn helpers do not resolve Windows `.cmd` shims the way shells do.
 */
export function resolveNpxCommand(
  platform: NodeJS.Platform = process.platform,
): string {
  return platform === "win32" ? "npx.cmd" : "npx";
}
