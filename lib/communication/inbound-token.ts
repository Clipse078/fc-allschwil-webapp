import { randomBytes } from "crypto";

/**
 * Generates a cryptographically strong opaque token for future inbound email
 * routing (COMM-01D). Never expose raw DB ids in reply addresses.
 */
export function generateInboundReplyToken(): string {
  // Use a lower-case charset that survives common email address normalization.
  // A 32-byte random source produces a 64-char hex token (256-bit entropy).
  return randomBytes(32).toString("hex");
}
