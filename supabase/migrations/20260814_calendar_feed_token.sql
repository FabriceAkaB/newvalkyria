-- Jeton secret pour le flux calendrier iCal (abonnement Google Calendar,
-- Apple Calendar, Outlook — format universel RFC 5545, aucune API externe
-- ni identifiants tiers requis). Recherche menée le 13 août 2026 : ni
-- Rétroaction (retroaction.ca) ni TeamLinkt n'exposent d'API publique
-- documentée pour une synchronisation directe — voir l'audit pour le détail.
-- Singleton, même patron que revenue_settings.
create table if not exists public.calendar_feed_token (
  id boolean primary key default true,
  token text not null,
  updated_at timestamptz not null default now(),
  constraint calendar_feed_token_singleton check (id)
);

alter table public.calendar_feed_token enable row level security;
create policy calendar_feed_token_service_role_all on public.calendar_feed_token
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
