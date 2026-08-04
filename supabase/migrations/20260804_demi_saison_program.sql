-- Nouveau programme "Demi-saison" (TVD) — moitié des quantités et du prix de
-- Team Valkyria Avancé (TVA). Sur invitation, mêmes catégories et mêmes
-- plages horaires que TVA.
-- Additive only : aucune table existante modifiée, seulement des lignes ajoutées.

insert into public.programs (season_id, id, name, price_cents, invitation, tagline, includes, tech_count, team_count, solo_count, display_order, active)
values (
  'automne-hiver-2026',
  'TVD',
  'Demi-saison',
  43798,
  true,
  'Sur invitation — groupe avancé, demi-saison (moitié du programme).',
  '["10 pratiques techniques semi-privé", "5 pratiques d''équipe (une aux deux semaines)", "Environ 15 activités durant la saison", "Accès au programme vidéo maison", "Bulletin de suivi des apprentissages"]'::jsonb,
  '10',
  '5',
  '—',
  4,
  true
)
on conflict (season_id, id) do nothing;

insert into public.program_categories (season_id, program_id, category_id, max_places)
values
  ('automne-hiver-2026', 'TVD', '2016', 12),
  ('automne-hiver-2026', 'TVD', '2015', 12)
on conflict (season_id, program_id, category_id) do nothing;

insert into public.time_slot_template_programs (time_slot_template_id, program_id)
select time_slot_template_id, 'TVD'
from public.time_slot_template_programs
where program_id = 'TVA'
on conflict (time_slot_template_id, program_id) do nothing;
