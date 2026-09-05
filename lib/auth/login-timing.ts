import { verifyPassword } from "@/lib/auth/password";

/**
 * Precomputed bcrypt hash used only for login timing mitigation when the
 * account is unknown or inactive. Never store real credentials here.
 *
 * Cost factor 12 matches production password hashing.
 */
const TIMING_MITIGATION_HASH =
  "$2a$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31LG";

/**
 * Perform constant-ish password verification work without revealing whether
 * an account exists. Safe for serverless — uses bcrypt, not blocking sleep.
 */
export async function runLoginTimingMitigation(password: string): Promise<void> {
  await verifyPassword(password, TIMING_MITIGATION_HASH);
}
