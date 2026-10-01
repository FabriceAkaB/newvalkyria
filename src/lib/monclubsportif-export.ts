import { getSupabaseAdminClient } from "@/lib/supabase-admin";

function db() {
  return getSupabaseAdminClient() as any;
}

export const MEMBER_EXPORT_HEADER = [
  "PRÉNOM *",
  "NOM *",
  "GENRE *",
  "TYPE *",
  "ACTIVITÉ *",
  "GROUPE *",
  "CONTACT 1 - IDENTIFIANT *",
  "CONTACT 1 - COURRIEL *",
  "CONTACT 1 - TYPE DE RELATION *",
  "CONTACT 1 - TÉLÉPHONE",
  "GESTIONNAIRE?",
  "CONTACT 2 - IDENTIFIANT",
  "CONTACT 2 - COURRIEL",
  "CONTACT 2 - TYPE DE RELATION",
  "CONTACT 2 - TÉLÉPHONE",
  "CONTACT 3 - IDENTIFIANT",
  "CONTACT 3 - COURRIEL",
  "CONTACT 3 - TYPE DE RELATION",
  "CONTACT 3 - TÉLÉPHONE",
  "RÔLE",
  "NUMÉRO DE CHANDAIL",
  "NUMÉRO D'IDENTIFICATION",
  "DATE DE NAISSANCE",
  "ADRESSE",
  "VILLE",
  "PAYS",
  "PROVINCE",
  "CODE POSTAL",
  "NOTE PRIVÉE",
  "PASSEPORT VACCINAL"
];

export interface MemberExportRow {
  firstName: string;
  lastName: string;
  gender: "F" | "M";
  activite: string;
  groupe: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  dob: string | null;
  city: string | null;
}

function toRowArray(r: MemberExportRow): (string | null)[] {
  return [
    r.firstName,
    r.lastName,
    r.gender,
    "Participant",
    r.activite,
    r.groupe,
    r.parentName,
    r.parentEmail,
    "Parent/tuteur",
    r.parentPhone,
    "Non",
    null, null, null, null, // Contact 2
    null, null, null, null, // Contact 3
    null, // Rôle
    null, // Numéro de chandail
    null, // Numéro d'identification
    r.dob,
    null, // Adresse
    r.city,
    "Canada",
    "QC",
    null, // Code postal
    null, // Note privée
    null // Passeport vaccinal
  ];
}

/** Rassemble tous les membres actifs (hors annulés) de tous les systèmes
 *  d'inscription du club en une seule liste prête pour l'import
 *  MonClubSportif. Une ligne par athlète. */
export async function getAllMembersForExport(): Promise<(string | null)[][]> {
  const supabase = db();
  const rows: MemberExportRow[] = [];

  // ── Automne/Hiver (et toute autre saison future dans `registrations`) ──
  const { data: seasonRegs, error: seasonError } = await supabase
    .from("registrations")
    .select("player_first_name, player_last_name, player_dob, parent_name, parent_email, parent_phone, city, category_id, program_id, season_id")
    .neq("status", "cancelled");
  if (seasonError) throw new Error(seasonError.message);
  for (const r of seasonRegs ?? []) {
    rows.push({
      firstName: r.player_first_name ?? "",
      lastName: r.player_last_name ?? "",
      gender: "F",
      activite: "",
      groupe: [r.program_id, r.category_id].filter(Boolean).join(" — "),
      parentName: r.parent_name,
      parentEmail: r.parent_email,
      parentPhone: r.parent_phone,
      dob: r.player_dob,
      city: r.city
    });
  }

  // ── Été 2026 (leads) ──
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("parent_name, email, phone, city, player_age, players(first_name, last_name, dob)")
    .neq("status", "cancelled");
  if (leadsError) throw new Error(leadsError.message);
  for (const l of leads ?? []) {
    const player = l.players as { first_name?: string; last_name?: string; dob?: string } | null;
    rows.push({
      firstName: player?.first_name ?? "",
      lastName: player?.last_name ?? "",
      gender: "F",
      activite: "",
      groupe: l.player_age ? `Été 2026 — ${l.player_age}` : "Été 2026",
      parentName: l.parent_name,
      parentEmail: l.email,
      parentPhone: l.phone,
      dob: player?.dob ?? null,
      city: l.city
    });
  }

  // ── Sport-Études (garçons) ──
  const { data: seRegs, error: seError } = await supabase
    .from("sport_etudes_registrations")
    .select("player_first_name, player_last_name, player_dob, parent_first_name, parent_last_name, parent_email, parent_phone")
    .neq("status", "cancelled");
  if (seError) throw new Error(seError.message);
  for (const r of seRegs ?? []) {
    rows.push({
      firstName: r.player_first_name ?? "",
      lastName: r.player_last_name ?? "",
      gender: "M",
      activite: "",
      groupe: "Sport-Études",
      parentName: `${r.parent_first_name} ${r.parent_last_name}`.trim(),
      parentEmail: r.parent_email,
      parentPhone: r.parent_phone,
      dob: r.player_dob,
      city: null
    });
  }

  // ── Privilège Valkyria / Programme Intensif ──
  const { data: spRegs, error: spError } = await supabase
    .from("session_program_registrations")
    .select("player_first_name, player_last_name, player_dob, parent_name, parent_email, parent_phone, city, program_slug, session_programs(name, gender)")
    .neq("status", "cancelled");
  if (spError) throw new Error(spError.message);
  for (const r of spRegs ?? []) {
    const program = r.session_programs as { name?: string; gender?: string } | null;
    rows.push({
      firstName: r.player_first_name ?? "",
      lastName: r.player_last_name ?? "",
      gender: program?.gender === "garcons" ? "M" : "F",
      activite: "",
      groupe: program?.name ?? r.program_slug,
      parentName: r.parent_name,
      parentEmail: r.parent_email,
      parentPhone: r.parent_phone,
      dob: r.player_dob,
      city: r.city
    });
  }

  return rows.map(toRowArray);
}

export const EVENT_EXPORT_HEADER = [
  "TYPE *",
  "DATE *",
  "HEURE *",
  "DURÉE *",
  "LIEU *",
  "OPPOSANT *",
  "GROUPE *",
  "ACTIVITÉ *",
  "NUMÉRO DE COMPÉTITION",
  "TYPE DE COMPÉTITION",
  "DOMICILE OU VISITEUR",
  "TITRE *",
  "DESCRIPTION",
  "MARQUER COMME PRÉSENT"
];

function durationHHMM(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const totalMinutes = eh * 60 + em - (sh * 60 + sm);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Ligne "Évènement" (pratique, tournoi, camp...) — tout ce qui n'est pas un
 *  match officiel contre un autre club. */
function eventRow(input: { date: string; startTime: string; endTime: string; location: string | null; groupe: string; titre: string }): (string | null)[] {
  return [
    "Évènement",
    input.date,
    input.startTime.slice(0, 5),
    durationHHMM(input.startTime.slice(0, 5), input.endTime.slice(0, 5)),
    input.location ?? "",
    null, // Opposant — uniquement compétition
    input.groupe,
    "", // ACTIVITÉ — à compléter avec le nom exact de la plateforme
    null, // Numéro de compétition — uniquement compétition
    null, // Type de compétition — uniquement compétition
    null, // Domicile ou visiteur — uniquement compétition
    input.titre,
    null, // Description
    null // Marquer comme présent
  ];
}

/** Ligne "Compétition" (match contre un autre club) — OPPOSANT est
 *  obligatoire dans le gabarit, donc un match sans adversaire connu
 *  (match_details pas encore rempli) est exporté comme "Évènement" plutôt
 *  que de produire une ligne compétition incomplète (voir appelant). */
function competitionRow(input: {
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  groupe: string;
  opposant: string;
  typeCompetition: string;
  domicileOuVisiteur: "Domicile" | "Visiteur";
}): (string | null)[] {
  return [
    "Compétition",
    input.date,
    input.startTime.slice(0, 5),
    durationHHMM(input.startTime.slice(0, 5), input.endTime.slice(0, 5)),
    input.location ?? "",
    input.opposant,
    input.groupe,
    "", // ACTIVITÉ — à compléter avec le nom exact de la plateforme
    null, // Numéro de compétition — jamais suivi dans nos systèmes
    input.typeCompetition,
    input.domicileOuVisiteur,
    null, // Titre — uniquement évènement
    null, // Description — uniquement évènement
    null // Marquer comme présent
  ];
}

/** Rassemble toutes les activités réelles de tous les programmes (peu
 *  importe lequel) en une seule liste prête pour l'import d'événements
 *  MonClubSportif :
 *  - Horaire Automne/Hiver (pratiques hebdomadaires TV/SV/NV...)
 *  - Sport-Études, Privilège Valkyria, Programme Intensif (dates fixes)
 *  - Entraînement (coach_activities) — pratiques, matchs, tournois, camps...
 *    planifiés depuis l'onglet Entraînement, quel que soit le groupe/la
 *    catégorie. Un match devient une ligne "Compétition" dès que son
 *    adversaire est renseigné (voir la fiche du match) ; sinon il reste une
 *    ligne "Évènement" en attendant.
 *  Note : si une même pratique est à la fois une plage horaire ET une
 *  activité d'Entraînement pour la même date, elle apparaîtra deux fois —
 *  à fusionner manuellement au besoin avant l'import. */
export async function getAllEventsForExport(): Promise<(string | null)[][]> {
  const supabase = db();
  const rows: (string | null)[][] = [];

  // ── Horaire Automne/Hiver — dates ajoutées manuellement par l'admin ──
  const { data: slotDates, error: slotDatesError } = await supabase
    .from("time_slot_dates")
    .select("occurs_on, cancelled, time_slot_templates(day, start_time, end_time, location, season_id, time_slot_template_categories(category_id))")
    .eq("cancelled", false);
  if (slotDatesError) throw new Error(slotDatesError.message);
  for (const d of slotDates ?? []) {
    const slot = d.time_slot_templates as any;
    if (!slot) continue;
    const categories = (slot.time_slot_template_categories ?? []).map((c: any) => c.category_id).join(", ");
    rows.push(
      eventRow({
        date: d.occurs_on,
        startTime: slot.start_time,
        endTime: slot.end_time,
        location: slot.location,
        groupe: categories || slot.day,
        titre: `Pratique — ${categories || slot.day}`
      })
    );
  }

  // ── Sport-Études (garçons) ──
  const { data: seSessions, error: seError } = await supabase
    .from("sport_etudes_sessions")
    .select("session_date, start_time, end_time, location, label")
    .eq("active", true)
    .not("start_time", "is", null);
  if (seError) throw new Error(seError.message);
  for (const s of seSessions ?? []) {
    rows.push(eventRow({ date: s.session_date, startTime: s.start_time, endTime: s.end_time, location: s.location, groupe: "Sport-Études", titre: s.label }));
  }

  // ── Privilège Valkyria / Programme Intensif ──
  const { data: spDates, error: spError } = await supabase
    .from("session_program_dates")
    .select("session_date, start_time, end_time, location, session_programs(name)");
  if (spError) throw new Error(spError.message);
  for (const d of spDates ?? []) {
    const program = d.session_programs as { name?: string } | null;
    const groupe = program?.name ?? "Programme";
    rows.push(eventRow({ date: d.session_date, startTime: d.start_time, endTime: d.end_time, location: d.location, groupe, titre: `Pratique ${groupe}` }));
  }

  // ── Entraînement — toutes les activités (pratiques, matchs, tournois...)
  //    planifiées depuis coach_activities, peu importe la catégorie/le groupe ──
  const { data: activities, error: activitiesError } = await supabase
    .from("coach_activities")
    .select("id, activity_date, start_time, end_time, location, category, activity_type, title");
  if (activitiesError) throw new Error(activitiesError.message);

  const matchIds = (activities ?? []).filter((a: any) => a.activity_type === "Match").map((a: any) => a.id);
  const matchDetailsById = new Map<string, { opponent_name: string; home_away: string; status: string }>();
  if (matchIds.length > 0) {
    const { data: matchDetails, error: matchError } = await supabase
      .from("match_details")
      .select("activity_id, opponent_name, home_away, status")
      .in("activity_id", matchIds);
    if (matchError) throw new Error(matchError.message);
    for (const m of matchDetails ?? []) matchDetailsById.set(m.activity_id, m);
  }

  for (const a of activities ?? []) {
    const groupe = a.category ?? a.activity_type;
    if (a.activity_type === "Match") {
      const details = matchDetailsById.get(a.id);
      if (details?.opponent_name) {
        rows.push(
          competitionRow({
            date: a.activity_date,
            startTime: a.start_time,
            endTime: a.end_time,
            location: a.location,
            groupe,
            opposant: details.opponent_name,
            typeCompetition: "Saison",
            domicileOuVisiteur: details.home_away === "away" ? "Visiteur" : "Domicile"
          })
        );
        continue;
      }
    }
    rows.push(
      eventRow({
        date: a.activity_date,
        startTime: a.start_time,
        endTime: a.end_time,
        location: a.location,
        groupe,
        titre: a.title ? `${a.activity_type} — ${a.title}` : `${a.activity_type} — ${groupe}`
      })
    );
  }

  return rows;
}
