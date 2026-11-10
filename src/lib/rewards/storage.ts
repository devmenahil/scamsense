import "server-only";
/**
 * Private certificate PDF storage (Step 11). The PDF lives in the PRIVATE Supabase Storage bucket `certificate-pdfs`
 * (no policies for browser roles) and leaves it only as a short-lived signed URL handed to Zapier, which downloads it
 * into the Gmail attachment. The signed URL is never returned to the browser: certificates are not downloadable (R25).
 *
 * Supabase Storage is reachable from Zapier even while the app itself runs on localhost, so no extra public endpoint
 * or external file host is needed.
 */
import { getTrustedWriter } from "@/lib/supabase/admin";
import { certificatePdfFileName, type CertificateView } from "./certificate";

export const CERTIFICATE_BUCKET = "certificate-pdfs";
/** Bump when the certificate PDF design changes, so new requests get a freshly rendered file. */
export const CERTIFICATE_PDF_VERSION = "v1";
/** Long enough for Zapier to fetch the attachment (normally seconds; allows delayed or replayed Zap runs). */
export const CERTIFICATE_LINK_TTL_SECONDS = 24 * 60 * 60;

export function certificateObjectPath(
  view: Pick<CertificateView, "id" | "moduleTitle" | "certificateId">,
): string {
  // Certificate row id (random UUID) as the folder: no user id or email in the URL Zapier sees.
  return `${view.id}/${CERTIFICATE_PDF_VERSION}/${certificatePdfFileName(view)}`;
}

type Storage = ReturnType<typeof getTrustedWriter>["storage"];

async function sign(storage: Storage, path: string, fileName: string) {
  return storage
    .from(CERTIFICATE_BUCKET)
    .createSignedUrl(path, CERTIFICATE_LINK_TTL_SECONDS, { download: fileName });
}

async function upload(storage: Storage, path: string, pdf: Buffer) {
  return storage.from(CERTIFICATE_BUCKET).upload(path, pdf, {
    contentType: "application/pdf",
    cacheControl: "3600",
    upsert: true,
  });
}

/**
 * Returns a signed URL for the certificate's PDF, rendering and uploading it the first time only. The stored file is
 * built from the immutable certificate row, so it always matches the on-screen preview.
 */
export async function signedCertificateUrl(
  view: CertificateView,
  render: (view: CertificateView) => Promise<Buffer>,
): Promise<string> {
  const storage = getTrustedWriter().storage;
  const path = certificateObjectPath(view);
  const fileName = certificatePdfFileName(view);

  const existing = await sign(storage, path, fileName);
  if (existing.data?.signedUrl) return existing.data.signedUrl;

  const pdf = await render(view);
  let put = await upload(storage, path, pdf);
  if (put.error && /bucket not found/i.test(put.error.message)) {
    // The migration creates the bucket; this keeps email working if that step was missed. Always private.
    await storage.createBucket(CERTIFICATE_BUCKET, {
      public: false,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ["application/pdf"],
    });
    put = await upload(storage, path, pdf);
  }
  if (put.error) throw new Error(`certificate_upload_failed`);

  const signed = await sign(storage, path, fileName);
  if (!signed.data?.signedUrl) throw new Error("certificate_sign_failed");
  return signed.data.signedUrl;
}
