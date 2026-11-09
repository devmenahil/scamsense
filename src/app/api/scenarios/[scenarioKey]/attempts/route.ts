import { ApiError, errorResponse, json, requireApiUser } from "@/lib/api/server";
import { getScenarioSlot } from "@/content/modules";
import { requireOnboardedProgressProfile } from "@/lib/progress/profileForProgress";
import { startScenarioAttempt } from "@/lib/scenario/server";

type Context = { params: Promise<{ scenarioKey: string }> };

/**
 * POST /api/scenarios/[scenarioKey]/attempts — starts a first attempt, resumes the unfinished one, or (for a completed
 * scenario) creates a new practice replay with its own attempt id. No body: everything is decided by the server.
 * 201 new/replay · 200 resume · 409 locked or module not started · 404 unknown scenario.
 */
export async function POST(_request: Request, { params }: Context) {
  try {
    const { scenarioKey } = await params;
    if (!getScenarioSlot(scenarioKey))
      throw new ApiError(404, "unknown_scenario", "That scenario doesn't exist.");
    const { supabase, user } = await requireApiUser();
    const profile = await requireOnboardedProgressProfile(supabase, user.id);
    const result = await startScenarioAttempt(supabase, user.id, profile, scenarioKey);
    return json(result, result.kind === "resume" ? 200 : 201);
  } catch (e) {
    return errorResponse(e);
  }
}
