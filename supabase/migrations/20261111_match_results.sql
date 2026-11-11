-- Section Matchs (Mandalart P1.8.05 à P1.8.07) : résultat, résumé, analyse et vidéo de chaque match.
--
-- 1. Les matchs entrés dans Entraînements (coach_activities de type Match ou Tournoi) gardent
--    leur fiche dans match_details : on y ajoute le résumé, l'analyse, la vidéo et le logo
--    de l'adversaire. match_slot_id relie l'activité à la plage vendue du même match
--    (Vente de matchs), pour ne jamais afficher deux fois le même match.
-- 2. Une plage vendue à un autre club (match_slots + réservation payée) n'a pas toujours
--    d'activité : son résultat va dans match_slot_results, avec les mêmes champs.
-- 3. Les vidéos déposées vont dans le compartiment PRIVÉ « match-videos » (Loi 25 : vidéos
--    d'enfants), téléversées directement depuis le navigateur (lien signé) et lues par un
--    lien signé de courte durée. Aucune donnée d'enfant dans ces colonnes.

alter table public.match_details add column if not exists summary text;
alter table public.match_details add column if not exists analysis jsonb;
alter table public.match_details add column if not exists video_url text;
alter table public.match_details add column if not exists video_path text;
alter table public.match_details add column if not exists opponent_logo_url text;
alter table public.match_details add column if not exists match_slot_id uuid references public.match_slots(id) on delete set null;
create unique index if not exists match_details_match_slot_id_key on public.match_details (match_slot_id) where match_slot_id is not null;

create table if not exists public.match_slot_results (
  club_id text not null default 'new-valkyria',
  match_slot_id uuid primary key references public.match_slots(id) on delete cascade,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  final_score_us integer check (final_score_us is null or final_score_us >= 0),
  final_score_them integer check (final_score_them is null or final_score_them >= 0),
  summary text,
  analysis jsonb,
  video_url text,
  video_path text,
  opponent_logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists match_slot_results_club_idx on public.match_slot_results (club_id);
-- Nom de l'adversaire tel que JP veut l'afficher (sinon : club et équipe de la réservation).
alter table public.match_slot_results add column if not exists opponent_name text;

alter table public.match_slot_results enable row level security;

do $$
declare t text;
begin
  foreach t in array array['match_slot_results'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_service_role_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t || '_service_role_all', t);
    end if;
  end loop;
end $$;

-- Compartiment privé des vidéos de match (jamais public).
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('match-videos', 'match-videos', false, array['video/*'])
on conflict (id) do nothing;
