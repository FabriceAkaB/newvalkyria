-- Réponses des familles dans le suivi des relances : refus (« libérez la place ») et intérêt plus tard.
alter table public.outreach_log drop constraint if exists outreach_log_kind_check;
alter table public.outreach_log add constraint outreach_log_kind_check check (kind in ('relance', 'reponse', 'excuse', 'erreur', 'refus', 'plus-tard'));
