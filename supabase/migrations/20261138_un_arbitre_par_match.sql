-- Un seul arbitre par match (demande de JP, 6 nov. 2026) : défaut 1, tous les matchs à 1,
-- et le 2e poste encore ouvert de chaque match est annulé (aucun poste réservé n'est touché).
alter table public.match_slots alter column referees_needed set default 1;
update public.match_slots set referees_needed = 1 where referees_needed <> 1;
update public.referee_assignments a set status = 'annule'
where a.status = 'ouvert'
  and a.id <> (
    select b.id from public.referee_assignments b
    where b.match_slot_id = a.match_slot_id and b.status <> 'annule'
    order by (b.status = 'reserve') desc, b.created_at, b.id
    limit 1
  );
