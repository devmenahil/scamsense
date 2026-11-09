import type { ScenarioRenderInput } from "../schema";
import { everydayEmailSlots } from "../slots";

/**
 * M2-S1 — An Invoice Has Arrived (invoice and payment-request simulator). Client-safe (R10).
 * Brightline Cloud is fictional. The invoice is deliberately polished: no spelling mistakes, consistent numbering.
 * Paying it is a decision that leads to the PayPal Sandbox checkout boundary (Step 7).
 */
export const render: ScenarioRenderInput = {
  scenarioKey: "m2-s1",
  contentVersion: "2026-11-12.step8",
  interfaceType: "invoice",
  introLine: "A new invoice has arrived in your inbox.",
  startAppId: "mail",
  amountParts: { upgrade: 7_200, previous: 1_600, coffee: 120 },
  // Narrative-only personalization (Step 8). None of these elements is evidence.
  slots: [
    {
      name: "workspaceName",
      default: "Personal files and photo backups",
      maxLength: 48,
      purpose:
        "What the player keeps in their Brightline Cloud storage, fitting their life (e.g. 'Coursework and thesis drafts', 'Client artwork and project files').",
    },
    ...everydayEmailSlots({
      senderName: "Harbor Coffee Co.",
      domain: "harborcoffee",
      subject: "Your order is ready for pickup",
      preview: "One oat flat white, ready at the counter…",
      body: "One oat flat white, ready at the counter.",
    }),
  ],
  checkout: { payee: "Brightline Billing Services LLC", description: "Invoice BLC-2611-0932" },
  apps: [
    {
      type: "mail",
      id: "mail",
      label: "Mail",
      icon: "mail",
      accountAddress: "me@inkwell-mail.example",
      messages: [
        {
          id: "new_invoice",
          from: { name: "Brightline Cloud Billing", address: "billing@brightline-cloud.example" },
          fromAnchor: "sender_address",
          replyTo: "accounts@brightline-billing.example",
          to: "me@inkwell-mail.example",
          subject: "Invoice BLC-2611-0932 for your Brightline Cloud account",
          subjectAnchor: "email_subject",
          listDate: "8:03 AM",
          fullDate: "Today, 8:03 AM",
          preview: "Your annual plan upgrade has been processed…",
          unread: true,
          detailsActionId: "check_sender_details",
          body: [
            { type: "p", text: "Hello {{playerName}}," },
            {
              type: "p",
              text: "Thank you for choosing Brightline Cloud. Your annual Business plan upgrade has been processed. Please find invoice BLC-2611-0932 attached.",
              anchor: "upgrade_paragraph",
            },
            {
              type: "p",
              text: "Payment is due within 3 days to avoid any interruption to your storage and backups.",
              anchor: "due_paragraph",
            },
            {
              type: "p",
              text: "Please note that we have moved to a new payment processor, so the card saved on your account can't be charged for this invoice. Payment instructions are on the invoice.",
              anchor: "processor_paragraph",
            },
            {
              type: "small",
              text: "Brightline Cloud Inc. · 88 Harbor Street, Suite 400, Harbor City · Billing questions: +1 555-0164",
              anchor: "email_footer",
            },
          ],
          attachments: [
            {
              kind: "document",
              name: "BLC-2611-0932.pdf",
              size: "84 KB",
              anchor: "invoice_attachment",
              actionId: "open_invoice",
              invoice: {
                anchor: "invoice_document",
                issuer: {
                  name: "Brightline Cloud Inc.",
                  lines: ["88 Harbor Street, Suite 400", "Harbor City", "billing@brightline-cloud.example"],
                  anchor: "invoice_issuer",
                },
                billTo: { name: "{{playerName}}", lines: ["me@inkwell-mail.example", "Account BC-20417"] },
                number: "BLC-2611-0932",
                numberAnchor: "invoice_reference",
                issueDate: "Nov 9",
                dueDate: "Nov 12",
                dueAnchor: "invoice_due",
                reference: "Account BC-20417",
                items: [
                  {
                    description: "Business plan upgrade (annual)",
                    detail: "12 months from Nov 9",
                    quantity: "1",
                    amount: "{{amount.upgrade}}",
                  },
                  {
                    description: "Priority support add-on (annual)",
                    detail: "12 months from Nov 9",
                    quantity: "1",
                    amount: "{{amount.minus.upgrade}}",
                  },
                ],
                subtotal: "{{amount}}",
                tax: "Not applicable",
                total: "{{amount}}",
                totalAnchor: "invoice_total",
                paymentInstructions: {
                  title: "How to pay",
                  anchor: "payment_instructions",
                  lines: [
                    "Pay online with the Pay invoice button, or by bank transfer to:",
                    "Brightline Billing Services LLC · account ending 2290",
                    "Please include the invoice number as your payment reference.",
                  ],
                },
                notes: [
                  {
                    text: "Didn't authorize this upgrade? Call our billing team within 24 hours at +1 555-0164 to avoid charges.",
                    anchor: "invoice_phone_note",
                  },
                  { text: "Thank you for your business." },
                ],
                decisionIds: ["pay_invoice"],
              },
            },
          ],
          decisionIds: ["report_invoice", "delete_invoice"],
        },
        {
          id: "previous_receipt",
          from: { name: "Brightline Cloud", address: "billing@brightlinecloud.example" },
          fromAnchor: "previous_sender",
          to: "me@inkwell-mail.example",
          subject: "Your Brightline Cloud receipt BLC-2610-4471",
          listDate: "Oct 9",
          fullDate: "Oct 9, 6:00 AM",
          preview: "Thanks for your payment. Plan: Starter (monthly)…",
          openActionId: "open_previous_receipt",
          body: [
            { type: "p", text: "Hi {{playerName}}, thanks for your payment." },
            {
              type: "kv",
              anchor: "previous_receipt_details",
              rows: [
                { label: "Plan", value: "Starter (monthly)" },
                { label: "Workspace", value: "{{workspaceName}}" },
                { label: "Amount", value: "{{amount.previous}}" },
                { label: "Paid with", value: "Card ending 1182 (automatic)" },
                { label: "Receipt", value: "BLC-2610-4471" },
              ],
            },
            {
              type: "small",
              text: "Your plan renews automatically with your saved card. Manage billing at brightlinecloud.example.",
              anchor: "receipt_footer",
            },
          ],
        },
        {
          id: "coffee",
          from: { name: "{{otherSenderName}}", address: "hello@{{otherDomain}}.example" },
          fromAnchor: "coffee_sender",
          to: "me@inkwell-mail.example",
          subject: "{{otherSubject}}",
          listDate: "Nov 7",
          fullDate: "Nov 7, 8:20 AM",
          preview: "{{otherPreview}}",
          body: [
            {
              type: "p",
              text: "{{otherBody}} Total {{amount.coffee}}, paid in the app.",
            },
          ],
        },
      ],
    },
    {
      type: "browser",
      id: "browser",
      label: "Browser",
      icon: "search",
      homePageId: "newtab",
      bookmarks: [{ label: "Brightline Cloud", pageId: "portal_billing" }],
      pages: [
        {
          id: "newtab",
          url: "https://newtab.inkwell.example",
          title: "New tab",
          site: { name: "New tab", mark: "N" },
          addressAnchor: "newtab_address",
          connection: "This is your browser's start page.",
          blocks: [
            { type: "hero", title: "Good morning", text: "Open a shortcut to get started." },
            {
              type: "list",
              title: "Shortcuts",
              items: [
                { title: "Brightline Cloud", meta: "app.brightlinecloud.example", pageId: "portal_billing" },
              ],
            },
          ],
        },
        {
          id: "portal_billing",
          url: "https://app.brightlinecloud.example/billing",
          title: "Brightline Cloud – Billing",
          site: { name: "Brightline Cloud", mark: "BC", tagline: "Account" },
          addressAnchor: "portal_domain",
          visitActionId: "open_brightline_bookmark",
          connection: "Connection is encrypted. Certificate issued to app.brightlinecloud.example.",
          nav: [
            { label: "Billing", pageId: "portal_billing" },
            { label: "Support", pageId: "portal_support" },
          ],
          blocks: [
            { type: "hero", title: "Billing", text: "Signed in as {{playerName}} · Account BC-20417" },
            {
              type: "kv",
              title: "Your plan",
              anchor: "portal_plan",
              rows: [
                { label: "Plan", value: "Starter (monthly)" },
                { label: "Workspace", value: "{{workspaceName}}" },
                { label: "Next payment", value: "{{amount.previous}} on Dec 9" },
                { label: "Payment method", value: "Card ending 1182 (automatic)" },
                { label: "Outstanding balance", value: "None" },
              ],
            },
            {
              type: "table",
              title: "Invoices",
              anchor: "portal_invoices",
              columns: ["Invoice", "Date", "Amount", "Status"],
              rows: [
                ["BLC-2610-4471", "Oct 9", "{{amount.previous}}", "Paid"],
                ["BLC-2609-3318", "Sep 9", "{{amount.previous}}", "Paid"],
              ],
            },
          ],
        },
        {
          id: "portal_support",
          url: "https://app.brightlinecloud.example/support",
          title: "Brightline Cloud – Support",
          site: { name: "Brightline Cloud", mark: "BC", tagline: "Account" },
          addressAnchor: "portal_support_domain",
          visitActionId: "check_portal_support",
          connection: "Connection is encrypted. Certificate issued to app.brightlinecloud.example.",
          nav: [
            { label: "Billing", pageId: "portal_billing" },
            { label: "Support", pageId: "portal_support" },
          ],
          blocks: [
            {
              type: "kv",
              title: "Contact support",
              anchor: "portal_contact",
              rows: [
                { label: "Phone", value: "+1 555-0110 (Mon–Fri, 8 AM–6 PM)" },
                { label: "Billing email", value: "billing@brightlinecloud.example" },
              ],
            },
            {
              type: "list",
              title: "Billing questions",
              items: [
                {
                  title: "How are invoices paid?",
                  text: "With the card saved in your account. You can change it under Billing → Payment method.",
                },
                { title: "Changing plans", text: "Upgrades are made by you under Billing → Change plan." },
              ],
            },
          ],
        },
      ],
    },
  ],
  actions: [
    { id: "check_sender_details", kind: "investigate", label: "Checked the sender's address" },
    { id: "open_invoice", kind: "interact", label: "Opened the attached invoice" },
    { id: "open_previous_receipt", kind: "investigate", label: "Compared with last month's receipt" },
    {
      id: "open_brightline_bookmark",
      kind: "investigate",
      label: "Opened the Brightline account from a saved shortcut",
    },
    {
      id: "check_portal_support",
      kind: "investigate",
      label: "Checked the support details in the Brightline account",
    },
  ],
  decisions: [
    {
      id: "pay_invoice",
      kind: "pay",
      intent: "pay",
      label: "Pay invoice",
      summary: "Pay invoice BLC-2611-0932 ({{amount}}) to Brightline Billing Services LLC",
      requires: ["open_invoice"],
    },
    {
      id: "report_invoice",
      kind: "other",
      intent: "report",
      label: "Report message",
      summary: "Report the invoice email to your mail provider",
    },
    {
      id: "delete_invoice",
      kind: "other",
      intent: "decline",
      label: "Delete",
      summary: "Delete the email without paying",
    },
  ],
};
