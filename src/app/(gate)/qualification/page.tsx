import type { Metadata } from "next";

import { QualificationForm } from "@/components/qualification-form";

export const metadata: Metadata = {
  title: "Qualification | New Valkyria",
  robots: { index: false }
};

export default function QualificationPage() {
  return <QualificationForm />;
}
