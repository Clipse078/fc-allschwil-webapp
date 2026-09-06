import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

/**
 * Resolves the locally installed Prisma CLI JavaScript entry point so migration
 * deployment can run via `process.execPath` without shell shims or `npx`.
 */
export function resolvePrismaCliPath(
  moduleUrl: string | URL = import.meta.url,
): string {
  const require = createRequire(fileURLToPath(moduleUrl));
  return require.resolve("prisma/build/index.js");
}
