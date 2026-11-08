import { MarketingHeader } from "@/components/layout/MarketingHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingHeader minimal />
      <main id="main" className="flex-1 bg-mist">
        <div className="container-page py-10 sm:py-16">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}
