import { notFound } from "next/navigation";

import { AdminBoysProgram, type ProgramComparison } from "@/components/admin-boys-program";
import { requireAdmin } from "@/lib/admin-auth";
import { getAllBoysRegistrations } from "@/lib/boys-registrations";
import { env } from "@/lib/env";
import { isWaitlistOnly, programBrand } from "@/lib/private-program-view";
import { countHeldPlaces, countPaidPlaces, getWaitlistCount, type PrivateProgram } from "@/lib/private-programs-repo";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

/** Tous les programmes garçons (privés comme le 2014, ou publics comme le Programme intensif 2015). */
async function getBoysProgram(slug: string): Promise<PrivateProgram | null> {
  const { data } = await (getSupabaseAdminClient() as any).from("session_programs").select("*").eq("slug", slug).maybeSingle();
  return (data as PrivateProgram | null) ?? null;
}
import { getProgramDates } from "@/lib/session-programs-repo";

export const metadata = { title: "Programme garçons — Admin New Valkyria", robots: "noindex" };
export const dynamic = "force-dynamic";

/** Les programmes garçons suivis chacun dans leur propre section (menu « Programmes (Garçons) »). */
const BOYS_PROGRAM_SECTIONS = ["garcons-2014", "intensif-garcons", "garcons-2018"] as const;

async function stats(slug: string) {
  const [program, held, paid, waitlist] = await Promise.all([getBoysProgram(slug), countHeldPlaces(slug), countPaidPlaces(slug), getWaitlistCount(slug)]);
  return { program, held, paid, waitlist };
}

export default async function AdminBoysProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireAdmin();
  const { slug } = await params;
  const [{ program, held, paid, waitlist }, rows, dates, others] = await Promise.all([
    stats(slug),
    getAllBoysRegistrations(),
    getProgramDates(slug as never),
    Promise.all(BOYS_PROGRAM_SECTIONS.map(stats))
  ]);
  if (!program) notFound();

  const brand = programBrand(program);
  const link =
    slug === "intensif-garcons"
      ? `${env.publicSiteUrl}/programmes/intensif-garcons`
      : brand === "atlantic"
        ? `${env.publicSiteUrl}/programme/${slug}`
        : `${env.publicSiteUrl}/prive/${slug}`;
  const comparison: ProgramComparison[] = others
    .filter((o) => o.program)
    .map((o) => ({
      slug: o.program!.slug,
      name: o.program!.name,
      capacity: o.program!.max_capacity,
      held: o.held,
      paid: o.paid,
      waitlist: o.waitlist,
      waitlistOnly: isWaitlistOnly(o.program!)
    }));
  const programRows = rows.filter((r) => r.programSlug === slug);
  const collectedCents = programRows.filter((r) => r.status === "paid").reduce((n, r) => n + (r.priceCents ?? 0), 0);

  return (
    <AdminBoysProgram
      program={{
        slug,
        name: program.name,
        brand,
        waitlistOnly: isWaitlistOnly(program),
        priceCents: program.price_cents,
        installmentFeeCents: program.installment_fee_cents,
        capacity: program.max_capacity,
        practices: program.practices_count ?? dates.length,
        matches: program.matches_count ?? 0,
        firstDate: dates[0]?.session_date ?? null,
        lastDate: dates[dates.length - 1]?.session_date ?? null
      }}
      stats={{ held, paid, waitlist, collectedCents }}
      link={link}
      comparison={comparison}
      rows={programRows}
    />
  );
}
