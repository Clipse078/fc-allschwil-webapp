import { randomBytes } from "crypto";

/**
 * Generates a cryptographically strong opaque token for future inbound email
 * routing (COMM-01D). Never expose raw DB ids in reply addresses.
 */
export function generateInboundReplyToken(): string {
  // Use a lower-case charset that survives common email address normalization.
  // Keep the reply-to local-part safely below 64 chars:
  // `reply+` prefix (6) + token (48) = 54 <= 64.
  // A 24-byte random source produces a 48-char hex token (192-bit entropy).
  return randomBytes(24).toString("hex");
}
