import type { ScenarioRenderInput } from "../schema";

/**
 * M1-S1 — The Security Check (chat simulator). Client-safe: environment only, no judgments (R10).
 * TandemPay is a fictional payment app (R29, R34). The verification code shown is fictional and non-sensitive; the
 * player never types a code anywhere (R33).
 */
export const render: ScenarioRenderInput = {
  scenarioKey: "m1-s1",
  contentVersion: "2026-11-10.step6",
  interfaceType: "chat_email",
  introLine: "You receive a message about your payment account.",
  startAppId: "messages",
  amountParts: { balance: 64_000, grocery: 1_150, transfer: 9_000 },
  apps: [
    {
      type: "messages",
      id: "messages",
      label: "Messages",
      icon: "chat",
      threads: [
        {
          id: "support",
          contact: {
            name: "TandemPay Support",
            subtitle: "+1 555-0137",
            initials: "TS",
            anchor: "sender_number",
            detailsActionId: "check_sender_details",
            details: [
              { label: "Number", value: "+1 555-0137", anchor: "sender_number_detail" },
              { label: "Saved contact", value: "No" },
              { label: "First message", value: "Today, 10:42 AM" },
            ],
          },
          preview: "We flagged a payment from your TandemPay account…",
          time: "10:42 AM",
          unread: true,
          messages: [
            {
              id: "s1",
              from: "contact",
              time: "10:42 AM",
              anchor: "first_message",
              text: "TandemPay Account Security: Hi {{playerName}}, we flagged a payment of {{amount}} from your TandemPay account to a new recipient (L. Novak). If you didn't make this payment, reply here and we'll stop it.",
            },
          ],
          branches: [
            {
              actionId: "ask_which_payment",
              label: "Which payment?",
              messages: [
                { id: "w1", from: "me", text: "Which payment are you talking about?" },
                {
                  id: "w2",
                  from: "contact",
                  anchor: "payment_details_reply",
                  text: "A transfer of {{amount}} to L. Novak, submitted today at 10:39 AM from a new device. It's still pending, so we can stop it if you act now.",
                },
              ],
            },
            {
              actionId: "reply_not_me",
              label: "That wasn't me",
              messages: [
                { id: "n1", from: "me", text: "That wasn't me. Please stop it." },
                {
                  id: "n2",
                  from: "contact",
                  anchor: "code_request",
                  text: "Thanks for confirming. To cancel the payment I need to check that you're the account holder. I've just sent a 6-digit verification code to this phone. Reply with it here and I'll stop the transfer.",
                },
                {
                  id: "n3",
                  from: "contact",
                  anchor: "followup_message",
                  text: "Please be quick: if we don't hear back within 5 minutes the payment completes and can't be reversed.",
                },
              ],
            },
            {
              actionId: "ask_why_code",
              label: "Why do you need the code?",
              requires: ["reply_not_me"],
              messages: [
                { id: "c1", from: "me", text: "Why do you need the code?" },
                {
                  id: "c2",
                  from: "contact",
                  anchor: "code_reply",
                  text: "It's our standard identity check. The code proves you're the account holder, so I can cancel the transfer from our side.",
                },
              ],
            },
            {
              actionId: "ask_call_app_number",
              label: "I'll call the number in my app instead",
              requires: ["reply_not_me"],
              messages: [
                {
                  id: "o1",
                  from: "me",
                  text: "I'd rather call the support number listed in my TandemPay app.",
                },
                {
                  id: "o2",
                  from: "contact",
                  anchor: "callback_reply",
                  text: "There's no time for that, the phone queue is over an hour right now. I'm already handling your case. Just send the code and I'll take care of it.",
                },
              ],
            },
          ],
          decisionIds: ["send_code", "block_report", "delete_conversation"],
        },
        {
          id: "codes",
          requires: ["reply_not_me"],
          contact: {
            name: "TandemPay",
            subtitle: "Short code 72641",
            initials: "TP",
            anchor: "code_sender",
            details: [
              { label: "Short code", value: "72641" },
              { label: "Saved contact", value: "Yes (TandemPay alerts)" },
            ],
          },
          preview: "Your TandemPay verification code is 384 216…",
          time: "10:44 AM",
          unread: true,
          messages: [
            {
              id: "k1",
              from: "contact",
              time: "Oct 30",
              text: "TandemPay: you sent {{amount.transfer}} to Sam R. View it in the app under Activity.",
            },
            {
              id: "k2",
              from: "contact",
              time: "10:44 AM",
              anchor: "code_text",
              text: "TandemPay: your verification code is 384 216. Use it to sign in on a new device. TandemPay will never call or message you to ask for this code.",
            },
          ],
        },
        {
          id: "maya",
          contact: {
            name: "Maya",
            subtitle: "Mobile",
            initials: "M",
            anchor: "friend_contact",
            details: [{ label: "Saved contact", value: "Yes" }],
          },
          preview: "Still on for lunch on Saturday?",
          time: "Yesterday",
          messages: [
            { id: "m1", from: "contact", time: "Yesterday", text: "Still on for lunch on Saturday?" },
            { id: "m2", from: "me", time: "Yesterday", text: "Yes! 12:30 at the usual place 🙂" },
          ],
        },
      ],
    },
    {
      type: "wallet",
      id: "tandempay",
      label: "TandemPay",
      icon: "wallet",
      brand: "TandemPay",
      owner: "{{playerName}}",
      tabs: [
        {
          id: "home",
          label: "Home",
          actionId: "open_tandempay_app",
          blocks: [
            {
              type: "kv",
              title: "Your account",
              anchor: "account_summary",
              rows: [
                { label: "Available balance", value: "{{amount.balance}}" },
                { label: "Pending payments", value: "None" },
              ],
            },
            {
              type: "table",
              title: "Recent activity",
              anchor: "account_activity",
              columns: ["Date", "Description", "Amount", "Status"],
              rows: [
                ["Yesterday", "Corner Market", "−{{amount.grocery}}", "Completed"],
                ["Oct 30", "Sent to Sam R.", "−{{amount.transfer}}", "Completed"],
              ],
            },
          ],
        },
        {
          id: "security",
          label: "Security",
          actionId: "check_security_activity",
          blocks: [
            {
              type: "notice",
              title: "Sign-in attempt on a new device",
              anchor: "security_event",
              text: "Today at 10:43 AM someone tried to sign in to your account from Chrome on Windows. We sent a verification code to your phone. The sign-in hasn't been completed.",
            },
            {
              type: "kv",
              title: "Your devices",
              rows: [
                { label: "This phone", value: "Active now" },
                { label: "Last password change", value: "March" },
              ],
            },
          ],
        },
        {
          id: "help",
          label: "Help",
          actionId: "open_app_help",
          blocks: [
            {
              type: "list",
              title: "Help topics",
              anchor: "help_topics",
              items: [
                {
                  title: "What are verification codes for?",
                  text: "We send a one-time code when you sign in on a new device or change security settings. Only enter it in the TandemPay app or on tandempay.example.",
                },
                {
                  title: "Does TandemPay send texts?",
                  text: "We send automatic alerts from short code 72641.",
                },
              ],
            },
            {
              type: "kv",
              title: "Contact us",
              anchor: "contact_details",
              rows: [
                { label: "Phone", value: "1-800-555-0100 (also on the back of your card)" },
                { label: "In-app chat", value: "Help → Chat with us" },
              ],
            },
          ],
        },
      ],
    },
  ],
  actions: [
    { id: "check_sender_details", kind: "investigate", label: "Checked the sender's details" },
    { id: "ask_which_payment", kind: "investigate", label: "Asked which payment" },
    { id: "reply_not_me", kind: "interact", label: "Replied that the payment wasn't theirs" },
    {
      id: "ask_why_code",
      kind: "investigate",
      label: "Asked why the code was needed",
      requires: ["reply_not_me"],
    },
    {
      id: "ask_call_app_number",
      kind: "investigate",
      label: "Offered to call the number in the TandemPay app",
      requires: ["reply_not_me"],
    },
    { id: "open_tandempay_app", kind: "investigate", label: "Opened the TandemPay app" },
    { id: "check_security_activity", kind: "investigate", label: "Checked the app's security activity" },
    { id: "open_app_help", kind: "investigate", label: "Opened the app's help and contact details" },
  ],
  decisions: [
    {
      id: "send_code",
      kind: "other",
      intent: "share_code",
      label: "Send the code",
      summary: "Reply to TandemPay Support with the verification code",
      requires: ["reply_not_me"],
    },
    {
      id: "block_report",
      kind: "other",
      intent: "report",
      label: "Block and report",
      summary: "Block this number and report the conversation",
    },
    {
      id: "delete_conversation",
      kind: "other",
      intent: "decline",
      label: "Delete conversation",
      summary: "Delete the conversation without sharing anything",
    },
  ],
};
