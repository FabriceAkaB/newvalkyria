-- Source d'acquisition obligatoire (Mandalart P3.8.01, AU05) et entreprise des parents (P6.1.02).
-- « Comment nous avez-vous connus ? » + « Avez-vous une entreprise ? », posées dans les formulaires
-- d'inscription filles, d'essai filles, d'essai garçons, des programmes garçons et du Sport-Études.
-- Aucune nouvelle table : quatre colonnes sur les tables d'inscription existantes (RLS déjà en place).
--   acquisition_source : clé stable du canal (parrainage, reseaux, journee_valkyria, parascolaire, camp,
--                        club_partenaire, google, publicite, bouche_a_oreille, autre) — voir src/lib/acquisition-core.ts
--   acquisition_detail : précision (code ou nom de la famille qui parraine, réseau social, école, club, camp…)
--   has_business       : le parent a une entreprise (null = pas répondu)
--   business_name      : nom de l'entreprise (liste des commandites possibles)

do $$
declare t text;
begin
  foreach t in array array['registrations', 'session_program_registrations', 'boys_trials', 'sport_etudes_registrations'] loop
    if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = t) then
      execute format('alter table public.%I add column if not exists acquisition_source text', t);
      execute format('alter table public.%I add column if not exists acquisition_detail text', t);
      execute format('alter table public.%I add column if not exists has_business boolean', t);
      execute format('alter table public.%I add column if not exists business_name text', t);
      execute format('create index if not exists %I on public.%I (acquisition_source)', t || '_acquisition_source_idx', t);
      execute format('create index if not exists %I on public.%I (has_business) where has_business', t || '_has_business_idx', t);
    end if;
  end loop;
end $$;
