/**
 * Certificate of Completion data (Step 11). Pure and client-safe: the on-screen preview and the server-generated PDF
 * are both built from the same `CertificateView`, so they always show the same name, module, date, and ID.
 */
import { getModule, type ModuleKey } from "@/content/modules";

/** Same format as the database check `certificates_code_format`. */
export const CERTIFICATE_CODE_PATTERN = /^SS[1-3]-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

export const CERTIFICATE_DISCLAIMER =
  "This certificate recognizes completion of an educational ScamSense simulation that uses fictional Training Funds. " +
  "It is not a PayPal certification and does not represent endorsement or accreditation by PayPal or any other " +
  "organization.";

/** A `certificates` row (read through RLS). */
export interface CertificateRow {
  id: string;
  module_key: string;
  certificate_code: string;
  recipient_name: string;
  module_title: string;
  completed_at: string;
  issued_at: string;
}

export const CERTIFICATE_COLUMNS =
  "id, module_key, certificate_code, recipient_name, module_title, completed_at, issued_at";

/** A `badges` row (read through RLS). */
export interface BadgeRow {
  module_key: string;
  badge_key: string;
  module_score: number;
  max_score: number;
  awarded_at: string;
}

export const BADGE_COLUMNS = "module_key, badge_key, module_score, max_score, awarded_at";

export interface CertificateView {
  /** Internal row id (never shown; used to scope email requests). */
  id: string;
  moduleKey: ModuleKey;
  moduleOrder: 1 | 2 | 3;
  moduleTitle: string;
  difficulty: string;
  badgeName: string;
  /** The public, human-readable certificate ID (e.g. SS1-7F3A-91C2-0B4E). */
  certificateId: string;
  recipientName: string;
  completedAtIso: string;
  /** Long date in UTC, so the web preview and the PDF never disagree by a day. */
  completedOn: string;
}

/** "November 10, 2026" — UTC so server (PDF) and browser (preview) render the same day. */
export function formatCompletionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(d);
}

/** ISO calendar date (UTC) for file names. */
export function isoDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "undated" : d.toISOString().slice(0, 10);
}

export function buildCertificateView(row: CertificateRow): CertificateView | null {
  const m = getModule(row.module_key);
  if (!m || !CERTIFICATE_CODE_PATTERN.test(row.certificate_code)) return null;
  return {
    id: row.id,
    moduleKey: m.key,
    moduleOrder: m.order,
    moduleTitle: row.module_title || m.title,
    difficulty: m.difficulty,
    badgeName: m.badgeName,
    certificateId: row.certificate_code,
    recipientName: row.recipient_name,
    completedAtIso: row.completed_at,
    completedOn: formatCompletionDate(row.completed_at),
  };
}

function slug(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Attachment name Zapier/Gmail shows, e.g. ScamSense-Certificate-Spot-the-Trap-SS1-7F3A-91C2-0B4E.pdf */
export function certificatePdfFileName(view: Pick<CertificateView, "moduleTitle" | "certificateId">): string {
  return `ScamSense-Certificate-${slug(view.moduleTitle)}-${view.certificateId}.pdf`;
}

/** e.g. ScamSense-Analysis-Report-Module-1-Spot-the-Trap-2026-11-10.pdf */
export function reportFileName(moduleOrder: number, moduleTitle: string, completedAtIso: string): string {
  return `ScamSense-Analysis-Report-Module-${moduleOrder}-${slug(moduleTitle)}-${isoDay(completedAtIso)}.pdf`;
}
