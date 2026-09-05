import { timingSafeEqual } from "node:crypto";

export const FCA_CONSOLIDATION_CAPABILITY_ENV =
  "FCA_CONSOLIDATION_OPERATOR_SECRET";

export function hasBearerCapability(
  authorizationHeader: string | null,
  configuredSecret: string | undefined,
): boolean {
  const secret = configuredSecret?.trim();
  if (!secret || !authorizationHeader?.startsWith("Bearer ")) {
    return false;
  }

  const presented = authorizationHeader.slice("Bearer ".length);
  const expectedBytes = Buffer.from(secret);
  const presentedBytes = Buffer.from(presented);

  return (
    expectedBytes.length === presentedBytes.length &&
    timingSafeEqual(expectedBytes, presentedBytes)
  );
}

export function hasFcaConsolidationCapability(
  request: Pick<Request, "headers">,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return hasBearerCapability(
    request.headers.get("authorization"),
    env[FCA_CONSOLIDATION_CAPABILITY_ENV],
  );
}
