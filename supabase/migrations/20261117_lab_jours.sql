-- Valkyria Lab, plateforme de formation (JP, 17 nov. 2026) : chaque jour où une joueuse fait sa routine à la maison
-- (défi du jour), coché par la famille dans son espace. Sert à la progression et à la série de jours.
create table if not exists public.lab_practice_days (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  access_id uuid not null references public.lab_access(id) on delete cascade,
  player_name text not null,
  day date not null,
  created_at timestamptz not null default now()
);
create unique index if not exists lab_practice_days_one on public.lab_practice_days (access_id, player_name, day);
alter table public.lab_practice_days enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'lab_practice_days' and policyname = 'service_role_all') then
    create policy service_role_all on public.lab_practice_days for all to service_role using (true) with check (true);
  end if;
end $$;
