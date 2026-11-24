"use client";

import { Copy, Mail, MessageSquare, Share2, UserPlus } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

import { inviteCopy, mailHref, smsHref, type InviteMoment } from "@/lib/trial-invite";

const noop = () => () => {};

/** « Invite une amie à l'essai » (P3.1.08) : montrée après le bulletin, une championne du jour ou une vidéo de progrès.
 *  Le lien porte le code de parrainage de la famille ; aucune donnée de l'enfant n'est partagée, seulement son prénom
 *  dans le texte que le parent envoie lui-même. */
export function FamilyInviteCard({ moment, firstName, url }: { moment: InviteMoment; firstName: string; url: string }) {
  const copy = inviteCopy(moment, firstName);
  const [msg, setMsg] = useState<string | null>(null);
  const canShare = useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${copy.share} ${url}`);
      setMsg("Lien copié : collez-le dans un message.");
    } catch {
      setMsg(url);
    }
  }
  async function share() {
    try {
      await navigator.share({ title: "Essai gratuit New Valkyria", text: copy.share, url });
    } catch {
      /* partage annulé */
    }
  }

  return (
    <div className="parent-card" style={{ boxShadow: "inset 3px 0 0 var(--adm-accent-strong)", display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <UserPlus aria-hidden strokeWidth={1.75} style={{ color: "var(--adm-accent)", flex: "0 0 auto", marginTop: 2 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{copy.title}</p>
          <p className="parent-muted" style={{ margin: "4px 0 0", fontSize: "0.9rem" }}>{copy.body}</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canShare ? (
          <button type="button" className="nv27-btn-primary" onClick={share} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Share2 size={16} aria-hidden /> Inviter une amie
          </button>
        ) : (
          <button type="button" className="nv27-btn-primary" onClick={copyLink} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Copy size={16} aria-hidden /> Copier mon lien
          </button>
        )}
        <a className="nv27-btn-ghost" href={smsHref(copy, url)} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
          <MessageSquare size={16} aria-hidden /> Texto
        </a>
        <a className="nv27-btn-ghost" href={mailHref(copy, url)} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
          <Mail size={16} aria-hidden /> Courriel
        </a>
        {canShare ? (
          <button type="button" className="nv27-btn-ghost" onClick={copyLink} style={{ minHeight: 44, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Copy size={16} aria-hidden /> Copier
          </button>
        ) : null}
      </div>
      {msg ? <p className="parent-muted" style={{ margin: 0, fontSize: "0.85rem", wordBreak: "break-all" }}>{msg}</p> : null}
    </div>
  );
}
