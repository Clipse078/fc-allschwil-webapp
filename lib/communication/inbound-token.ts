import { randomBytes } from "crypto";

/**
 * Generates a cryptographically strong opaque token for future inbound email
 * routing (COMM-01D). Never expose raw DB ids in reply addresses.
 */
export function generateInboundReplyToken(): string {
  return randomBytes(32).toString("base64url");
}
