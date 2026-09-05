import { NextResponse } from "next/server";
import {
  checkDatabaseHealth,
  evaluateRuntimeConfiguration,
} from "@/lib/server/runtime";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const runtime = evaluateRuntimeConfiguration();
    const database = runtime.env.hasDatabaseUrl
      ? await checkDatabaseHealth()
      : { ok: false };

    if (runtime.ok && database.ok) {
      return NextResponse.json({ status: "ok" });
    }
  } catch {
    // Public health responses intentionally disclose no runtime error details.
  }

  return NextResponse.json({ status: "error" }, { status: 503 });
}
