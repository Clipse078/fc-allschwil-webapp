import "@testing-library/jest-dom";
import { applyConfiguredTestDatabaseUrlToProcessEnv } from "./lib/test/safe-test-database";

// When TEST_DATABASE_URL is explicitly configured and passes the guard, wire it
// into DATABASE_URL before any test module imports `@/lib/db/prisma`.
applyConfiguredTestDatabaseUrlToProcessEnv();
