import { NextResponse } from "next/server";
import { DEFAULT_CURRENCY, PAYPAL_CURRENCY_SOURCE, SUPPORTED_CURRENCIES } from "@/lib/domain/currency";

/** GET /api/config/currencies — the supported currency allowlist (public, static). */
export function GET() {
  return NextResponse.json({
    default: DEFAULT_CURRENCY,
    currencies: SUPPORTED_CURRENCIES.map(({ code, name, minorUnitDigits }) => ({
      code,
      name,
      minorUnitDigits,
    })),
    source: PAYPAL_CURRENCY_SOURCE,
  });
}
