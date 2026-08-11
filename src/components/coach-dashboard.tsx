"use client";

import Link from "next/link";

import { CoachTopbar } from "@/components/coach-topbar";
import { computeHours, formatHoursMinutes } from "@/lib/coach-payroll";

export interface DashboardActivity {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  category: string | null;
  activityType: string;
  title: string | null;
  otherCoaches: string[];
  expectedCount: number;
  trialCount: number;
}

interface Props {
  coachName: string;
  today: DashboardActivity[];
  upcoming: DashboardActivity[];
}

function ActivityCard({ activity }: { activity: DashboardActivity }) {
  return (
    <Link
      href={`/entraineur/activites/${activity.id}`}
      style={{
        display: "block", background: "#100e17", border: "1px solid #1f1d25", borderRadius: "10px",
        padding: "1rem 1.1rem", textDecoration: "none", color: "inherit"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <div>
          <p style={{ fontSize: "0.9rem", fontWeight: 700, color: "#fff", margin: 0 }}>
            {activity.title ? `${activity.activityType} — ${activity.title}` : activity.activityType}
          </p>
          <p style={{ fontSize: "0.75rem", color: "#9d9da0", margin: "0.2rem 0 0" }}>
            {new Date(activity.date + "T00:00:00").toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
            {" · "}{activity.startTime.slice(0, 5)}–{activity.endTime.slice(0, 5)}
            {" · "}{formatHoursMinutes(computeHours(activity.startTime, activity.endTime))}
          </p>
        </div>
        {activity.category && <span style={{ fontSize: "0.65rem", color: "#88c0d0", background: "rgba(136,192,208,0.1)", padding: "0.2rem 0.5rem", borderRadius: "4px", whiteSpace: "nowrap" }}>{activity.category}</span>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", fontSize: "0.75rem", color: "#c3c2c8" }}>
        {activity.location && <span>📍 {activity.location}</span>}
        <span>👥 {activity.expectedCount} inscrite(s){activity.trialCount > 0 && ` + ${activity.trialCount} essai(s)`}</span>
        {activity.otherCoaches.length > 0 && <span>🧑‍🏫 avec {activity.otherCoaches.join(", ")}</span>}
      </div>
    </Link>
  );
}

export function CoachDashboard({ coachName, today, upcoming }: Props) {
  return (
    <>
      <CoachTopbar coachName={coachName} />
      <div className="admin-content">
        <div className="admin-section">
          <p className="admin-section-title" style={{ marginBottom: "0.3rem" }}>Bonjour, {coachName.split(" ")[0]}</p>
          <p style={{ fontSize: "0.78rem", color: "#6d6b71", marginBottom: "1.5rem" }}>
            Vos activités, groupes et joueuses attendues.
          </p>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>Aujourd&apos;hui ({today.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "2rem" }}>
            {today.length === 0 && <p className="admin-empty-text">Aucune activité aujourd&apos;hui.</p>}
            {today.map((a) => <ActivityCard key={a.id} activity={a} />)}
          </div>

          <p className="admin-section-title" style={{ fontSize: "0.85rem", marginBottom: "0.75rem" }}>À venir ({upcoming.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {upcoming.length === 0 && <p className="admin-empty-text">Aucune activité à venir.</p>}
            {upcoming.slice(0, 10).map((a) => <ActivityCard key={a.id} activity={a} />)}
          </div>
        </div>
      </div>
    </>
  );
}
