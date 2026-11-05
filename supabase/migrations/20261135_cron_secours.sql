-- Tâches automatiques : trace de chaque passage (cron_runs) et déclencheur de secours indépendant de Vercel.
-- Supabase (pg_cron + pg_net) appelle chaque tâche 20 min après Vercel ; la route ne refait rien si Vercel a déjà roulé
-- (src/lib/cron-gate.ts, src/lib/cron-jobs.ts). Après le 5 nov. 2026 : le cron horaire de Vercel n'avait pas roulé.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.cron_runs (
  id bigint generated always as identity primary key,
  name text not null,
  source text not null,
  ok boolean not null default true,
  detail text,
  ran_at timestamptz not null default now()
);
create index if not exists cron_runs_name_idx on public.cron_runs (name, ran_at desc);
alter table public.cron_runs enable row level security;
do $$ begin
  create policy cron_runs_service_role_all on public.cron_runs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;

-- Secret du secours : généré ici, jamais affiché, lu seulement par le service role (site) et pg_cron.
create table if not exists public.cron_backup_config (
  id int primary key check (id = 1),
  secret text not null,
  created_at timestamptz not null default now()
);
alter table public.cron_backup_config enable row level security;
do $$ begin
  create policy cron_backup_config_service_role_all on public.cron_backup_config for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
exception when duplicate_object then null; end $$;
insert into public.cron_backup_config (id, secret) values (1, encode(extensions.gen_random_bytes(32), 'hex')) on conflict (id) do nothing;

-- Déclencheurs de secours (heures UTC), refaits à neuf à chaque exécution de cette migration.
select cron.unschedule(jobname) from cron.job where jobname like 'nv-%';
select cron.schedule('nv-mcs-robot', '25 * * * *', $job$ select net.http_get(url := 'https://www.newvalkyria.com/api/cron/mcs-robot', headers := jsonb_build_object('Authorization', 'Bearer ' || (select secret from public.cron_backup_config where id = 1)), timeout_milliseconds := 300000) $job$);
select cron.schedule('nv-charge-installments', '20 4 * * *', $job$ select net.http_get(url := 'https://www.newvalkyria.com/api/cron/charge-installments', headers := jsonb_build_object('Authorization', 'Bearer ' || (select secret from public.cron_backup_config where id = 1)), timeout_milliseconds := 300000) $job$);
select cron.schedule('nv-mandalart-lundi', '20 11 * * 1', $job$ select net.http_get(url := 'https://www.newvalkyria.com/api/cron/mandalart-lundi', headers := jsonb_build_object('Authorization', 'Bearer ' || (select secret from public.cron_backup_config where id = 1)), timeout_milliseconds := 300000) $job$);
select cron.schedule('nv-pratiques-1', '20 13 * * *', $job$ select net.http_get(url := 'https://www.newvalkyria.com/api/cron/pratiques', headers := jsonb_build_object('Authorization', 'Bearer ' || (select secret from public.cron_backup_config where id = 1)), timeout_milliseconds := 300000) $job$);
select cron.schedule('nv-pratiques-2', '20 21 * * *', $job$ select net.http_get(url := 'https://www.newvalkyria.com/api/cron/pratiques', headers := jsonb_build_object('Authorization', 'Bearer ' || (select secret from public.cron_backup_config where id = 1)), timeout_milliseconds := 300000) $job$);
select cron.schedule('nv-presences-educateurs-1', '20 14 * * *', $job$ select net.http_get(url := 'https://www.newvalkyria.com/api/cron/presences-educateurs', headers := jsonb_build_object('Authorization', 'Bearer ' || (select secret from public.cron_backup_config where id = 1)), timeout_milliseconds := 300000) $job$);
select cron.schedule('nv-presences-educateurs-2', '20 23 * * *', $job$ select net.http_get(url := 'https://www.newvalkyria.com/api/cron/presences-educateurs', headers := jsonb_build_object('Authorization', 'Bearer ' || (select secret from public.cron_backup_config where id = 1)), timeout_milliseconds := 300000) $job$);
select cron.schedule('nv-mandalart-report', '20 9 * * *', $job$ select net.http_get(url := 'https://www.newvalkyria.com/api/cron/mandalart-report', headers := jsonb_build_object('Authorization', 'Bearer ' || (select secret from public.cron_backup_config where id = 1)), timeout_milliseconds := 300000) $job$);
select cron.schedule('nv-mcs-sync', '20 10 * * *', $job$ select net.http_get(url := 'https://www.newvalkyria.com/api/cron/mcs-sync', headers := jsonb_build_object('Authorization', 'Bearer ' || (select secret from public.cron_backup_config where id = 1)), timeout_milliseconds := 300000) $job$);
select cron.schedule('nv-arbitres', '20 15 * * *', $job$ select net.http_get(url := 'https://www.newvalkyria.com/api/cron/arbitres', headers := jsonb_build_object('Authorization', 'Bearer ' || (select secret from public.cron_backup_config where id = 1)), timeout_milliseconds := 300000) $job$);
