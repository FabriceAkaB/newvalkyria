-- Rappel envoyé quelques jours avant le prélèvement automatique d'un versement
-- (programmes privés garçons). Null = pas encore envoyé.
alter table public.session_program_payment_plan_installments add column if not exists reminder_sent_at timestamptz;
