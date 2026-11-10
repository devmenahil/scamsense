import { CERTIFICATE_DISCLAIMER, type CertificateView } from "@/lib/rewards/certificate";
import { Logo } from "@/components/brand/Logo";
import { ModuleBadge } from "@/components/rewards/ModuleBadge";
import { getModule } from "@/content/modules";

/**
 * On-screen Certificate of Completion (R24/R25). Same data and layout as the emailed PDF
 * (src/lib/pdf/CertificateDocument.tsx). There is deliberately no download or print control here.
 */
export function CertificatePreview({ certificate: c }: { certificate: Omit<CertificateView, "id"> }) {
  const m = getModule(c.moduleKey)!;
  return (
    <figure
      aria-label={`Certificate of Completion for ${c.recipientName}, module ${c.moduleTitle}`}
      className="relative overflow-hidden rounded-panel border-[3px] border-teal bg-white p-2 shadow-edge sm:p-3"
    >
      <div className="rounded-card border-2 border-mist">
        <div className="flex justify-center rounded-t-[0.875rem] bg-mist px-4 py-5 sm:py-6">
          <Logo size="md" />
        </div>
        <div className="flex flex-col items-center px-4 pt-6 pb-5 text-center sm:px-10 sm:pt-8">
          <p className="label-eyebrow text-teal/80">Scam-awareness training simulation</p>
          <h2 className="mt-1 font-heading text-[1.75rem] leading-9 font-black sm:text-[2.25rem] sm:leading-[2.75rem]">
            Certificate of Completion
          </h2>
          <p className="mt-4 text-small">This certifies that</p>
          <p className="mt-1 font-heading text-[1.625rem] leading-8 font-black break-words sm:text-[2.125rem] sm:leading-[2.5rem]">
            {c.recipientName}
          </p>
          <span aria-hidden="true" className="mt-2 h-1.5 w-40 rounded-pill bg-yellow sm:w-56" />
          <p className="mt-4 text-small">has successfully completed the ScamSense module</p>
          <p className="mt-1 font-heading text-lg font-extrabold sm:text-subheading">
            Module {c.moduleOrder}: {c.moduleTitle}
          </p>
          <p className="mt-1 text-small">
            {c.difficulty} level · {c.badgeName} badge earned
          </p>

          <dl className="mt-6 grid w-full grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_auto_1fr]">
            <div className="text-center sm:text-left">
              <dt className="label-eyebrow text-teal/80">Completed on</dt>
              <dd className="mt-1 border-t-2 border-teal pt-1.5 font-semibold">{c.completedOn}</dd>
            </div>
            <ModuleBadge badgeKey={m.badgeKey} earned size="sm" className="mx-auto" />
            <div className="text-center sm:text-right">
              <dt className="label-eyebrow text-teal/80">Certificate ID</dt>
              <dd className="mt-1 border-t-2 border-teal pt-1.5 font-semibold tracking-wide">
                {c.certificateId}
              </dd>
            </div>
          </dl>
          <p className="mt-5 max-w-xl text-caption text-teal/85">{CERTIFICATE_DISCLAIMER}</p>
        </div>
      </div>
    </figure>
  );
}
