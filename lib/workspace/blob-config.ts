import { isExternalSideEffectConfigured } from "@/lib/server/external-side-effect-policy";

/**
 * Dedicated configuration for the private Workspace Blob store.
 *
 * The Workspace module must use only the dedicated private store
 * (sportclubevo-workspace-stage) and must never fall back to the
 * public asset store (BLOB_READ_WRITE_TOKEN / BLOB_STORE_ID).
 *
 * Required environment variables (Vercel WORKSPACE_BLOB prefix):
 *   WORKSPACE_BLOB_READ_WRITE_TOKEN — issued by the private Workspace store
 *   WORKSPACE_BLOB_STORE_ID         — the store ID of the private Workspace store
 *
 * SDK behaviour note:
 *   For token-based authentication the store is already bound to the token
 *   itself, so storeId is technically redundant when token is supplied.
 *   Both values are included in every SDK call as an explicit declaration of
 *   intent and to enable future OIDC-based authentication without code changes.
 */

export type WorkspaceBlobConfig = {
  readonly token: string;
  readonly storeId: string;
};

export class WorkspaceBlobConfigError extends Error {
  constructor(missingVariable: string) {
    super(
      `Workspace Blob store is not configured: ${missingVariable} is missing.`,
    );
    this.name = "WorkspaceBlobConfigError";
  }
}

/**
 * Returns the validated Workspace Blob store configuration.
 *
 * Throws WorkspaceBlobConfigError when either required variable is absent.
 * The token and store ID values are never logged or exposed in error messages.
 */
export function getWorkspaceBlobConfig(): WorkspaceBlobConfig {
  const token = process.env.WORKSPACE_BLOB_READ_WRITE_TOKEN;

  if (!token) {
    throw new WorkspaceBlobConfigError(
      "WORKSPACE_BLOB_READ_WRITE_TOKEN",
    );
  }

  const storeId = process.env.WORKSPACE_BLOB_STORE_ID;

  if (!storeId) {
    throw new WorkspaceBlobConfigError("WORKSPACE_BLOB_STORE_ID");
  }

  if (
    !isExternalSideEffectConfigured("workspace-blob", [
      "WORKSPACE_BLOB_READ_WRITE_TOKEN",
      "WORKSPACE_BLOB_STORE_ID",
    ])
  ) {
    throw new WorkspaceBlobConfigError(
      "ACCEPTANCE_ENABLED_EXTERNAL_PROVIDERS",
    );
  }

  return { token, storeId };
}
