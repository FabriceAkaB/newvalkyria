"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/monclubsportif", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error ?? "Erreur");
  return json;
}

export function McsButton({ body, label, confirmText, primary }: { body: Record<string, unknown>; label: string; confirmText?: string; primary?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={primary ? "admin-btn-primary" : "admin-btn-ghost"}
      disabled={busy}
      onClick={async () => {
        if (confirmText && !confirm(confirmText)) return;
        setBusy(true);
        await post(body).catch((e) => alert(e.message));
        router.refresh();
        setBusy(false);
      }}
    >
      {busy ? "…" : label}
    </button>
  );
}
