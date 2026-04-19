import crypto from "crypto";

const TOKEN_BYTE_LENGTH = 32;

export function createPlainToken() {
  return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString("hex");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
