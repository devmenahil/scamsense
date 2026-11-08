import { MarketingHeader } from "@/components/layout/MarketingHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
