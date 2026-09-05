/**
 * Database migrations are enabled by one explicit flag only. Deployment
 * classification, including Acceptance, and the presence of a database URL
 * never imply authorization.
 */
export function shouldApplyDatabaseMigrations(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return env.APPLY_DATABASE_MIGRATIONS === "true";
}
