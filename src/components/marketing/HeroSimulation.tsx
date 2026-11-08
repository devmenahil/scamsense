import { Icon } from "@/components/icons/Icon";
import { LogoSymbol } from "@/components/brand/Logo";

/**
 * Landing-page illustration: a fictional email window as it might appear inside a ScamSense simulation.
 * Purely decorative (role="img" with a description). Nothing in it is interactive, so it renders no buttons or links.
 * Uses a fictional company and a reserved `.example` domain (R29).
 */
export function HeroSimulation() {
  return (
    <div
      role="img"
      aria-label="Illustration: a fictional invoice email shown inside the ScamSense training simulator, with Sensei Kenshi's reminder to pause, check, and verify before paying."
      className="relative mx-auto w-full max-w-[34rem]"
    >
      {/* Teal stage with the brand "nudge" pattern of speech bubbles */}
      <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-panel bg-teal sm:translate-x-5 sm:translate-y-5" />
      <div
        aria-hidden="true"
        className="relative overflow-hidden rounded-panel border-2 border-teal bg-white shadow-float"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-3 border-b-2 border-teal bg-mist px-4 py-3">
          <span className="flex gap-1.5">
            <span className="size-3 rounded-pill border-2 border-teal" />
            <span className="size-3 rounded-pill border-2 border-teal" />
            <span className="size-3 rounded-pill border-2 border-teal" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2 rounded-pill border-2 border-teal/40 bg-white px-3 py-1 text-caption">
            <Icon name="lock" className="size-3.5" />
            <span className="truncate">mail.northwind-supplies.example/inbox</span>
          </span>
        </div>

        <div className="grid grid-cols-[4.5rem_1fr] sm:grid-cols-[6.5rem_1fr]">
          {/* Folder rail */}
          <div className="flex flex-col gap-2 border-r-2 border-mist p-3 text-caption font-medium">
            <span className="rounded-pill bg-mist px-2 py-1 font-heading font-extrabold">Inbox</span>
            <span className="px-2 py-1">Sent</span>
            <span className="px-2 py-1">Archive</span>
          </div>

          {/* Message */}
          <div className="min-w-0 p-4 pb-12 sm:p-5 sm:pb-14">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-pill bg-teal font-heading text-small font-black text-white">
                NS
              </span>
              <div className="min-w-0">
                <p className="truncate font-heading font-extrabold">Northwind Supplies</p>
                <p className="truncate text-caption text-teal/80">billing@northwind-supplies.example</p>
              </div>
            </div>
            <p className="mt-4 font-heading text-lg leading-6 font-extrabold">Invoice INV-4471 is ready</p>
            <p className="mt-1.5 text-small text-teal/85">
              Hello, please find your invoice for last month&apos;s order attached below.
            </p>
            <div className="mt-4 rounded-card border-2 border-teal p-3">
              <div className="flex items-center justify-between gap-2 text-small">
                <span className="flex items-center gap-2">
                  <Icon name="invoice" className="size-5" />
                  INV-4471.pdf
                </span>
                <span className="font-heading font-extrabold">$184.00</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-button border-2 border-teal bg-teal px-4 py-2 label-button text-[0.75rem] leading-4 text-white shadow-edge-shade">
                Pay now
              </span>
              <span className="rounded-button border-2 border-teal bg-white px-4 py-2 label-button text-[0.75rem] leading-4 shadow-edge-sm">
                Reply
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sensei Kenshi speech bubble */}
      <div
        aria-hidden="true"
        className="absolute -right-2 -bottom-8 flex max-w-[15rem] items-start gap-2.5 rounded-card border-2 border-teal bg-white p-3 shadow-edge sm:-right-8 sm:-bottom-10"
      >
        <LogoSymbol className="mt-0.5 w-8" />
        <p className="text-caption">
          <span className="block font-heading text-small font-extrabold">Sensei Kenshi</span>
          Pause. Check. Verify. Then pay.
        </p>
      </div>
    </div>
  );
}
