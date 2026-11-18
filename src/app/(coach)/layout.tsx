import { adminFont } from "@/lib/admin-font";
import { getAdminTheme } from "@/lib/admin-theme";
import "./coach.css";

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const theme = await getAdminTheme();
  return (
    <div className={`admin-shell ${adminFont.variable}`} data-theme={theme}>
      {children}
    </div>
  );
}
