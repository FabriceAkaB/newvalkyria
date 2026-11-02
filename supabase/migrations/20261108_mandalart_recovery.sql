-- Argent à rattraper (ex. « 10 000 $ avancés par JP pour 3 mois de charges ») : s'ajoute à l'écart
-- du plan, et le Mandalart propose des leviers chiffrés pour aller le chercher.
create table if not exists public.mandalart_recovery (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  label text not null,
  amount_cents integer not null check (amount_cents > 0),
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.mandalart_recovery enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'mandalart_recovery' and policyname = 'mandalart_recovery_service_role_all') then
    create policy mandalart_recovery_service_role_all on public.mandalart_recovery for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end $$;
