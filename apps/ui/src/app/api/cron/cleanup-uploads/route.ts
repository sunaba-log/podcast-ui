import { NextResponse } from "next/server";
import { getCronSecret } from "@/server/env";
import { markAbandonedUploadsFailed } from "@/server/episodes/repository";

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${getCronSecret()}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const updated = await markAbandonedUploadsFailed(24 * 60);
  return NextResponse.json({ updated });
}
