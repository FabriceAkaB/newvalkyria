-- Avis aux parents (Mandalart P1.7.07 et P4.2.01, JP 19 nov. 2026) : un courriel résumé par famille et par jour au plus
-- quand il y a du nouveau pour sa fille (vidéo de progression, bulletin remis, championne du jour). Une ligne par
-- nouvelle et par adresse annoncée : jamais renvoyée. Réglage on/off : app_settings « avis_parents_actif ».
create table if not exists public.parent_notices (
  id uuid primary key default gen_random_uuid(),
  club_id text not null default 'new-valkyria',
  item_key text not null,
  kind text not null check (kind in ('bulletin', 'video', 'champion')),
  registration_id uuid,
  email text not null,
  sent_on date not null,
  sent_at timestamptz not null default now()
);
create unique index if not exists parent_notices_item_email_idx on public.parent_notices (club_id, item_key, email);
create index if not exists parent_notices_email_day_idx on public.parent_notices (email, sent_on);
do $$
begin
  execute 'alter table public.parent_notices enable row level security';
  if not exists (select 1 from pg_policies where tablename = 'parent_notices' and policyname = 'parent_notices_service_role_all') then
    execute 'create policy parent_notices_service_role_all on public.parent_notices for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')';
  end if;
end $$;
