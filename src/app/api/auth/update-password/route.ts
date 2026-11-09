import { ApiError, errorResponse, json, parseBody, requireApiUser } from "@/lib/api/server";
import { friendlyAuthError } from "@/lib/auth/errors";
import { updatePasswordSchema } from "@/lib/auth/schema";

/** POST /api/auth/update-password — sets a new password for the signed-in user (used after a reset link). */
export async function POST(request: Request) {
  try {
    const { supabase } = await requireApiUser();
    const { password } = await parseBody(request, updatePasswordSchema);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      const f = friendlyAuthError(error, "update");
      throw new ApiError(f.status, f.code, f.message, f.field ? { [f.field]: f.message } : undefined);
    }
    return json({ status: "updated" });
  } catch (e) {
    return errorResponse(e);
  }
}
