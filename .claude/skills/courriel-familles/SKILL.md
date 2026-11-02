---
name: courriel-familles
description: Envoyer un courriel à des familles (annonce, rappel, info de groupe, réponse à un parent) ou à un partenaire depuis info@newvalkyria.com, un destinataire à la fois, avec Christine en copie. À utiliser dès que JP demande d'écrire, d'annoncer, d'aviser, de répondre ou d'envoyer un message à des parents, à un groupe, à toutes les familles ou à un commanditaire.
---

# Courriel aux familles (ou aux partenaires)

## 1. Choisir les destinataires (dans la base, jamais de mémoire)

- **Familles inscrites** de la saison active : `select distinct lower(parent_email), parent_name from registrations where status = 'paid' and season_id = '<saison active>'`
  (filtrer par `program_id`, `category_id` ou `time_slot_template_id` pour un groupe).
- **Programmes garçons / à dates fixes** : `session_program_registrations` (`program_slug`, `status = 'paid'`) ; **Sport-Études** : `sport_etudes_registrations`.
- `resolveAudience()` de `src/lib/communications-repo.ts` sait déjà résoudre « toutes les familles / une saison / un groupe / une joueuse ».
- Enlever les doublons de courriel (deux sœurs = un seul courriel qui nomme les deux) et les inscriptions `cancelled`.
- Relance à des familles NON inscrites : c'est le skill `relance` (vérification par nom obligatoire).
- Plus de quelques familles : montrer à JP le nombre et la liste des destinataires avant d'envoyer.

## 2. Écrire le message

- Français, vouvoiement, ton chaleureux et simple, phrases courtes. Pas de jargon technique, pas de tiret cadratin.
- Salutation personnalisée (`Bonjour Nicolas,`) quand on connaît le parent ; sinon `Bonjour chers membres de l'académie,`.
- Le concret d'abord : quoi, quand (jour, date, heure `18 h 00`), où (adresse complète), ce que la famille doit faire.
- Bouton pour tout lien d'action + le lien en clair dessous. Liens toujours en `https://www.newvalkyria.com/...`.
- Terminer par `L'équipe New Valkyria`. **Ne pas ajouter de signature** : celle d'Annie Tremblay est ajoutée automatiquement par `getResendClient()`.
- Fournir `html` **et** `text`. Gabarit HTML utilisé jusqu'ici :

```ts
const wrap = (inner: string) => `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1d1730;line-height:1.6;max-width:620px">${inner}</div>`;
const btn = (href: string, label: string) => `<p><a href="${href}" style="display:inline-block;background:#5b2a86;color:#fff;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:bold">${label}</a></p><p style="font-size:13px;color:#666;margin-top:-6px">Ou copiez ce lien : <a href="${href}">${href}</a></p>`;
```

Montrer le texte à JP avant l'envoi s'il ne l'a pas dicté lui-même.

## 3. Envoyer un par un, avec Christine

Test temporaire `src/lib/tmp-<sujet>.test.ts`, lancé puis supprimé dans la même commande :

```ts
// @vitest-environment node
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, ""); }
const CHRISTINE = "Christinedurand.2@hotmail.com";
it("envoi", async () => {
  const { getResendClient } = await import("@/lib/resend");
  const client = getResendClient();
  const failed: string[] = [];
  for (const to of [...emails, CHRISTINE]) {            // annonce aux familles : Christine reçoit sa propre copie
    const res = await client.emails.send({ to, subject, html, text } as never);
    const err = (res as { error: { message: string } | null }).error;
    console.log(to, err ? `ÉCHEC ${err.message}` : "envoyé");
    if (err) failed.push(to);
    await new Promise((r) => setTimeout(r, 1200));       // Gmail : pas de rafale
  }
  expect(failed).toEqual([]);
}, 900000);
```
```bash
export PATH="$HOME/.local/node/bin:$PATH"; npx vitest run src/lib/tmp-sujet.test.ts 2>&1 | grep -E "envoyé|ÉCHEC|passed|failed"; rm src/lib/tmp-sujet.test.ts
```

- **Un courriel par famille**, jamais tous les parents dans `to` ou `cc` (on ne partage pas les adresses entre familles).
- **Christine Durand en copie** : pour une annonce aux familles, elle reçoit un exemplaire à part (ci-dessus) ; pour un
  partenaire / commanditaire ou un courriel à une seule famille, `cc: CHRISTINE` dans le même envoi.
- **Répondre dans un fil** : `subject: "Re: <sujet d'origine>"` et `headers: { "In-Reply-To": msgid, References: msgid }`.
  Le `Message-ID` se lit dans la boîte info@ en IMAP (`imap.gmail.com`, identifiants de `getMailConfig()` de
  `src/lib/mail-config.ts`, script Python lancé depuis un test `tmp-*`, sans jamais afficher le mot de passe).
- Pièce jointe : `attachments: [{ filename, path }]`.

## 4. Vérifier et rendre compte

- Lire la sortie : nombre envoyés / échecs. Renvoyer seulement les échecs, jamais toute la liste une deuxième fois.
- Annonce de groupe : l'inscrire aussi dans l'historique de `/admin/communications` avec `logCommunication()` (`src/lib/communications-repo.ts`).
- Relance, offre, réponse commerciale ou excuse à une famille : `logOutreach()` (skill `relance`).
- Dire à JP : combien de courriels sont partis, à qui (ou quel groupe), Christine en copie, et les échecs éventuels.
