import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BoysRegistrationsTable } from "@/components/admin-boys-registrations";
import type { BoysRegistrationRow } from "@/lib/boys-registrations";

const base = { package: "complet" as const, playerDob: null, birthYear: 2015, parentPhone: "514-555-0100", priceCents: 31595, trialDate: null, comments: null, statusDetail: null } as const;

const rows: BoysRegistrationRow[] = [
  { ...base, key: "session:1", source: "session", id: "1", programSlug: "intensif-garcons", programLabel: "Programme Intensif", playerName: "Laurent Bayard", parentName: "Marilyn Coutu", parentEmail: "m@example.com", status: "paid", createdAt: "2026-10-06T04:55:00Z" },
  { ...base, key: "session:2", source: "session", id: "2", programSlug: "garcons-2018", programLabel: "Garçons 2018", playerName: "Petit Test", birthYear: 2018, parentName: "Parent Deux", parentEmail: "p2@example.com", status: "pending", createdAt: "2026-10-12T04:55:00Z" },
  { ...base, key: "sport-etudes:3", source: "sport-etudes", id: "3", programSlug: "sport-etudes", programLabel: "Sport-Études", playerName: "Enzo Ndongo", parentName: "Étienne Ndongo", parentEmail: "e@example.com", status: "confirmed", createdAt: "2026-09-20T04:55:00Z" },
  { ...base, key: "trial:4", source: "trial", id: "4", programSlug: "garcons-2018", programLabel: "Garçons 2018", playerName: "Essai Gratuit", birthYear: 2018, parentName: "Parent Essai", parentEmail: "t@example.com", status: "trial", statusDetail: "Essai confirmé", trialDate: "2026-10-20", priceCents: 0, createdAt: "2026-10-13T04:55:00Z" },
  { ...base, key: "session:5", source: "session", id: "5", programSlug: "intensif-garcons", programLabel: "Programme Intensif", playerName: "Annulé Test", parentName: "Parent Cinq", parentEmail: "c@example.com", status: "cancelled", createdAt: "2026-10-01T04:55:00Z" }
];

const bodyRows = () => within(document.querySelector("tbody") as HTMLElement).getAllByRole("row");

describe("Inscriptions garçons (même format que les filles)", () => {
  it("affiche tous les programmes garçons, sans les annulées par défaut", () => {
    render(<BoysRegistrationsTable initialRows={rows} />);
    expect(bodyRows()).toHaveLength(4);
    expect(screen.getByText("Inscriptions garçons (4)")).toBeTruthy();
  });

  it("l'inscrit « en attente » et l'essai gratuit apparaissent comme dans la liste des filles", () => {
    render(<BoysRegistrationsTable initialRows={rows} />);
    expect(screen.getByText("Petit Test")).toBeTruthy();
    expect(screen.getByText(/Essai confirmé/)).toBeTruthy();
  });

  it("filtre par statut, par programme et par recherche", () => {
    render(<BoysRegistrationsTable initialRows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: /Payée/ }));
    expect(bodyRows()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /Toutes/ }));
    fireEvent.change(screen.getByDisplayValue("Tous les programmes garçons"), { target: { value: "sport-etudes" } });
    expect(bodyRows()).toHaveLength(1);
    fireEvent.change(screen.getByDisplayValue("Sport-Études"), { target: { value: "all" } });
    fireEvent.change(screen.getByPlaceholderText(/Rechercher/), { target: { value: "bayard" } });
    expect(bodyRows()).toHaveLength(1);
  });
});
