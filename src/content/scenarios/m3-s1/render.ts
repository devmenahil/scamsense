import type { ScenarioRenderInput } from "../schema";
import { everydayEmailSlots } from "../slots";

/**
 * M3-S1 — The Job Opportunity (chat and email simulator with a browser for independent checks). Client-safe (R10).
 * Talentbridge Staffing, Meridian Logistics, QuickTalk, ProEquip, Findly and WorkLink are fictional. Several decision
 * points: continue to the onboarding chat, question the recruiter, verify the employer, then decide.
 */
export const render: ScenarioRenderInput = {
  scenarioKey: "m3-s1",
  contentVersion: "2026-11-12.step8",
  interfaceType: "chat_email",
  introLine: "You've received an update about a job opportunity.",
  startAppId: "mail",
  slots: [
    {
      name: "jobTitle",
      default: "Remote Operations Coordinator",
      maxLength: 48,
      purpose:
        "The offered remote role, matched to the player's occupation, skills, or goal (an operations or support-style job title, no company name).",
    },
    ...everydayEmailSlots({
      senderName: "Harbor City Transit",
      domain: "harborcitytransit",
      subject: "Weekend service changes",
      preview: "Line 4 runs every 20 minutes this weekend…",
      body: "Line 4 runs every 20 minutes this weekend while track work is completed.",
    }),
  ],
  amountParts: { salary: 110_000 },
  checkout: { payee: "ProEquip Onboarding Services", description: "Remote equipment deposit MRD-ONB-5521" },
  apps: [
    {
      type: "mail",
      id: "mail",
      label: "Mail",
      icon: "mail",
      accountAddress: "me@inkwell-mail.example",
      messages: [
        {
          id: "offer",
          from: {
            name: "Dana Whitfield · Talentbridge Staffing",
            address: "dana.whitfield@talentbridge-careers.example",
          },
          fromAnchor: "recruiter_address",
          to: "me@inkwell-mail.example",
          subject: "Next steps: {{jobTitle}} at Meridian Logistics",
          subjectAnchor: "offer_subject",
          listDate: "7:48 AM",
          fullDate: "Today, 7:48 AM",
          preview: "Great news: Meridian Logistics would like to offer you…",
          unread: true,
          detailsActionId: "check_recruiter_details",
          body: [
            { type: "p", text: "Hi {{playerName}}," },
            {
              type: "p",
              text: "Great news! Following your text interview on Thursday, Meridian Logistics would like to offer you the {{jobTitle}} role: fully remote, starting at {{amount.salary}} per month.",
              anchor: "offer_paragraph",
            },
            {
              type: "p",
              text: "They'd love you to start next Monday. To keep things moving, onboarding happens on QuickTalk, where I'll walk you through equipment setup.",
            },
            {
              type: "link",
              style: "button",
              text: "Continue on QuickTalk",
              url: "https://quicktalk.example/c/talentbridge-onboarding",
              anchor: "chat_link",
              actionId: "open_onboarding_chat",
              opens: { appId: "chat" },
            },
            {
              type: "p",
              text: "Please confirm today: the offer is held for 24 hours.",
              anchor: "confirm_paragraph",
            },
            { type: "small", text: "Dana Whitfield · Senior Talent Partner · Talentbridge Staffing" },
          ],
          decisionIds: ["decline_offer", "report_recruiter"],
        },
        {
          id: "application",
          from: { name: "WorkLink Jobs", address: "alerts@worklink.example" },
          fromAnchor: "application_sender",
          to: "me@inkwell-mail.example",
          subject: "Application sent: Operations Assistant at Meridian Logistics",
          listDate: "Oct 28",
          fullDate: "Oct 28, 5:02 PM",
          preview: "Your application for Operations Assistant was sent…",
          openActionId: "open_application_email",
          body: [
            { type: "p", text: "Your application was sent. Good luck!" },
            {
              type: "kv",
              anchor: "application_details",
              rows: [
                { label: "Role", value: "Operations Assistant (on-site, Harbor City hub)" },
                { label: "Company", value: "Meridian Logistics" },
                { label: "Applied", value: "Oct 28" },
              ],
            },
          ],
        },
        {
          id: "newsletter",
          from: { name: "{{otherSenderName}}", address: "hello@{{otherDomain}}.example" },
          fromAnchor: "newsletter_sender",
          to: "me@inkwell-mail.example",
          subject: "{{otherSubject}}",
          listDate: "Oct 25",
          fullDate: "Oct 25, 9:00 AM",
          preview: "{{otherPreview}}",
          body: [{ type: "p", text: "{{otherBody}}" }],
        },
      ],
    },
    {
      type: "messages",
      id: "chat",
      label: "QuickTalk",
      icon: "chat",
      threads: [
        {
          id: "recruiter",
          requires: ["open_onboarding_chat"],
          contact: {
            name: "Dana W. (Talentbridge)",
            subtitle: "QuickTalk",
            initials: "DW",
            anchor: "chat_contact",
            detailsActionId: "check_chat_profile",
            details: [
              { label: "Account created", value: "3 weeks ago" },
              { label: "Business profile", value: "Not set up" },
              { label: "Shared groups", value: "None" },
            ],
          },
          preview: "Welcome aboard!",
          time: "7:52 AM",
          unread: true,
          messages: [
            {
              id: "r1",
              from: "contact",
              time: "7:52 AM",
              text: "Welcome aboard, {{playerName}}! 🎉 So glad you're joining Meridian.",
            },
            {
              id: "r2",
              from: "contact",
              time: "7:52 AM",
              anchor: "onboarding_message",
              text: "Before your contract is issued, every new hire completes equipment setup. Our logistics partner ships your work laptop and headset once the refundable equipment deposit of {{amount}} is processed. It's refunded with your first paycheck.",
            },
          ],
          branches: [
            {
              actionId: "ask_contract_first",
              label: "Can I see the contract first?",
              messages: [
                { id: "c1", from: "me", text: "Could I see the contract before paying anything?" },
                {
                  id: "c2",
                  from: "contact",
                  anchor: "contract_reply",
                  text: "The contract is generated automatically once onboarding is complete. That's just how the system works, and it's standard for remote roles.",
                },
              ],
            },
            {
              actionId: "ask_hiring_manager",
              label: "Can I have a video call with the hiring manager?",
              messages: [
                { id: "h1", from: "me", text: "Could I have a quick video call with the hiring manager?" },
                {
                  id: "h2",
                  from: "contact",
                  anchor: "manager_reply",
                  text: "She's travelling this week, so I'm handling all onboarding for her. You'll meet the whole team on your first day!",
                },
              ],
            },
            {
              actionId: "ask_why_fee",
              label: "Why do I pay for my own equipment?",
              messages: [
                { id: "f1", from: "me", text: "Why do I need to pay for my own work equipment?" },
                {
                  id: "f2",
                  from: "contact",
                  anchor: "deposit_reply",
                  text: "It's only a deposit so people don't keep the equipment and disappear. Spots are filling fast and I'd hate for you to lose this one.",
                },
              ],
            },
            {
              actionId: "ask_payment_details",
              label: "How would I pay?",
              messages: [
                { id: "p1", from: "me", text: "How would I pay the deposit?" },
                {
                  id: "p2",
                  from: "contact",
                  text: "Here's the request from our equipment partner. Once it's paid I'll send your contract and start date the same day.",
                },
                {
                  id: "p3",
                  from: "contact",
                  attachment: {
                    kind: "payment_request",
                    anchor: "payment_request",
                    title: "Payment request",
                    payee: "ProEquip Onboarding Services",
                    amount: "{{amount}}",
                    rows: [
                      { label: "Reference", value: "MRD-ONB-5521" },
                      { label: "For", value: "Remote equipment deposit (refundable)" },
                    ],
                  },
                },
              ],
            },
          ],
          decisionIds: ["pay_fee", "decline_offer", "report_recruiter"],
        },
      ],
    },
    {
      type: "browser",
      id: "browser",
      label: "Browser",
      icon: "search",
      homePageId: "search",
      pages: [
        {
          id: "search",
          url: "https://www.findly.example/search?q=meridian+logistics+careers",
          title: "meridian logistics careers – Findly",
          site: { name: "Findly", mark: "F", tagline: "Search" },
          addressAnchor: "search_address",
          connection: "Connection is encrypted. Certificate issued to www.findly.example.",
          blocks: [
            {
              type: "search",
              query: "meridian logistics careers",
              results: [
                {
                  title: "Careers – Meridian Logistics",
                  url: "www.meridianlogistics.example/careers",
                  snippet: "Open roles at our Harbor City hub and offices, and how our hiring process works.",
                  pageId: "careers",
                },
                {
                  title: "Talentbridge Staffing – Remote jobs, fast",
                  url: "talentbridge-careers.example",
                  snippet: "We connect talent with remote opportunities in under a week.",
                  pageId: "agency",
                },
                {
                  title: "Dana Whitfield – WorkLink profile",
                  url: "www.worklink.example/in/dana-whitfield-talent",
                  snippet: "Senior Talent Partner at Talentbridge Staffing.",
                  pageId: "recruiter_profile",
                },
              ],
            },
          ],
        },
        {
          id: "careers",
          url: "https://www.meridianlogistics.example/careers",
          title: "Careers – Meridian Logistics",
          site: { name: "Meridian Logistics", mark: "ML", tagline: "Careers" },
          addressAnchor: "company_domain",
          visitActionId: "open_company_careers",
          connection: "Connection is encrypted. Certificate issued to www.meridianlogistics.example.",
          blocks: [
            {
              type: "hero",
              title: "Careers at Meridian Logistics",
              text: "Build the supply chains your city relies on.",
            },
            {
              type: "list",
              title: "Open roles",
              anchor: "company_roles",
              items: [
                { title: "Operations Assistant", meta: "Harbor City hub · On-site" },
                { title: "Warehouse Team Lead", meta: "Harbor City hub · On-site" },
                { title: "Fleet Planner", meta: "Head office · Hybrid" },
              ],
            },
            {
              type: "text",
              title: "How we hire",
              anchor: "company_hiring",
              paras: [
                "Every candidate meets the hiring manager on a video call.",
                "Offers come from an @meridianlogistics.example address, with your contract attached.",
                "Employees receive their equipment from us at no cost.",
              ],
            },
          ],
        },
        {
          id: "agency",
          url: "https://talentbridge-careers.example",
          title: "Talentbridge Staffing",
          site: { name: "Talentbridge Staffing", mark: "TB", tagline: "Remote jobs, fast" },
          addressAnchor: "agency_domain",
          visitActionId: "open_agency_site",
          connection: "Connection is encrypted. Certificate issued to talentbridge-careers.example.",
          blocks: [
            {
              type: "hero",
              title: "Remote jobs, fast",
              text: "We place candidates with leading companies in under a week.",
            },
            {
              type: "kv",
              title: "About us",
              anchor: "agency_details",
              rows: [
                { label: "Office", value: "Remote-first" },
                { label: "Contact", value: "Chat with us on QuickTalk" },
                { label: "Clients", value: "Available on request" },
              ],
            },
          ],
        },
        {
          id: "recruiter_profile",
          url: "https://www.worklink.example/in/dana-whitfield-talent",
          title: "Dana Whitfield – WorkLink",
          site: { name: "WorkLink", mark: "WL", tagline: "Professional network" },
          addressAnchor: "profile_domain",
          visitActionId: "open_recruiter_profile",
          connection: "Connection is encrypted. Certificate issued to www.worklink.example.",
          blocks: [
            {
              type: "profile",
              name: "Dana Whitfield",
              headline: "Senior Talent Partner at Talentbridge Staffing",
              initials: "DW",
              anchor: "recruiter_profile",
              rows: [
                { label: "Joined WorkLink", value: "3 weeks ago" },
                { label: "Connections", value: "12" },
                { label: "Experience listed", value: "Talentbridge Staffing (current)" },
              ],
            },
          ],
        },
      ],
    },
  ],
  actions: [
    { id: "check_recruiter_details", kind: "investigate", label: "Checked the recruiter's email address" },
    {
      id: "open_application_email",
      kind: "investigate",
      label: "Compared with the original job application",
    },
    { id: "open_onboarding_chat", kind: "interact", label: "Continued to the onboarding chat" },
    {
      id: "check_chat_profile",
      kind: "investigate",
      label: "Checked the recruiter's chat profile",
      requires: ["open_onboarding_chat"],
    },
    {
      id: "ask_contract_first",
      kind: "investigate",
      label: "Asked to see the contract first",
      requires: ["open_onboarding_chat"],
    },
    {
      id: "ask_hiring_manager",
      kind: "investigate",
      label: "Asked for a call with the hiring manager",
      requires: ["open_onboarding_chat"],
    },
    {
      id: "ask_why_fee",
      kind: "investigate",
      label: "Asked why a fee was needed",
      requires: ["open_onboarding_chat"],
    },
    {
      id: "ask_payment_details",
      kind: "interact",
      label: "Asked how to pay",
      requires: ["open_onboarding_chat"],
    },
    { id: "open_company_careers", kind: "investigate", label: "Opened the company's own careers page" },
    { id: "open_agency_site", kind: "investigate", label: "Opened the staffing agency's website" },
    { id: "open_recruiter_profile", kind: "investigate", label: "Looked up the recruiter's public profile" },
  ],
  decisions: [
    {
      id: "pay_fee",
      kind: "pay",
      intent: "pay",
      label: "Pay request",
      summary: "Pay the {{amount}} equipment deposit to ProEquip Onboarding Services",
      requires: ["ask_payment_details"],
    },
    {
      id: "decline_offer",
      kind: "other",
      intent: "decline",
      label: "Decline offer",
      summary: "Decline the offer and stop the process",
    },
    {
      id: "report_recruiter",
      kind: "other",
      intent: "report",
      label: "Report recruiter",
      summary: "Report the recruiter's messages",
    },
  ],
};
