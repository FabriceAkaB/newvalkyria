-- Commentaires constructifs du bulletin, écrits pour la famille (JP, 17 nov. 2026), à part des notes internes des
-- éducateurs : un mot par éducateur, par joueuse et par bulletin (mi-saison, fin de saison).
create table if not exists public.bulletin_comments (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  registration_id uuid not null references public.registrations(id) on delete cascade,
  period text not null check (period in ('mi-saison', 'fin-saison')),
  coach_id uuid references public.coaches(id) on delete set null,
  author text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists bulletin_comments_one_per_author on public.bulletin_comments (registration_id, period, coach_id);
alter table public.bulletin_comments enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'bulletin_comments' and policyname = 'service_role_all') then
    create policy service_role_all on public.bulletin_comments for all to service_role using (true) with check (true);
  end if;
end $$;
