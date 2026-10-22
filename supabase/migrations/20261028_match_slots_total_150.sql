-- Coût total d'une plage de match = 150 $ : acompte de 50 $ en ligne + solde de 100 $ le jour du match.
alter table public.match_slots alter column balance_due_cents set default 10000;
update public.match_slots s set balance_due_cents = 10000
 where balance_due_cents = 15000
   and not exists (select 1 from public.match_slot_bookings b where b.slot_id = s.id and b.status in ('pending', 'paid'));
