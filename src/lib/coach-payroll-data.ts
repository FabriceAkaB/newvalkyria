import { computeAssignment } from "@/lib/coach-payroll";
import { getAllAssignments, getAllCoachTypeRates, getCoaches, type AssignmentStatus, type CoachActivity, type CoachStatus } from "@/lib/coaches-repo";
import { formatCAD } from "@/lib/season-2027";

/** Une ligne "à plat" par assignation, avec tout ce qui est nécessaire pour
 *  filtrer/regrouper (paie, exports, statistiques) sans refaire les
 *  jointures ni le calcul heures/taux/paie à chaque fois. */
export interface PayrollRow {
  assignmentId: string;
  coachId: string;
  coachName: string;
  coachStatus: CoachStatus;
  activityId: string;
  activityDate: string;
  activityType: string;
  activityCategory: string | null;
  attendance: AssignmentStatus;
  hours: number;
  rateCents: number;
  payCents: number;
  paid: boolean;
  confirmed: boolean;
}

export interface PayrollFilters {
  month?: string;
  category?: string;
  activityType?: string;
  coachId?: string;
  paid?: "paid" | "unpaid";
  weekStartISO?: string;
}

export function filterPayrollRows(rows: PayrollRow[], filters: PayrollFilters): PayrollRow[] {
  return rows.filter((r) => {
    if (filters.month && r.activityDate.slice(0, 7) !== filters.month) return false;
    if (filters.category && r.activityCategory !== filters.category) return false;
    if (filters.activityType && r.activityType !== filters.activityType) return false;
    if (filters.coachId && r.coachId !== filters.coachId) return false;
    if (filters.paid === "paid" && !r.paid) return false;
    if (filters.paid === "unpaid" && r.paid) return false;
    if (filters.weekStartISO && r.activityDate < filters.weekStartISO) return false;
    return true;
  });
}

export interface CoachPayrollTotal {
  coachId: string;
  name: string;
  hours: number;
  avgRateCents: number;
  payCents: number;
  paidCents: number;
  remainingCents: number;
}

export function groupPayrollByCoach(rows: PayrollRow[]): CoachPayrollTotal[] {
  const map = new Map<string, { name: string; hours: number; payCents: number; paidCents: number }>();
  for (const r of rows) {
    const entry = map.get(r.coachId) ?? { name: r.coachName, hours: 0, payCents: 0, paidCents: 0 };
    entry.hours += r.hours;
    entry.payCents += r.payCents;
    if (r.paid) entry.paidCents += r.payCents;
    map.set(r.coachId, entry);
  }
  return Array.from(map.entries()).map(([coachId, v]) => ({
    coachId,
    ...v,
    avgRateCents: v.hours > 0 ? Math.round(v.payCents / v.hours) : 0,
    remainingCents: v.payCents - v.paidCents
  }));
}

export async function getPayrollRows(): Promise<PayrollRow[]> {
  const [coaches, assignments, typeRates] = await Promise.all([getCoaches(), getAllAssignments(), getAllCoachTypeRates()]);
  const typeRateMap = new Map(typeRates.map((r) => [`${r.coach_id}:${r.activity_type}`, r.hourly_rate_cents]));

  return assignments.map((a) => {
    const computed = computeAssignment({
      status: a.status,
      arrivalTime: a.arrival_time,
      departureTime: a.departure_time,
      activityStartTime: a.activity.start_time,
      activityEndTime: a.activity.end_time,
      assignmentRateCents: a.hourly_rate_cents,
      typeRateCents: typeRateMap.get(`${a.coach_id}:${a.activity.activity_type}`) ?? null,
      defaultRateCents: a.coach.default_hourly_rate_cents
    });

    return {
      assignmentId: a.id,
      coachId: a.coach_id,
      coachName: `${a.coach.first_name} ${a.coach.last_name}`,
      coachStatus: a.coach.status,
      activityId: a.activity_id,
      activityDate: a.activity.activity_date,
      activityType: a.activity.activity_type,
      activityCategory: a.activity.category,
      attendance: a.status,
      hours: computed.hours,
      rateCents: computed.rateCents,
      payCents: computed.payCents,
      paid: a.paid,
      confirmed: a.confirmed
    };
  });
}

export interface CoachNotification {
  type: "unpaid" | "overdue" | "unconfirmed" | "unassigned" | "certification_expired" | "certification_expiring";
  message: string;
  href: string;
}

/** Rappels dérivés des données existantes — aucun n'est stocké, tout est
 *  recalculé à chaque chargement de la page. "En retard" = versement non
 *  payé pour une activité de plus de 14 jours (seuil raisonnable en
 *  l'absence d'échéance de paiement explicite dans le système). */
export function computeCoachNotifications(rows: PayrollRow[], activities: CoachActivity[], today: Date = new Date()): CoachNotification[] {
  const notifications: CoachNotification[] = [];
  const todayISO = today.toISOString().slice(0, 10);
  const overdueThreshold = new Date(today);
  overdueThreshold.setDate(today.getDate() - 14);
  const overdueISO = overdueThreshold.toISOString().slice(0, 10);

  const balances = groupPayrollByCoach(rows).filter((c) => c.remainingCents > 0);
  if (balances.length > 0) {
    const total = balances.reduce((s, c) => s + c.remainingCents, 0);
    notifications.push({
      type: "unpaid",
      message: `${balances.length} entraîneur(s) à payer — ${formatCAD(total / 100)} au total`,
      href: "/admin/entraineurs/paie"
    });
  }

  const overdue = rows.filter((r) => !r.paid && r.attendance === "present" && r.activityDate < overdueISO);
  if (overdue.length > 0) {
    notifications.push({
      type: "overdue",
      message: `${overdue.length} versement(s) en retard (activité de plus de 14 jours, toujours non payé)`,
      href: "/admin/entraineurs/paie"
    });
  }

  const unconfirmed = rows.filter((r) => !r.confirmed && r.activityDate <= todayISO && r.attendance === "present");
  if (unconfirmed.length > 0) {
    notifications.push({
      type: "unconfirmed",
      message: `${unconfirmed.length} présence(s) passée(s) pas encore confirmée(s)`,
      href: "/admin/entraineurs/activites"
    });
  }

  const assignedActivityIds = new Set(rows.map((r) => r.activityId));
  const unassigned = activities.filter((a) => !assignedActivityIds.has(a.id));
  if (unassigned.length > 0) {
    notifications.push({
      type: "unassigned",
      message: `${unassigned.length} activité(s) sans aucun entraîneur assigné`,
      href: "/admin/entraineurs/activites"
    });
  }

  return notifications;
}
