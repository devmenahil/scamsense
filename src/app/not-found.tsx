import { LogoSymbol } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main
      id="main"
      className="container-page flex flex-1 flex-col items-center justify-center py-20 text-center"
    >
      <LogoSymbol className="w-16" />
      <h1 className="mt-6 text-heading font-extrabold">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-teal/85">
        The link may be out of date. Let&apos;s get you back on track.
      </p>
      <ButtonLink href="/" className="mt-8">
        Go to home
      </ButtonLink>
    </main>
  );
}
