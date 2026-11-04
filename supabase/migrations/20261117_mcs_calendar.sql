-- Réglages du club, une valeur par clé, lus et écrits côté serveur seulement (service role).
-- Première clé : 'mcs_ical_url', le lien d'abonnement iCal du calendrier MonClubSportif
-- (tâche Mandalart P8.4.08, agent A12 : comparer ce calendrier à celui de l'admin).
-- club_id : le même système peut servir à un autre club. Aucune donnée d'enfant ici (Loi 25).

create table if not exists public.app_settings (
  club_id text not null default 'new-valkyria',
  key text not null,
  value text,
  updated_at timestamptz not null default now(),
  primary key (club_id, key)
);

alter table public.app_settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['app_settings'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_service_role_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', t || '_service_role_all', t);
    end if;
  end loop;
end $$;
