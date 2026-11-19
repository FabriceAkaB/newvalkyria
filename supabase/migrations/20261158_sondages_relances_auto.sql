-- Relances automatiques des sondages (JP, 18 nov. 2026) : 2, 5 et 7 jours après l'envoi, aux familles qui n'ont pas
-- répondu. Seulement pour les sondages envoyés à partir d'aujourd'hui (les anciens ne sont pas relancés d'un coup).
alter table surveys add column if not exists auto_reminders boolean not null default true;
update surveys set auto_reminders = false where (sent_at is not null and sent_at < '2026-11-18') or project_label = 'Personal branding JP Coach';
