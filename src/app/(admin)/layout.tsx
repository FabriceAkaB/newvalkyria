import { AdminChrome } from "@/components/admin-topbar";

/** Le menu de l'admin est rendu une seule fois ici : il reste en place d'une page à l'autre. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-shell">
      <AdminChrome />
      {children}
    </div>
  );
}
