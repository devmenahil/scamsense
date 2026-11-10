import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildCertificateView } from "@/lib/rewards/certificate";
import { sampleReport } from "@/lib/testing/reportFixture";
import { renderCertificatePdf, renderReportPdf } from "./render";

/** Set PDF_PREVIEW_DIR to write the rendered files for a visual check. */
function save(name: string, buf: Buffer) {
  const dir = process.env.PDF_PREVIEW_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), buf);
}

function pageCount(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

describe("server-generated PDFs", () => {
  it("renders the certificate as a valid one-page PDF", { timeout: 30_000 }, async () => {
    const view = buildCertificateView({
      id: "11111111-1111-4111-8111-111111111111",
      module_key: "outsmart-the-scam",
      certificate_code: "SS3-7F3A-91C2-0B4E",
      recipient_name: "Łukasz Renée Okonkwo-Fernández",
      module_title: "Outsmart the Scam",
      completed_at: "2026-11-10T12:00:00Z",
      issued_at: "2026-11-10T12:00:00Z",
    })!;
    const buf = await renderCertificatePdf(view);
    save("certificate.pdf", buf);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pageCount(buf)).toBe(1);
    expect(buf.length).toBeLessThan(2 * 1024 * 1024); // storage bucket limit
  });

  it("renders the analysis report as a valid multi-page PDF", { timeout: 30_000 }, async () => {
    const buf = await renderReportPdf(sampleReport());
    save("report.pdf", buf);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(buf)).toBeGreaterThanOrEqual(2);
  });
});
