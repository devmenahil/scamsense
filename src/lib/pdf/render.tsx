import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import type { ModuleReport } from "@/lib/report/build";
import type { CertificateView } from "@/lib/rewards/certificate";
import { CertificateDocument } from "./CertificateDocument";
import { ReportDocument } from "./ReportDocument";
import { registerPdfFonts } from "./theme";

/** Server-side PDF rendering (Node runtime only). Deterministic for the same input apart from PDF metadata dates. */
export async function renderCertificatePdf(certificate: CertificateView): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<CertificateDocument certificate={certificate} />);
}

export async function renderReportPdf(report: ModuleReport): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<ReportDocument report={report} />);
}
