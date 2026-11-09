import type { ScenarioRenderInput } from "../schema";

/**
 * M1-S2 — Your Account Needs Attention (email client + fictional web browser). Client-safe (R10).
 * "Space Bank" is fictional. Both addresses use the reserved `.example` TLD (R29). The page reached from the email has
 * no sign-in form and collects nothing (R33, Step 6 brief §3B): its only control is a decision.
 */
export const render: ScenarioRenderInput = {
  scenarioKey: "m1-s2",
  contentVersion: "2026-11-10.step6",
  interfaceType: "web_browser",
  introLine: "You receive a notification about your account.",
  startAppId: "mail",
  amountParts: { balance: 52_000, rent: 18_000, salary: 31_000 },
  apps: [
    {
      type: "mail",
      id: "mail",
      label: "Mail",
      icon: "mail",
      accountAddress: "me@inkwell-mail.example",
      messages: [
        {
          id: "access_notice",
          from: { name: "Space Bank", address: "alerts@spasebank.example" },
          fromAnchor: "sender_address",
          replyTo: "support@spasebank.example",
          to: "me@inkwell-mail.example",
          subject: "Action needed: your online banking access is limited",
          subjectAnchor: "email_subject",
          listDate: "9:12 AM",
          fullDate: "Today, 9:12 AM",
          preview: "We detected a sign-in from a device we don't recognize…",
          unread: true,
          detailsActionId: "check_sender_details",
          body: [
            { type: "p", text: "Dear customer,", anchor: "greeting" },
            {
              type: "p",
              text: "We detected a sign-in to your online banking from a device we don't recognize. As a precaution, transfers and card payments on your account have been limited.",
              anchor: "notice_body",
            },
            {
              type: "p",
              text: "To restore full access, confirm your account within 24 hours. After that, online banking will be suspended until you visit a branch.",
              anchor: "restore_timeframe",
            },
            {
              type: "link",
              style: "button",
              text: "Restore access",
              url: "https://spasebank.example/restore?ref=SB-77231",
              anchor: "email_button",
              actionId: "open_email_link",
              opens: { appId: "browser", pageId: "restore" },
            },
            { type: "small", text: "Space Bank · 400 Orbit Avenue · This is an automated message." },
          ],
          decisionIds: ["report_email", "delete_email"],
        },
        {
          id: "statement",
          from: { name: "Space Bank", address: "statements@spacebank.example" },
          fromAnchor: "previous_sender_address",
          to: "me@inkwell-mail.example",
          subject: "Your October statement is ready",
          listDate: "Nov 1",
          fullDate: "Nov 1, 7:00 AM",
          preview: "Your October statement for the checking account ending 4471…",
          openActionId: "open_previous_email",
          body: [
            { type: "p", text: "Hi {{playerName}},", anchor: "previous_greeting" },
            {
              type: "p",
              text: "Your October statement for the checking account ending 4471 is ready. Open the Space Bank app or go to spacebank.example to view it.",
            },
            {
              type: "small",
              text: "For your security, our emails never contain sign-in links. Space Bank · 400 Orbit Avenue.",
              anchor: "statement_footer",
            },
          ],
        },
        {
          id: "library",
          from: { name: "Riverside Community Library", address: "events@riverside-library.example" },
          fromAnchor: "library_sender",
          to: "me@inkwell-mail.example",
          subject: "Reminder: book club on Thursday",
          listDate: "Oct 30",
          fullDate: "Oct 30, 4:15 PM",
          preview: "This month we're reading a mystery novel…",
          body: [
            {
              type: "p",
              text: "This month we're reading a mystery novel. See you Thursday at 6 PM in Room B.",
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
      bookmarks: [{ label: "Space Bank", pageId: "bank_home" }],
      pages: [
        {
          id: "newtab",
          url: "https://newtab.inkwell.example",
          title: "New tab",
          site: { name: "New tab", mark: "N" },
          addressAnchor: "newtab_address",
          connection: "This is your browser's start page.",
          blocks: [
            { type: "hero", title: "Good morning", text: "Open a shortcut or a link to get started." },
            {
              type: "list",
              title: "Shortcuts",
              items: [{ title: "Space Bank", meta: "spacebank.example", pageId: "bank_home" }],
            },
          ],
        },
        {
          id: "restore",
          requires: ["open_email_link"],
          url: "https://spasebank.example/restore?ref=SB-77231",
          title: "Space Bank – Restore access",
          site: { name: "Space Bank", mark: "SB", tagline: "Online banking" },
          addressAnchor: "displayed_domain",
          inspectActionId: "inspect_address",
          connection: "Connection is encrypted. Certificate issued to spasebank.example.",
          blocks: [
            {
              type: "notice",
              title: "Your online banking access is limited",
              text: "Restore access in two short steps to keep using transfers and card payments.",
              anchor: "page_notice",
            },
            {
              type: "list",
              title: "What happens next",
              items: [
                { title: "Step 1", text: "Confirm your identity." },
                { title: "Step 2", text: "Review your recent activity." },
              ],
            },
            {
              type: "actions",
              items: [
                { label: "Start verification", decisionId: "continue_verification", anchor: "verify_button" },
              ],
            },
            {
              type: "text",
              title: "Need help?",
              paras: ["Our team is available 24/7 at support@spasebank.example."],
              anchor: "page_contact",
            },
          ],
        },
        {
          id: "bank_home",
          url: "https://www.spacebank.example/",
          title: "Space Bank – Overview",
          site: { name: "Space Bank", mark: "SB", tagline: "Online banking" },
          addressAnchor: "bank_domain",
          inspectActionId: "inspect_bank_address",
          visitActionId: "open_bank_bookmark",
          connection: "Connection is encrypted. Certificate issued to www.spacebank.example.",
          nav: [
            { label: "Overview", pageId: "bank_home" },
            { label: "Messages", pageId: "bank_messages" },
          ],
          blocks: [
            {
              type: "hero",
              title: "Welcome back, {{playerName}}",
              text: "You're signed in on this browser.",
            },
            {
              type: "kv",
              title: "Checking ••4471",
              anchor: "account_status",
              rows: [
                { label: "Available balance", value: "{{amount.balance}}" },
                { label: "Account status", value: "Active" },
                { label: "Transfers and card payments", value: "Available" },
              ],
            },
            {
              type: "table",
              title: "Recent activity",
              columns: ["Date", "Description", "Amount"],
              rows: [
                ["Nov 3", "Rent – Oakview Homes", "−{{amount.rent}}"],
                ["Oct 31", "Salary", "+{{amount.salary}}"],
              ],
            },
          ],
        },
        {
          id: "bank_messages",
          url: "https://www.spacebank.example/messages",
          title: "Space Bank – Messages",
          site: { name: "Space Bank", mark: "SB", tagline: "Online banking" },
          addressAnchor: "messages_domain",
          visitActionId: "check_bank_messages",
          connection: "Connection is encrypted. Certificate issued to www.spacebank.example.",
          nav: [
            { label: "Overview", pageId: "bank_home" },
            { label: "Messages", pageId: "bank_messages" },
          ],
          blocks: [
            {
              type: "text",
              title: "Messages",
              paras: ["You have no new messages."],
              anchor: "bank_messages",
            },
            {
              type: "list",
              title: "Security tips",
              items: [
                { title: "Signing in", text: "Type spacebank.example yourself or use the Space Bank app." },
                {
                  title: "Account notices",
                  text: "Important notices about your account always appear here.",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
  actions: [
    { id: "check_sender_details", kind: "investigate", label: "Checked the sender's address" },
    { id: "open_previous_email", kind: "investigate", label: "Compared with an earlier email from the bank" },
    { id: "open_email_link", kind: "interact", label: "Opened the link in the email" },
    {
      id: "inspect_address",
      kind: "investigate",
      label: "Inspected the web address of the page from the email",
    },
    { id: "open_bank_bookmark", kind: "investigate", label: "Opened the bank's site from a saved shortcut" },
    { id: "inspect_bank_address", kind: "investigate", label: "Inspected the bank site's web address" },
    { id: "check_bank_messages", kind: "investigate", label: "Checked messages on the bank's own site" },
  ],
  decisions: [
    {
      id: "continue_verification",
      kind: "other",
      intent: "continue_on_site",
      label: "Start verification",
      summary: "Continue with the account verification on the page from the email",
      requires: ["open_email_link"],
    },
    {
      id: "report_email",
      kind: "other",
      intent: "report",
      label: "Report message",
      summary: "Report the email to your mail provider",
    },
    {
      id: "delete_email",
      kind: "other",
      intent: "decline",
      label: "Delete",
      summary: "Delete the email without acting on it",
    },
  ],
};
