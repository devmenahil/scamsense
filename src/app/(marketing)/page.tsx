import Link from "next/link";
import { MODULES } from "@/content/modules";
import { Icon, type IconName } from "@/components/icons/Icon";
import { LogoSymbol } from "@/components/brand/Logo";
import { HeroSimulation } from "@/components/marketing/HeroSimulation";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";

const SCENARIO_STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "search",
    title: "Explore",
    body: "Step into a realistic, fictional inbox, chat, storefront, or invoice. Open messages and look around.",
  },
  {
    icon: "wallet",
    title: "Decide",
    body: "Act inside the tool itself: pay, reply, ship, verify, or walk away. Nobody tells you which is which.",
  },
  {
    icon: "chat",
    title: "Explain",
    body: "Write a few sentences on why you chose what you did. Your reasoning matters as much as the outcome.",
  },
  {
    icon: "flag",
    title: "Reveal",
    body: "See feedback on your reasoning, the red flags you caught or missed, and Your Recovery Playbook.",
  },
];

const MODULE_ICONS: IconName[] = ["phishing", "invoice", "marketplace"];

export default function LandingPage() {
  return (
    <>
      {/* ---------------- Hero ---------------- */}
      <section aria-labelledby="hero-title" className="overflow-hidden">
        <div className="container-page grid items-center gap-14 py-12 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-24">
          <div className="min-w-0">
            <Badge tone="mist" wrap icon={<Icon name="shield" className="size-4" />}>
              Educational scam simulator · Adults 18+
            </Badge>
            <h1
              id="hero-title"
              className="mt-5 text-[2.25rem] leading-[2.75rem] font-extrabold tracking-[-0.015em] sm:text-display lg:text-[3.25rem] lg:leading-[3.75rem]"
            >
              Scammers don&apos;t give you a practice round.{" "}
              <span className="rounded-tile bg-yellow box-decoration-clone px-2 text-teal-shade">
                ScamSense does.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lead text-teal/90">
              Make real decisions in realistic, fictional financial situations, from invoices and marketplace
              chats to job offers. Explain your thinking, then see what the evidence showed. Payments run in
              PayPal Sandbox, so you never spend real money.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <ButtonLink
                href="/sign-up"
                size="lg"
                iconRight={<Icon name="arrow-right" className="size-5" />}
              >
                Start Training
              </ButtonLink>
              <Link
                href="#journey"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-pill px-3 font-heading font-extrabold underline decoration-2 underline-offset-4 hover:bg-mist"
              >
                See how it works
              </Link>
            </div>
            <ul className="mt-8 grid gap-2.5 text-small sm:grid-cols-3 sm:gap-4">
              {["Fictional scenarios", "No real money", "Practice, not panic"].map((item) => (
                <li key={item} className="flex items-center gap-2 font-medium">
                  <Icon name="check" className="size-4" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 pb-6 sm:px-6 lg:px-0">
            <HeroSimulation />
          </div>
        </div>
      </section>

      {/* ---------------- Learning journey ---------------- */}
      <section id="journey" aria-labelledby="journey-title" className="scroll-mt-20 bg-mist py-16 sm:py-20">
        <div className="container-page">
          <div className="max-w-2xl">
            <p className="label-eyebrow text-teal/80">Your learning journey</p>
            <h2
              id="journey-title"
              className="mt-2 text-[1.75rem] leading-[2.125rem] font-extrabold sm:text-heading"
            >
              Three modules, two simulations each
            </h2>
            <p className="mt-3 text-teal/90">
              Each module builds on the last. Finish both scenarios in a module to earn its badge, see your
              certificate, download your analysis report, and unlock the next level.
            </p>
          </div>

          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {MODULES.map((m, i) => (
              <Card as="li" key={m.key} className="flex flex-col">
                <div className="flex items-center justify-between gap-3">
                  <IconTile name={MODULE_ICONS[i] ?? "modules"} />
                  <Badge tone={i === 0 ? "teal" : "outline"}>{m.difficulty}</Badge>
                </div>
                <p className="mt-5 label-eyebrow text-teal/80">Module {m.order}</p>
                <h3 className="mt-1 text-subheading font-bold">{m.title}</h3>
                <p className="mt-2 flex-1 text-small text-teal/90">{m.summary}</p>
                <p className="mt-4 flex items-center gap-2 border-t-2 border-mist pt-3 text-caption font-medium">
                  <Icon name="modules" className="size-4" />2 scenarios · {m.focus}
                </p>
              </Card>
            ))}
          </ol>

          <h3 className="mt-14 text-subheading font-bold">How every scenario works</h3>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SCENARIO_STEPS.map((step, i) => (
              <li key={step.title} className="rounded-card border-2 border-teal/20 bg-white p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-8 items-center justify-center rounded-pill bg-teal font-heading text-small font-black text-white">
                    {i + 1}
                  </span>
                  <Icon name={step.icon} className="size-5" />
                </div>
                <p className="mt-3 font-heading text-lg font-extrabold">{step.title}</p>
                <p className="mt-1 text-small text-teal/90">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Sensei Kenshi ---------------- */}
      <section aria-labelledby="sensei-title" className="py-16 sm:py-20">
        <div className="container-page">
          <Card tone="teal" padding="lg" className="grid gap-8 md:grid-cols-[1fr_1.1fr] md:items-center">
            <div>
              <div className="flex items-center gap-3">
                <span className="inline-flex size-14 items-center justify-center rounded-card bg-white">
                  <LogoSymbol className="w-9" />
                </span>
                <Badge tone="on-dark">Your learning guide</Badge>
              </div>
              <h2
                id="sensei-title"
                className="mt-5 text-[1.75rem] leading-[2.125rem] font-extrabold sm:text-heading"
              >
                Meet Sensei Kenshi
              </h2>
              <p className="mt-3 text-white/90">
                A calm, curious guide you can ask about scenarios you&apos;ve finished, common scam tactics,
                and PayPal features. Sensei Kenshi never drops hints during a live scenario. The instinct you
                build is your own.
              </p>
            </div>
            <div className="flex flex-col gap-3" aria-label="Example conversation with Sensei Kenshi">
              <p className="label-eyebrow text-white/85">Example conversation</p>
              <p className="ml-auto max-w-[85%] rounded-card rounded-br-[4px] bg-teal-shade px-4 py-3 text-small">
                Why would a &ldquo;support agent&rdquo; need the code that was just sent to my phone?
              </p>
              <p className="max-w-[90%] rounded-card rounded-bl-[4px] bg-white px-4 py-3 text-small text-teal">
                Good instinct to pause there. A one-time code works like a key. Whoever has it can act as you,
                so it&apos;s meant for your eyes only, even if the request sounds official.
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* ---------------- Disclaimer ---------------- */}
      <section aria-labelledby="disclaimer-title" className="pb-16 sm:pb-20">
        <div className="container-page">
          <div className="rounded-panel border-2 border-teal p-6 sm:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
              <IconTile name="info" size="lg" tone="mist" accent={false} />
              <div className="min-w-0">
                <h2 id="disclaimer-title" className="text-subheading font-bold">
                  Honest by design: an educational simulator
                </h2>
                <ul className="mt-4 grid gap-3 text-small text-teal/90 md:grid-cols-2">
                  <li className="flex gap-2">
                    <Icon name="check" className="mt-0.5 size-4" />
                    Every company, person, website, and message in a scenario is fictional.
                  </li>
                  <li className="flex gap-2">
                    <Icon name="check" className="mt-0.5 size-4" />
                    Payments use PayPal Sandbox test accounts. No real money ever moves.
                  </li>
                  <li className="flex gap-2">
                    <Icon name="check" className="mt-0.5 size-4" />
                    Never enter real passwords, one-time codes, or card numbers. You&apos;ll never need them.
                  </li>
                  <li className="flex gap-2">
                    <Icon name="check" className="mt-0.5 size-4" />
                    ScamSense doesn&apos;t scan real messages or access your real accounts.
                  </li>
                </ul>
                <div className="mt-6">
                  <ButtonLink
                    href="/playbook"
                    variant="secondary"
                    size="sm"
                    iconLeft={<Icon name="book" className="size-4" />}
                  >
                    Your Recovery Playbook
                  </ButtonLink>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
