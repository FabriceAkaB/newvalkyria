"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AdminTopbar } from "@/components/admin-topbar";

export interface TrialCalendarEntry {
  id: string;
  date: string | null;
  playerName: string;
  parentName: string;
  parentPhone: string;
  seasonLabel: string;
  detailHref: string;
  seasonId?: string;
  slotId?: string | null;
}

export interface TrialCalendarSlot {
  id: string;
  date: string;
  start: string;
  end: string;
  location: string;
  max: number;
  active: boolean;
}

interface Props {
  entries: TrialCalendarEntry[];
  slots: TrialCalendarSlot[];
  categories: { id: string; label: string }[];
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DEFAULT_THRESHOLD = 6;

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function monthLabel(year: number, month: number): string {
  const label = new Date(year, month, 1).toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Grille du mois — lundi en première colonne, cases vides (null) pour compléter la première/dernière semaine. */
function buildMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7; // lundi = 0

  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function AdminEssaisCalendrier({ entries, slots, categories }: Props) {
  const router = useRouter();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ playerFirstName: "", playerLastName: "", parentName: "", parentPhone: "", parentEmail: "", categoryId: "", date: "", trialSlotId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, TrialCalendarSlot[]>();
    for (const sl of slots) {
      const list = map.get(sl.date) ?? [];
      list.push(sl);
      map.set(sl.date, list);
    }
    return map;
  }, [slots]);
  const slotById = useMemo(() => new Map(slots.map((sl) => [sl.id, sl])), [slots]);
  const slotLabel = (sl: TrialCalendarSlot) => `${sl.start}–${sl.end} · ${sl.location}`;

  const openForm = (date: string | null) => {
    setForm((f) => ({ ...f, date: date ?? f.date, trialSlotId: "" }));
    setFormError(null);
    setShowForm(true);
  };

  const submitForm = async () => {
    if (!form.playerFirstName.trim()) { setFormError("Le prénom de la joueuse est requis."); return; }
    if (!form.date) { setFormError("Choisis une date."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/essais-ajout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, categoryId: form.categoryId || null, trialSlotId: form.trialSlotId || null })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur lors de l'ajout");
      const added = form.date;
      setShowForm(false);
      setForm({ playerFirstName: "", playerLastName: "", parentName: "", parentPhone: "", parentEmail: "", categoryId: "", date: "", trialSlotId: "" });
      setYear(Number(added.slice(0, 4)));
      setMonth(Number(added.slice(5, 7)) - 1);
      setSelectedDate(added);
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const setEntryDate = async (e: TrialCalendarEntry, date: string) => {
    if (!e.seasonId || !date) return;
    await fetch(`/api/admin/season/${e.seasonId}/registrations/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trialDate: date })
    });
    router.refresh();
  };

  const dated = useMemo(() => entries.filter((e) => e.date), [entries]);
  const undated = useMemo(() => entries.filter((e) => !e.date), [entries]);

  const byDate = useMemo(() => {
    const map = new Map<string, TrialCalendarEntry[]>();
    for (const e of dated) {
      const list = map.get(e.date!) ?? [];
      list.push(e);
      map.set(e.date!, list);
    }
    return map;
  }, [dated]);

  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const goToPrevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); } else { setMonth((m) => m - 1); }
    setSelectedDate(null);
  };
  const goToNextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); } else { setMonth((m) => m + 1); }
    setSelectedDate(null);
  };

  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedEntries = selectedDate ? (byDate.get(selectedDate) ?? []) : [];
  const selectedSlots = selectedDate ? (slotsByDate.get(selectedDate) ?? []) : [];

  const monthTotal = weeks.flat().reduce<number>((sum, day) => {
    if (day === null) return sum;
    return sum + (byDate.get(toDateKey(year, month, day))?.length ?? 0);
  }, 0);

  return (
    <>
      <AdminTopbar />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Calendrier des essais</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Toutes les joueuses à l&apos;essai, peu importe la saison, regroupées par journée — pour repérer d&apos;un coup d&apos;œil les journées trop chargées.
          </p>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <button className="admin-btn-ghost" style={{ padding: "0.35rem 0.7rem" }} onClick={goToPrevMonth}>←</button>
              <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#fff", margin: 0, minWidth: "160px", textAlign: "center" }}>{monthLabel(year, month)}</p>
              <button className="admin-btn-ghost" style={{ padding: "0.35rem 0.7rem" }} onClick={goToNextMonth}>→</button>
            </div>
            <button className="admin-export-btn" onClick={() => openForm(selectedDate)}>+ Ajouter un essai</button>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "#9d9da0" }}>
              Seuil d&apos;alerte par jour
              <input
                type="number"
                min={1}
                className="admin-input"
                style={{ width: "70px" }}
                value={threshold}
                onChange={(e) => setThreshold(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </label>
          </div>

          {showForm && (
            <div style={{ background: "#100e17", border: "1px solid #3a3550", borderRadius: "10px", padding: "1rem", marginBottom: "1.25rem" }}>
              <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Ajouter une joueuse à l&apos;essai</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.5rem" }}>
                <input className="admin-input" placeholder="Prénom de la joueuse *" value={form.playerFirstName} onChange={(e) => setForm({ ...form, playerFirstName: e.target.value })} />
                <input className="admin-input" placeholder="Nom de la joueuse" value={form.playerLastName} onChange={(e) => setForm({ ...form, playerLastName: e.target.value })} />
                <input className="admin-input" placeholder="Nom du parent" value={form.parentName} onChange={(e) => setForm({ ...form, parentName: e.target.value })} />
                <input className="admin-input" placeholder="Téléphone" value={form.parentPhone} onChange={(e) => setForm({ ...form, parentPhone: e.target.value })} />
                <input className="admin-input" placeholder="Courriel (facultatif)" value={form.parentEmail} onChange={(e) => setForm({ ...form, parentEmail: e.target.value })} />
                <select className="admin-group-select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">Catégorie (facultatif)</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <input type="date" className="admin-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value, trialSlotId: "" })} />
                <select className="admin-group-select" value={form.trialSlotId} onChange={(e) => setForm({ ...form, trialSlotId: e.target.value })} disabled={!form.date}>
                  <option value="">Sans plage officielle (date seulement)</option>
                  {(slotsByDate.get(form.date) ?? []).map((sl) => <option key={sl.id} value={sl.id}>{slotLabel(sl)} — {sl.max} places</option>)}
                </select>
              </div>
              {formError && <p style={{ color: "#ff9999", fontSize: "0.75rem", margin: "0.6rem 0 0" }}>{formError}</p>}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                <button className="admin-export-btn" onClick={submitForm} disabled={saving}>{saving ? "Ajout…" : "Ajouter l'essai"}</button>
                <button className="admin-btn-ghost" onClick={() => setShowForm(false)}>Annuler</button>
              </div>
            </div>
          )}

          <p style={{ fontSize: "0.72rem", color: "#6d6b71", marginBottom: "0.75rem" }}>{monthTotal} essai(s) planifié(s) ce mois-ci</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.4rem", marginBottom: "0.4rem" }}>
            {WEEKDAY_LABELS.map((d) => (
              <div key={d} style={{ fontSize: "0.65rem", color: "#6d6b71", textAlign: "center", fontWeight: 600 }}>{d}</div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1.5rem" }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.4rem" }}>
                {week.map((day, di) => {
                  if (day === null) return <div key={di} />;
                  const dateKey = toDateKey(year, month, day);
                  const dayEntries = byDate.get(dateKey) ?? [];
                  const count = dayEntries.length;
                  const daySlots = slotsByDate.get(dateKey) ?? [];
                  const isToday = dateKey === todayKey;
                  const isSelected = dateKey === selectedDate;
                  const over = count > threshold;
                  const atThreshold = count === threshold && count > 0;

                  let background = "#100e17";
                  let borderColor = "#1f1d25";
                  if (over) { background = "rgba(255, 100, 100, 0.15)"; borderColor = "rgba(255, 100, 100, 0.5)"; }
                  else if (atThreshold) { background = "rgba(255, 180, 100, 0.15)"; borderColor = "rgba(255, 180, 100, 0.5)"; }
                  else if (count > 0) { background = "rgba(136, 192, 208, 0.1)"; borderColor = "rgba(136, 192, 208, 0.4)"; }
                  else if (daySlots.length > 0) { background = "rgba(143, 206, 159, 0.07)"; borderColor = "rgba(143, 206, 159, 0.35)"; }
                  if (isSelected) borderColor = "#8d76a5";

                  return (
                    <button
                      key={di}
                      onClick={() => setSelectedDate(dateKey === selectedDate ? null : dateKey)}
                      style={{
                        background,
                        border: `1px solid ${borderColor}`,
                        borderRadius: "8px",
                        padding: "0.5rem 0.4rem",
                        minHeight: "92px",
                        textAlign: "left",
                        cursor: "pointer",
                        overflow: "hidden",
                        outline: isToday ? "1px solid rgba(255,255,255,0.3)" : "none"
                      }}
                    >
                      <p style={{ fontSize: "0.7rem", color: "#9d9da0", margin: 0 }}>{day}</p>
                      {count > 0 && (
                        <p style={{ fontSize: "0.85rem", fontWeight: 700, color: over ? "#ff9999" : atThreshold ? "#ffb464" : "#88c0d0", margin: "0.2rem 0 0.15rem" }}>
                          {count}
                        </p>
                      )}
                      {dayEntries.slice(0, 4).map((e) => (
                        <p key={e.id} style={{ fontSize: "0.62rem", color: "#d8d8e0", margin: 0, lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.playerName}</p>
                      ))}
                      {dayEntries.length > 4 && <p style={{ fontSize: "0.6rem", color: "#9d9da0", margin: 0 }}>+{dayEntries.length - 4} autres</p>}
                      {count === 0 && daySlots.length > 0 && <p style={{ fontSize: "0.6rem", color: "#8fce9f", margin: "0.2rem 0 0" }}>Plage ouverte · 0/{daySlots.reduce((n, sl) => n + sl.max, 0)}</p>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {selectedDate && (
            <div style={{ marginBottom: "2rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <p className="admin-section-title" style={{ fontSize: "0.85rem", margin: 0 }}>
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })} — {selectedEntries.length} essai(s)
                </p>
                <button className="admin-export-btn" onClick={() => openForm(selectedDate)}>+ Ajouter un essai ce jour-là</button>
              </div>
              {selectedSlots.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", marginBottom: "0.75rem" }}>
                  {selectedSlots.map((sl) => {
                    const n = selectedEntries.filter((e) => e.slotId === sl.id).length;
                    return (
                      <p key={sl.id} style={{ fontSize: "0.72rem", color: n >= sl.max ? "#ffb464" : "#8fce9f", margin: 0 }}>
                        Plage {slotLabel(sl)} — {n}/{sl.max} place(s){sl.active ? "" : " (inactive)"}
                      </p>
                    );
                  })}
                </div>
              )}
              {selectedEntries.length === 0 && <p className="admin-empty-text">Aucun essai ce jour-là pour l&apos;instant.</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {selectedEntries.map((e) => (
                  <Link
                    key={e.id}
                    href={e.detailHref}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.6rem 0.9rem", textDecoration: "none" }}
                  >
                    <div>
                      <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff", margin: 0 }}>{e.playerName}</p>
                      <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", margin: "0.1rem 0 0" }}>{e.parentName} · {e.parentPhone}{e.slotId && slotById.get(e.slotId) ? ` · ${slotById.get(e.slotId)!.start}–${slotById.get(e.slotId)!.end}` : ""}</p>
                    </div>
                    <span style={{ fontSize: "0.6rem", color: "#88c0d0", background: "rgba(136,192,208,0.1)", padding: "0.15rem 0.5rem", borderRadius: "4px", whiteSpace: "nowrap" }}>{e.seasonLabel}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Sans date planifiée ({undated.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {undated.length === 0 && <p className="admin-empty-text">Aucun essai sans date.</p>}
            {undated.map((e) => (
              <div
                key={e.id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "8px", padding: "0.6rem 0.9rem" }}
              >
                <Link href={e.detailHref} style={{ textDecoration: "none" }}>
                  <p style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff", margin: 0 }}>{e.playerName}</p>
                  <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", margin: "0.1rem 0 0" }}>{e.parentName} · {e.parentPhone}</p>
                </Link>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {e.seasonId && (
                    <input type="date" className="admin-input" style={{ width: "150px" }} title="Choisir la date d'essai" onChange={(ev) => setEntryDate(e, ev.target.value)} />
                  )}
                  <span style={{ fontSize: "0.6rem", color: "#88c0d0", background: "rgba(136,192,208,0.1)", padding: "0.15rem 0.5rem", borderRadius: "4px", whiteSpace: "nowrap" }}>{e.seasonLabel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
