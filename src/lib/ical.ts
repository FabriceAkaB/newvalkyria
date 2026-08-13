import type { CalendarEvent } from "@/lib/calendar-repo";

/** Génération iCal (RFC 5545) — format universel supporté par Google
 *  Calendar, Apple Calendar et Outlook via une simple URL d'abonnement,
 *  sans API ni identifiants tiers. TZID utilise l'identifiant IANA
 *  America/Toronto directement (reconnu nativement par les principaux
 *  clients même sans bloc VTIMEZONE complet — approche standard pour un
 *  flux à usage interne comme celui-ci). */

function foldLine(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  parts.push(rest);
  return parts.join("\r\n");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function timestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function generateICS(events: CalendarEvent[]): string {
  const now = timestamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//New Valkyria//Calendrier//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:New Valkyria — Calendrier",
    "X-WR-TIMEZONE:America/Toronto"
  ];

  for (const e of events) {
    const dateCompact = e.date.replace(/-/g, "");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${e.kind}-${e.id}@newvalkyria.com`);
    lines.push(`DTSTAMP:${now}`);

    if (e.startTime && e.endTime) {
      const start = e.startTime.slice(0, 5).replace(":", "") + "00";
      const end = e.endTime.slice(0, 5).replace(":", "") + "00";
      lines.push(`DTSTART;TZID=America/Toronto:${dateCompact}T${start}`);
      lines.push(`DTEND;TZID=America/Toronto:${dateCompact}T${end}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateCompact}`);
    }

    lines.push(foldLine(`SUMMARY:${escapeText(e.title)}`));
    if (e.location) lines.push(foldLine(`LOCATION:${escapeText(e.location)}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
