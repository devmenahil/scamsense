import { NextResponse } from "next/server";
import { getUsageSnapshot } from "@/lib/ai/usage";

/**
 * GET /api/dev/gemini-usage — DEVELOPMENT-ONLY Gemini usage counters for this server process (Step 8 brief §21):
 * requests, retries, cache hits, tokens, errors, rate-limit and fallback events per category. Counters only: no
 * prompts, outputs, or personal data. 404 in production.
 */
export function GET() {
  if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
  return NextResponse.json(getUsageSnapshot(), { headers: { "Cache-Control": "no-store" } });
}
