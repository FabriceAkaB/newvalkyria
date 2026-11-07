import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TaskResponse } from "@/components/team-task-response";
import { getTeamTaskByToken, markTeamTaskSeen } from "@/lib/team-tasks-repo";

export const metadata: Metadata = { title: "Tâche — New Valkyria", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const frDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Page personnelle d'une tâche confiée par JP : la personne dit « je m'en occupe » puis « c'est fait », sans compte. */
export default async function TachePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const task = await getTeamTaskByToken(token);
  if (!task) notFound();
  await markTeamTaskSeen(task);
  const late = task.due && task.status !== "fait" && task.due < new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#5b2a86" }}>Tâche confiée par JP</p>
      <section style={{ background: "#fff", borderRadius: 14, padding: "20px 18px", border: "1px solid #e6e0ee" }}>
        <p style={{ margin: "0 0 4px", color: "#6b6478", fontSize: "0.9rem" }}>Pour {task.assignee}</p>
        <h1 style={{ margin: 0, fontSize: "1.35rem", lineHeight: 1.3 }}>{task.title}</h1>
        {task.details ? <p style={{ margin: "12px 0 0", whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{task.details}</p> : null}
        {task.due ? (
          <p style={{ margin: "12px 0 0", fontWeight: 700, color: late ? "#b42318" : "#5b2a86" }}>
            {late ? "En retard : prévue le " : "Pour le "}
            {frDay(task.due)}
          </p>
        ) : null}
      </section>
      <TaskResponse token={token} initialStatus={task.status} initialNote={task.done_note ?? ""} initialLink={task.evidence_url ?? ""} />
    </div>
  );
}
