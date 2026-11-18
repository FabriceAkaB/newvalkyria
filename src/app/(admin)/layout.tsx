import { AdminChrome } from "@/components/admin-topbar";
import { adminFont } from "@/lib/admin-font";
import { getAdminTheme } from "@/lib/admin-theme";

/** Le menu de l'admin est rendu une seule fois ici : il reste en place d'une page à l'autre. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const theme = await getAdminTheme();
  return (
    <div className={`admin-shell ${adminFont.variable}`} data-theme={theme}>
      <AdminChrome />
      {children}
    </div>
  );
}
