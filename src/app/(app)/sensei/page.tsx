import type { Metadata } from "next";
import { SenseiChat } from "@/components/chat/SenseiChat";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Sensei Kenshi" };

export default function SenseiPage() {
  return (
    <div className="container-page py-8 sm:py-12">
      <DemoNotice className="mb-6">
        Sensei Kenshi isn&apos;t connected yet. Replies are a fixed offline message, and nothing you type is
        sent or stored.
      </DemoNotice>
      <PageHeader
        eyebrow="Sensei Kenshi"
        title="Ask your learning guide"
        description="Questions about finished scenarios, scam tactics, or PayPal features. Sensei Kenshi points to official sources for policy questions and never invents rules or guarantees."
        className="mb-6"
      />
      <SenseiChat />
    </div>
  );
}
