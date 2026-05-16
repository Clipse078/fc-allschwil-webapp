import { NextRequest, NextResponse } from "next/server";
import { getPublishedSnapshots } from "@/lib/website/page-queries";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantKey = searchParams.get("tenantKey")?.trim();

    if (!tenantKey) {
      return NextResponse.json(
        { error: "tenantKey is required." },
        { status: 400 },
      );
    }

    const snapshots = await getPublishedSnapshots(tenantKey);

    return NextResponse.json({
      tenantKey,
      count: snapshots.length,
      pages: snapshots,
    });
  } catch (error) {
    console.error("Public website pages API failed:", error);
    return NextResponse.json(
      { error: "Could not load published pages." },
      { status: 500 },
    );
  }
}
