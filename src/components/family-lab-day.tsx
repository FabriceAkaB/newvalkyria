"use client";

import "./family-lab.css";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** « Routine faite aujourd'hui » d'une joueuse (Valkyria Lab, espace famille). */
export function LabDayToggle({ player, firstName, done }: { player: string; firstName: string; done: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(done);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    const res = await fetch("/api/compte/lab/jour", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ player, on: !on }) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return alert("Pas enregistré : réessayez.");
    setOn(!on);
    router.refresh();
  };
  return (
    <button type="button" className="fam-labday" data-on={on || undefined} aria-pressed={on} disabled={busy} onClick={toggle}>
      {on ? `✓ ${firstName} a fait sa routine aujourd'hui` : `${firstName} a fait sa routine aujourd'hui`}
    </button>
  );
}
