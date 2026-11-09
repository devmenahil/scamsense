import type { ScenarioRenderInput } from "../schema";

/**
 * M3-S2 — The Seller's Dilemma (marketplace seller dashboard + messages + email + payment-account activity).
 * Client-safe (R10). The player is the seller. Tradepost and TandemPay are fictional (R29, R34): the "payment" exists
 * only as a claim in a chat, an email, and a picture. Nothing is ever created in the real PayPal Sandbox.
 */
export const render: ScenarioRenderInput = {
  scenarioKey: "m3-s2",
  contentVersion: "2026-11-10.step6",
  interfaceType: "marketplace",
  introLine: "A buyer has contacted you about an item you're selling.",
  startAppId: "seller",
  slots: [
    {
      name: "itemName",
      default: "mirrorless camera kit",
      maxLength: 40,
      purpose: "The item the player is selling (matched to their activities).",
    },
  ],
  amountParts: { headphones: 2_400, tablet: 3_600, lastSale: 2_900, coffee: 90, balance: 8_200 },
  apps: [
    {
      type: "seller_hub",
      id: "seller",
      label: "Tradepost",
      icon: "marketplace",
      siteName: "Tradepost",
      domain: "www.tradepost.example/seller",
      addressAnchor: "seller_hub_domain",
      connection: "Connection is encrypted. Certificate issued to www.tradepost.example.",
      sellerName: "{{playerName}}",
      overview: [
        { label: "Active listings", value: "2" },
        { label: "Sold, awaiting payment", value: "1" },
        { label: "Seller rating", value: "100% positive (14 ratings)" },
      ],
      listings: [
        {
          id: "camera",
          title: "{{itemName}}",
          price: "{{amount}}",
          art: "camera",
          status: "Sold – awaiting payment",
          views: "214 views",
          anchor: "listing_status",
        },
        {
          id: "headphones",
          title: "Over-ear headphones",
          price: "{{amount.headphones}}",
          art: "headphones",
          status: "Active",
          views: "58 views",
        },
        {
          id: "tablet",
          title: "10-inch tablet with case",
          price: "{{amount.tablet}}",
          art: "tablet",
          status: "Active",
          views: "97 views",
        },
      ],
      orders: [
        {
          id: "order",
          number: "TP-48213-77",
          buyer: "jordan_m_buys",
          item: "{{itemName}}",
          art: "camera",
          total: "{{amount}}",
          placed: "Today, 8:55 AM",
          status: "Awaiting payment",
          statusAnchor: "order_status",
          paymentNote: "No payment has been received for this order on Tradepost.",
          shipTo: ["Jordan M.", "c/o FastLane Freight Forwarding", "Unit 9, 1200 Dockside Way"],
          shipToAnchor: "shipping_address",
          timeline: [
            { label: "Order placed", date: "Today, 8:55 AM" },
            { label: "Payment", date: "Not received" },
            { label: "Shipped", date: "—" },
          ],
          viewActionId: "view_order",
          decisionIds: ["ship_item", "hold_shipment", "report_buyer"],
        },
      ],
      threads: [
        {
          id: "buyer",
          contact: {
            name: "jordan_m_buys",
            subtitle: "Buyer · Tradepost messages",
            initials: "JM",
            anchor: "buyer_profile",
            detailsActionId: "check_buyer_profile",
            details: [
              { label: "Member since", value: "Last week" },
              { label: "Completed purchases", value: "0" },
              { label: "Feedback", value: "No ratings yet" },
            ],
          },
          preview: "Hi! I just bought your item…",
          time: "8:57 AM",
          unread: true,
          messages: [
            {
              id: "j1",
              from: "contact",
              time: "8:57 AM",
              anchor: "buyer_first_message",
              text: "Hi! I just bought your {{itemName}} 😊 I paid with TandemPay straight to your email because it's faster than the checkout here.",
            },
            {
              id: "j2",
              from: "contact",
              time: "8:58 AM",
              anchor: "buyer_second_message",
              text: "You should have the payment email already. Can you ship today? My courier can collect it this afternoon.",
            },
          ],
          branches: [
            {
              actionId: "say_not_received",
              label: "I can't see the payment yet",
              messages: [
                { id: "n1", from: "me", text: "I can't see the payment in my account yet." },
                {
                  id: "n2",
                  from: "contact",
                  anchor: "pending_reply",
                  text: "It says pending in the email. TandemPay holds big payments until the seller adds a tracking number, that's normal! Ship it and the money releases.",
                },
              ],
            },
            {
              actionId: "ask_pay_on_platform",
              label: "Could you pay through Tradepost checkout?",
              messages: [
                { id: "t1", from: "me", text: "Could you pay through the Tradepost checkout instead?" },
                {
                  id: "t2",
                  from: "contact",
                  anchor: "checkout_reply",
                  text: "I already paid, I can't pay twice!! Please just check your email.",
                },
              ],
            },
            {
              actionId: "ask_for_proof",
              label: "Can you send proof of payment?",
              messages: [
                { id: "s1", from: "me", text: "Can you send proof of the payment?" },
                { id: "s2", from: "contact", text: "Sure, here 👇" },
                {
                  id: "s3",
                  from: "contact",
                  attachment: {
                    kind: "receipt",
                    anchor: "shared_image",
                    caption: "Screenshot",
                    title: "Payment sent",
                    rows: [
                      { label: "To", value: "{{playerName}}" },
                      { label: "Amount", value: "{{amount}}" },
                      { label: "Status", value: "Pending release" },
                      { label: "Reference", value: "TPY-9935-118" },
                    ],
                    footer: "Funds are released when the seller adds tracking.",
                  },
                },
              ],
            },
            {
              actionId: "ask_about_address",
              label: "Why a freight forwarding address?",
              requires: ["view_order"],
              messages: [
                { id: "a1", from: "me", text: "Why is the delivery address a freight forwarder?" },
                {
                  id: "a2",
                  from: "contact",
                  anchor: "address_reply",
                  text: "I'm moving abroad, so my courier forwards everything. Super common!",
                },
              ],
            },
          ],
          decisionIds: ["ship_item", "hold_shipment", "report_buyer"],
        },
      ],
    },
    {
      type: "mail",
      id: "mail",
      label: "Mail",
      icon: "mail",
      accountAddress: "me@inkwell-mail.example",
      messages: [
        {
          id: "confirmation",
          from: { name: "TandemPay", address: "notifications@tandempay-payments.example" },
          fromAnchor: "payment_email_sender",
          to: "me@inkwell-mail.example",
          subject: "You've received {{amount}} (release pending)",
          subjectAnchor: "payment_email_subject",
          listDate: "8:58 AM",
          fullDate: "Today, 8:58 AM",
          preview: "You've received a payment of {{amount}} from Jordan M.…",
          unread: true,
          detailsActionId: "check_email_details",
          body: [
            { type: "p", text: "Hello {{playerName}}," },
            {
              type: "p",
              text: "You've received a payment of {{amount}} from Jordan M.",
              anchor: "payment_email_amount",
            },
            {
              type: "p",
              text: "For your protection, the funds are on hold until you add a shipping tracking number. Once tracking is added, the payment is released to your balance within 24 hours.",
              anchor: "payment_email_hold",
            },
            {
              type: "kv",
              rows: [
                { label: "Transaction ID", value: "TPY-9935-118" },
                { label: "Status", value: "Pending release" },
              ],
            },
            { type: "small", text: "TandemPay Payments Team" },
          ],
        },
        {
          id: "tradepost_sold",
          from: { name: "Tradepost", address: "orders@tradepost.example" },
          fromAnchor: "platform_sender",
          to: "me@inkwell-mail.example",
          subject: "Your item sold: {{itemName}}",
          listDate: "8:55 AM",
          fullDate: "Today, 8:55 AM",
          preview: "jordan_m_buys bought your {{itemName}}…",
          openActionId: "open_platform_email",
          body: [
            {
              type: "p",
              text: "Good news, {{playerName}}: jordan_m_buys bought your {{itemName}} for {{amount}}.",
            },
            {
              type: "p",
              text: "We'll email you when the buyer completes payment. Ship once the order shows Paid in Seller Hub.",
              anchor: "sale_email_body",
            },
          ],
        },
        {
          id: "earlier_payment",
          from: { name: "TandemPay", address: "service@tandempay.example" },
          fromAnchor: "earlier_payment_sender",
          to: "me@inkwell-mail.example",
          subject: "You received {{amount.lastSale}} from Priya K.",
          listDate: "Nov 2",
          fullDate: "Nov 2, 3:41 PM",
          preview: "It's in your TandemPay balance now…",
          openActionId: "open_earlier_payment_email",
          body: [
            { type: "p", text: "Hi {{playerName}}, you received {{amount.lastSale}} from Priya K." },
            {
              type: "small",
              text: "It's in your TandemPay balance now. You can see it in the app under Activity.",
              anchor: "earlier_payment_footer",
            },
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
          id: "activity",
          label: "Activity",
          actionId: "check_payment_account",
          blocks: [
            {
              type: "kv",
              title: "Balance",
              anchor: "wallet_balance",
              rows: [
                { label: "Available", value: "{{amount.balance}}" },
                { label: "Pending", value: "None" },
              ],
            },
            {
              type: "table",
              title: "Activity",
              anchor: "wallet_activity",
              columns: ["Date", "From / to", "Amount", "Status"],
              rows: [
                ["Nov 2", "Priya K.", "+{{amount.lastSale}}", "Completed"],
                ["Oct 28", "Harbor Coffee Co.", "−{{amount.coffee}}", "Completed"],
              ],
            },
          ],
        },
        {
          id: "help",
          label: "Help",
          actionId: "open_wallet_help",
          blocks: [
            {
              type: "list",
              title: "Help topics",
              anchor: "wallet_help",
              items: [
                {
                  title: "When do I see a payment?",
                  text: "Payments to you appear in Activity as soon as they're sent, with the sender's name.",
                },
                { title: "Our emails", text: "TandemPay emails come from tandempay.example." },
              ],
            },
          ],
        },
      ],
    },
  ],
  actions: [
    { id: "view_order", kind: "investigate", label: "Opened the order in Seller Hub" },
    { id: "check_buyer_profile", kind: "investigate", label: "Checked the buyer's profile" },
    { id: "say_not_received", kind: "interact", label: "Told the buyer the payment wasn't visible" },
    { id: "ask_pay_on_platform", kind: "investigate", label: "Asked the buyer to pay through Tradepost" },
    { id: "ask_for_proof", kind: "interact", label: "Asked the buyer for proof of payment" },
    {
      id: "ask_about_address",
      kind: "investigate",
      label: "Asked about the forwarding address",
      requires: ["view_order"],
    },
    { id: "check_email_details", kind: "investigate", label: "Checked the payment email's sender" },
    { id: "open_platform_email", kind: "investigate", label: "Read Tradepost's sale email" },
    {
      id: "open_earlier_payment_email",
      kind: "investigate",
      label: "Compared with an earlier payment email",
    },
    { id: "check_payment_account", kind: "investigate", label: "Checked the TandemPay app's activity" },
    { id: "open_wallet_help", kind: "investigate", label: "Read the TandemPay app's help" },
  ],
  decisions: [
    {
      id: "ship_item",
      kind: "other",
      intent: "ship",
      label: "Mark as shipped",
      summary: "Ship the {{itemName}} to the buyer's forwarding address",
    },
    {
      id: "hold_shipment",
      kind: "other",
      intent: "hold",
      label: "Hold shipment",
      summary: "Keep the item until the payment appears in your own account",
    },
    {
      id: "report_buyer",
      kind: "other",
      intent: "report",
      label: "Report buyer",
      summary: "Report the buyer to Tradepost",
    },
  ],
};
