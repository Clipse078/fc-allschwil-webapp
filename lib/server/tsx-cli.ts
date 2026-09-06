import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves the locally installed tsx CLI entry point so scripts can run via
 * `process.execPath` without shell shims or `npx`.
 */
export function resolveTsxCliPath(
  moduleUrl: string | URL = import.meta.url,
): string {
  const require = createRequire(fileURLToPath(moduleUrl));
  const packageJsonPath = require.resolve("tsx/package.json");
  return join(dirname(packageJsonPath), "dist", "cli.mjs");
}
