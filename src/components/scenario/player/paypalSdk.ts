"use client";

import { PAYPAL_SANDBOX_SDK_URL } from "@/lib/payments/checkout";

/**
 * Minimal typings and a once-only loader for the official PayPal JavaScript SDK v6 (Sandbox host only; there is no
 * live URL anywhere in ScamSense). See https://developer.paypal.com/sdk/js/set-up and /sdk/js/reference.
 * Only the client ID (public by design) is used in the browser; orders are created and captured on our server.
 */
export interface PayPalPaymentSession {
  start(
    options: { presentationMode: "auto" | "popup" | "modal" },
    order: Promise<{ orderId: string }>,
  ): Promise<void>;
}

export interface PayPalSdkInstance {
  findEligibleMethods(options: { currencyCode: string }): Promise<{ isEligible(method: string): boolean }>;
  createPayPalOneTimePaymentSession(options: {
    onApprove: (data: { orderId: string; payerId?: string }) => Promise<void> | void;
    onCancel: (data: { orderId?: string }) => Promise<void> | void;
    onError: (error: { code?: string; message?: string }) => Promise<void> | void;
  }): PayPalPaymentSession;
}

interface PayPalNamespace {
  createInstance(options: {
    clientId: string;
    components: string[];
    pageType?: "checkout";
  }): Promise<PayPalSdkInstance>;
}

declare global {
  interface Window {
    paypal?: PayPalNamespace;
  }
}

let scriptPromise: Promise<PayPalNamespace> | null = null;

function loadScript(): Promise<PayPalNamespace> {
  if (window.paypal) return Promise.resolve(window.paypal);
  scriptPromise ??= new Promise<PayPalNamespace>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PAYPAL_SANDBOX_SDK_URL;
    script.async = true;
    script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("sdk_missing")));
    script.onerror = () => {
      scriptPromise = null; // allow a retry after a network failure
      script.remove();
      reject(new Error("sdk_load_failed"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

const instances = new Map<string, Promise<PayPalSdkInstance>>();

/** One SDK instance per client ID for the page's lifetime. */
export function getPayPalInstance(clientId: string): Promise<PayPalSdkInstance> {
  let p = instances.get(clientId);
  if (!p) {
    p = loadScript().then((paypal) =>
      paypal.createInstance({ clientId, components: ["paypal-payments"], pageType: "checkout" }),
    );
    p.catch(() => instances.delete(clientId));
    instances.set(clientId, p);
  }
  return p;
}
