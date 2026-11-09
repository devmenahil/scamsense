import type { z } from "zod";
import type { slotSchema } from "./schema";

type SlotInput = z.input<typeof slotSchema>;

/**
 * The "everyday email" personalization slots shared by the mail-based scenarios (Step 8). The message sits in the
 * inbox next to the scenario's own messages so the inbox feels like the player's: a school, client, club, supplier,
 * or shop from their own life. It is never evidence, never mentions money, accounts, or security, and its sender
 * domain is a fictional `.example` label validated against the scenario's real domains.
 */
export function everydayEmailSlots(defaults: {
  senderName: string;
  domain: string;
  subject: string;
  preview: string;
  body: string;
}): SlotInput[] {
  return [
    {
      name: "otherSenderName",
      kind: "name",
      default: defaults.senderName,
      maxLength: 40,
      purpose:
        "A fictional organization from the player's everyday life (their school, a client, a club, a supplier, a shop, a community group).",
    },
    {
      name: "otherDomain",
      kind: "domainLabel",
      default: defaults.domain,
      maxLength: 30,
      purpose:
        "That organization's fictional web-address label, e.g. 'westbrook-college' (lower case, hyphens).",
    },
    {
      name: "otherSubject",
      default: defaults.subject,
      maxLength: 60,
      purpose: "Subject of that organization's ordinary email. Not about payments, accounts, or security.",
    },
    {
      name: "otherPreview",
      default: defaults.preview,
      maxLength: 70,
      purpose: "The inbox preview line of that email (its first words, ending with …).",
    },
    {
      name: "otherBody",
      default: defaults.body,
      maxLength: 160,
      purpose: "The short body of that email: one or two friendly sentences matching the subject.",
    },
  ];
}
