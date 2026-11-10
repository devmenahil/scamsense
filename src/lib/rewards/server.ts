import "server-only";
/**
 * Module rewards data access (Step 11). READS use the signed-in user's session client, so RLS scopes every row to the
 * caller; the explicit user filter is a second guard. The only WRITE paths are service_role database functions
 * (ensure_module_rewards, begin/finish_certificate_email_request) called with the user id from the verified session.
 *
 * Badges and certificates are created by the database itself when a module run completes (trigger in
 * 20261115090000_module_rewards.sql), so nothing here can award twice. `ensure_module_rewards` is only a repair path.
 */
import { getModule, type ModuleKey } from "@/content/modules";
import { ApiError, dbError } from "@/lib/api/server";
import { getTrustedWriter, isTrustedWriterConfigured } from "@/lib/supabase/admin";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import {
  BADGE_COLUMNS,
  buildCertificateView,
  CERTIFICATE_COLUMNS,
  type BadgeRow,
  type CertificateRow,
  type CertificateView,
} from "./certificate";
import {
  EMAIL_REQUEST_COLUMNS,
  emailStatusFromRow,
  type EmailRequestRow,
  type EmailStatusView,
} from "./emailStatus";

export interface BadgeView {
  moduleKey: ModuleKey;
  badgeName: string;
  moduleTitle: string;
  moduleOrder: 1 | 2 | 3;
  awardedAt: string;
  moduleScore: number;
  maxScore: number;
}

export type RewardsSummary =
  | {
      available: true;
      badges: Partial<Record<ModuleKey, BadgeView>>;
      certificates: Partial<Record<ModuleKey, CertificateView>>;
    }
  /** Reward tables unreadable (e.g. migration not applied): pages fall back to progress-derived badges. */
  | { available: false };

function toBadgeView(row: BadgeRow): BadgeView | null {
  const m = getModule(row.module_key);
  if (!m) return null;
  return {
    moduleKey: m.key,
    badgeName: m.badgeName,
    moduleTitle: m.title,
    moduleOrder: m.order,
    awardedAt: row.awarded_at,
    moduleScore: row.module_score,
    maxScore: row.max_score,
  };
}

/** All of the caller's badges and certificates (dashboard, profile, certificates page). Never writes. */
export async function loadRewards(supabase: SupabaseServerClient, userId: string): Promise<RewardsSummary> {
  const [badges, certs] = await Promise.all([
    supabase.from("badges").select(BADGE_COLUMNS).eq("user_id", userId).returns<BadgeRow[]>(),
    supabase
      .from("certificates")
      .select(CERTIFICATE_COLUMNS)
      .eq("user_id", userId)
      .returns<CertificateRow[]>(),
  ]);
  if (badges.error || certs.error) {
    console.error("[rewards] read failed", { code: badges.error?.code ?? certs.error?.code });
    return { available: false };
  }
  const out: RewardsSummary = { available: true, badges: {}, certificates: {} };
  for (const b of badges.data ?? []) {
    const v = toBadgeView(b);
    if (v) out.badges[v.moduleKey] = v;
  }
  for (const c of certs.data ?? []) {
    const v = buildCertificateView(c);
    if (v) out.certificates[v.moduleKey] = v;
  }
  return out;
}

export type ModuleRewardState =
  | { status: "not_completed" }
  | { status: "unavailable" }
  | {
      status: "ok";
      certificate: CertificateView;
      badge: BadgeView | null;
      email: EmailStatusView;
      learnerName: string;
    };

async function readCertificate(supabase: SupabaseServerClient, userId: string, moduleKey: ModuleKey) {
  return supabase
    .from("certificates")
    .select(CERTIFICATE_COLUMNS)
    .eq("user_id", userId)
    .eq("module_key", moduleKey)
    .maybeSingle<CertificateRow>();
}

/**
 * The caller's certificate, badge, and latest email status for one module. If the module is complete but its rewards
 * are missing (should not happen after the migration's backfill), the repair function is called once.
 */
export async function getModuleRewards(
  supabase: SupabaseServerClient,
  userId: string,
  moduleKey: ModuleKey,
): Promise<ModuleRewardState> {
  const run = await supabase
    .from("module_runs")
    .select("completed_at")
    .eq("user_id", userId)
    .eq("module_key", moduleKey)
    .maybeSingle<{ completed_at: string | null }>();
  if (run.error) return { status: "unavailable" };
  if (!run.data?.completed_at) return { status: "not_completed" };

  let cert = await readCertificate(supabase, userId, moduleKey);
  if (cert.error) return { status: "unavailable" };
  if (!cert.data && isTrustedWriterConfigured()) {
    const { error } = await getTrustedWriter().rpc("ensure_module_rewards", {
      p_user_id: userId,
      p_module_key: moduleKey,
    });
    if (error) console.error("[rewards] repair failed", { code: error.code });
    cert = await readCertificate(supabase, userId, moduleKey);
  }
  const certificate = cert.data ? buildCertificateView(cert.data) : null;
  if (!certificate) return { status: "unavailable" };

  const [badge, email] = await Promise.all([
    supabase
      .from("badges")
      .select(BADGE_COLUMNS)
      .eq("user_id", userId)
      .eq("module_key", moduleKey)
      .maybeSingle<BadgeRow>(),
    latestEmailRequest(supabase, userId, certificate.id),
  ]);
  return {
    status: "ok",
    certificate,
    badge: badge.data ? toBadgeView(badge.data) : null,
    email: emailStatusFromRow(email),
    learnerName: certificate.recipientName,
  };
}

async function latestEmailRequest(
  supabase: SupabaseServerClient,
  userId: string,
  certificateId: string,
): Promise<EmailRequestRow | null> {
  const { data, error } = await supabase
    .from("certificate_email_requests")
    .select(EMAIL_REQUEST_COLUMNS)
    .eq("user_id", userId)
    .eq("certificate_id", certificateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<EmailRequestRow>();
  return error ? null : data;
}

/** Throws a friendly ApiError unless the caller's module is completed with a readable certificate. */
export async function requireModuleRewards(
  supabase: SupabaseServerClient,
  userId: string,
  moduleKey: string,
) {
  const m = getModule(moduleKey);
  if (!m) throw new ApiError(404, "not_found", "We couldn't find that module.");
  const state = await getModuleRewards(supabase, userId, m.key);
  if (state.status === "not_completed")
    throw new ApiError(409, "module_not_completed", "Finish both scenarios in this module first.");
  if (state.status === "unavailable") throw dbError({ code: "42P01" }, "Certificates");
  return { module: m, ...state };
}
