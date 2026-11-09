"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";

/**
 * Begins a module's training-funds period via POST /api/modules/[moduleKey]/start. The server decides the currency
 * and amount; the button sends nothing but the module key in the URL. Safe to press twice (idempotent).
 */
export function StartModuleButton({ moduleKey, label }: { moduleKey: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const result = await apiRequest(`/api/modules/${encodeURIComponent(moduleKey)}/start`, {
      method: "POST",
    });
    if (!result.ok) {
      setBusy(false);
      setError(result.error.message);
      return;
    }
    // Full reload of this server-rendered, per-user page so the new Training Funds and ledger appear. (A soft
    // router.refresh() received the new payload but did not re-render the page in testing.) Keeps the busy state
    // until the new page replaces this button.
    window.location.reload();
  }

  return (
    <div>
      <Button
        onClick={start}
        loading={busy}
        loadingText="Setting up your funds…"
        iconRight={<Icon name="arrow-right" className="size-5" />}
      >
        {label}
      </Button>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-small">
          <Icon name="info" className="mt-0.5 size-4" />
          {error}
        </p>
      )}
    </div>
  );
}
