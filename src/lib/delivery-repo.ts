import { CLUB_ID } from "@/lib/club";
import { computeGroup, isSoloSession, promiseFor, type DeliveryEvent, type GroupDelivery, type GroupKind, type PlayerPromise } from "@/lib/delivery-core";
import { loadExpectedPlayers, loadTeamTargets } from "@/lib/mcs-robot-runner";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Promesses tenues : pour chaque groupe MonClubSportif, ce qui a été vendu à chaque joueuse contre ce qui est donné, à
 *  venir et annulé (table `delivery_events`, relue chaque matin par la tâche mcs-sync et sur demande dans l'admin). */

function db() {
  return getSupabaseAdminClient() as any;
}

export interface DeliveryReport {
  groups: (GroupDelivery & { teamId: string })[];
  /** Total des séances à remettre (somme des plus grands écarts de chaque groupe). */
  toGive: number;
  lastSync: string | null;
}

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });

export async function getDeliveryReport(): Promise<DeliveryReport> {
  const teams = (await loadTeamTargets()).filter((t) => t.mcs_team_id);
  const [players, { data: evs }, { data: progs }, { data: dates }] = await Promise.all([
    loadExpectedPlayers(teams),
    db().from("delivery_events").select("team_id, mcs_event_id, title, event_date, kind, cancelled, seen_at").eq("club_id", CLUB_ID).is("removed_at", null),
    db().from("session_programs").select("slug, practices_count"),
    db().from("session_program_dates").select("program_slug")
  ]);
  const dateCount = new Map<string, number>();
  for (const d of (dates ?? []) as any[]) dateCount.set(d.program_slug, (dateCount.get(d.program_slug) ?? 0) + 1);
  const practicesOf = (slug: string) => ((progs ?? []) as any[]).find((p) => p.slug === slug)?.practices_count ?? dateCount.get(slug) ?? null;
  const rows = (evs ?? []) as any[];
  const groups = teams
    .map((t) => {
      const kind: GroupKind = /solo/i.test(t.name) ? "solo" : t.kind === "pratique" ? "technique" : t.kind === "match" ? "equipe" : "programme";
      const events: DeliveryEvent[] = rows
        .filter((r) => r.team_id === t.id && (kind !== "solo" || isSoloSession(r.title)))
        .map((r) => ({ id: Number(r.mcs_event_id), title: r.title, date: r.event_date ? String(r.event_date).slice(0, 10) : null, kind: r.kind, cancelled: r.cancelled }));
      // Le Solo n'a pas de plage dans le site : ses joueuses sont celles qui ont acheté un programme Solo (SV, SVA).
      const mine: PlayerPromise[] = players
        .filter((p) => (kind === "solo" ? p.programs.some((c) => c === "SV" || c === "SVA") : p.teams.some((x) => x.id === t.id)))
        .flatMap((p) => {
          const half = !!p.halfUntil || p.programs.includes("TVD");
          let program = "";
          let promised = 0;
          if (kind === "programme") {
            const slug = t.session_program_slugs.find((s) => p.programs.includes(`prog:${s}`)) ?? (p.programs.includes("PV") ? t.session_program_slugs[0] : undefined);
            if (slug) {
              program = slug;
              promised = promiseFor("programme", slug, false, practicesOf(slug));
            }
          } else {
            program = p.programs.find((c) => promiseFor(kind, c, half) > 0) ?? "";
            promised = program ? promiseFor(kind, program, half) : 0;
          }
          return promised > 0 ? [{ name: `${p.firstName} ${p.lastName}`.trim(), program, promised, until: p.halfUntil }] : [];
        });
      return { teamId: t.id, ...computeGroup(t.name, kind, events, mine, today()) };
    })
    .filter((g) => g.players.length || g.given || g.upcoming)
    .sort((a, b) => b.shortfall - a.shortfall || a.teamName.localeCompare(b.teamName, "fr"));
  const lastSync = rows.map((r) => String(r.seen_at)).sort().at(-1) ?? null;
  return { groups, toGive: groups.reduce((s, g) => s + g.shortfall, 0), lastSync };
}
