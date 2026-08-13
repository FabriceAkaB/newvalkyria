-- Journal d'audit (section 36 de l'audit) : qui/quoi/quand pour les actions
-- à fort impact — statut/suppression d'inscription, suppression de lead,
-- suppression d'entraîneur. Pas une couverture exhaustive de toutes les
-- mutations du système (portée volontairement bornée aux actions les plus
-- sensibles), mais la table/le repo sont réutilisables pour en ajouter
-- d'autres progressivement.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_role text not null,
  actor_label text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  entity_label text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;
create policy audit_log_service_role_all on public.audit_log
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create index if not exists idx_audit_log_entity on public.audit_log(entity_type, entity_id);
create index if not exists idx_audit_log_created on public.audit_log(created_at desc);
