-- Accès des éducateurs (JP, 18 nov. 2026) : connexion avec leur propre courriel, « mot de passe oublié » et invitation
-- par un lien personnel qui expire (le mot de passe est choisi par l'éducateur, jamais écrit par quelqu'un d'autre).
create table if not exists public.coach_password_resets (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  token text not null unique,
  purpose text not null default 'oubli',
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists coach_password_resets_coach on public.coach_password_resets (coach_id, created_at);
alter table public.coach_password_resets enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'coach_password_resets' and policyname = 'service_role_all') then
    create policy service_role_all on public.coach_password_resets for all to service_role using (true) with check (true);
  end if;
end $$;
