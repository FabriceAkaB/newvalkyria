import { redirect } from "next/navigation";

/** Ancienne page du Programme intensif 2015 : tout (inscriptions, places, séances) est
 *  maintenant sur la page du programme, onglet « Intensif 2015 » de Garçons & Sport-Études. */
export default function AdminProgrammeIntensifPage() {
  redirect("/admin/programme/intensif-garcons");
}
