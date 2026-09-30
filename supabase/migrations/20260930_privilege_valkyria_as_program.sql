-- Privilège Valkyria devient un programme normal de la saison Automne/Hiver
-- (comme TV/SV/NV/...), plutôt qu'un système séparé (session_programs) —
-- demande explicite : "je veux pas qu'il soit une section à part, qu'il
-- fasse partie des programmes automne-hiver". Les inscrites vivent désormais
-- dans `registrations` comme toutes les autres, filtrables/éditables au même
-- endroit. `session_programs`/`session_program_dates` restent en lecture
-- seule pour l'affichage de la page publique (nom/prix/horaire des 15
-- séances) — seul le mécanisme d'inscription change.

insert into public.birth_categories (season_id, id, label, display_order)
values ('automne-hiver-2026', '2013-2012', '2013–2012', 5)
on conflict (season_id, id) do nothing;

insert into public.programs (season_id, id, name, price_cents, invitation, tagline, includes, tech_count, team_count, solo_count, badge, display_order, active)
values (
  'automne-hiver-2026',
  'PV',
  'Privilège Valkyria',
  65345,
  false,
  'Semi-privé du samedi en très petit groupe.',
  '["15 séances techniques semi-privé (samedi)", "Groupe très restreint (5 places)", "Encadrement personnalisé", "Bulletin de suivi des apprentissages"]'::jsonb,
  '15',
  '—',
  '—',
  null,
  5,
  true
)
on conflict (season_id, id) do nothing;

insert into public.program_categories (season_id, program_id, category_id, max_places)
values ('automne-hiver-2026', 'PV', '2013-2012', 5)
on conflict (season_id, program_id, category_id) do nothing;
