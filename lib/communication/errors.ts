export type CommunicationServiceErrorCode =
  | "INVALID_INPUT"
  | "TARGET_NOT_FOUND"
  | "THREAD_NOT_FOUND"
  | "MESSAGE_NOT_FOUND"
  | "RECIPIENT_UNAVAILABLE"
  | "SEND_FORBIDDEN"
  | "PROVIDER_FAILED"
  | "COMMENT_NOT_FOUND"
  | "COMMENT_FORBIDDEN"
  | "TENANT_FORBIDDEN"
  | "MENTION_FORBIDDEN"
  | "UNSUPPORTED_TARGET_TYPE";

export class CommunicationServiceError extends Error {
  readonly code: CommunicationServiceErrorCode;

  constructor(code: CommunicationServiceErrorCode, message: string) {
    super(message);
    this.name = "CommunicationServiceError";
    this.code = code;
  }
}

export function assertTenantId(tenantId: string): string {
  const normalized = tenantId.trim();
  if (!normalized) {
    throw new CommunicationServiceError("INVALID_INPUT", "tenantId ist erforderlich.");
  }
  return normalized;
}
