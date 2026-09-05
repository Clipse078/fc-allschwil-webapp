const POSTGRES_URL_SCHEME_RE = /^postgres(ql)?:\/\//i;
const GENERATE_ONLY_PLACEHOLDER_URL =
  "postgresql://prisma-generate:unused@prisma-generate.invalid:5432/prisma_generate";

export function isPrismaGenerateCommand(argv: readonly string[]): boolean {
  return argv.some((argument) => argument === "generate");
}

export function resolvePrismaDatasourceUrlForCommand(
  processEnv: NodeJS.ProcessEnv,
  argv: readonly string[],
): string | null {
  const directUrl = processEnv.DIRECT_URL?.trim();
  if (directUrl && POSTGRES_URL_SCHEME_RE.test(directUrl)) {
    return directUrl;
  }

  const databaseUrl = processEnv.DATABASE_URL?.trim();
  if (databaseUrl) {
    return databaseUrl;
  }

  // `prisma generate` reads the schema but does not connect to its datasource.
  // Prisma config still requires a syntactically valid URL, so use the reserved
  // RFC 2606 `.invalid` TLD only for this non-connecting command.
  return isPrismaGenerateCommand(argv) ? GENERATE_ONLY_PLACEHOLDER_URL : null;
}
