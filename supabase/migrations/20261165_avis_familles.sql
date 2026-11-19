-- Avis et témoignages des familles (JP, 19 nov. 2026) : le parent écrit son avis et ses étoiles une fois dans son
-- espace, puis le publie sur Google et Facebook en deux clics (texte copié, page d'avis ouverte) ; il peut aussi
-- se filmer avec son téléphone (témoignage vidéo) : une fois validé par l'académie, un crédit sur la prochaine saison.
create table if not exists public.family_reviews (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  parent_user_id uuid not null,
  parent_email text,
  parent_name text,
  player_names text,
  stars integer check (stars between 1 and 5),
  body text,
  video_path text,
  video_consent boolean not null default false,
  video_status text not null default 'aucune' check (video_status in ('aucune', 'a-valider', 'approuvee', 'refusee')),
  credit_cents integer,
  credited_at timestamptz,
  google_clicked_at timestamptz,
  facebook_clicked_at timestamptz,
  show_on_site boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, parent_user_id)
);
do $$
begin
  execute 'alter table public.family_reviews enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'family_reviews' and policyname = 'family_reviews_service_role_all') then
    execute 'create policy family_reviews_service_role_all on public.family_reviews for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('temoignages', 'temoignages', false, array['video/*'])
on conflict (id) do nothing;
