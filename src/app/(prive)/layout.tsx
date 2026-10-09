import Image from "next/image";

import logo from "@/content/image/logo/LogoNewValkeryarealincolor.png";

/** Mise en page des programmes privés (garçons) : volontairement neutre — le
 *  logo et le nom de l'académie seulement, sans menu ni mention du programme
 *  des filles, pour que la page soit claire pour les familles de garçons. */
export default function PriveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-background" aria-hidden />
      <header style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.7rem", padding: "1.1rem 1rem" }}>
        <Image src={logo} alt="New Valkyria" width={44} height={44} style={{ height: "44px", width: "auto" }} priority />
        <span className="font-display" style={{ fontSize: "1.15rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#fff" }}>New Valkyria</span>
      </header>
      <main>{children}</main>
      <footer style={{ marginTop: "4rem", padding: "2rem 1rem 2.5rem", textAlign: "center", background: "#06040c", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
        <p style={{ margin: 0, color: "#fff", letterSpacing: "0.18em", textTransform: "uppercase" }}>New Valkyria</p>
        <p style={{ margin: "0.4rem 0" }}>Académie technique de soccer · Laurentides, Québec</p>
        <p style={{ margin: 0 }}>
          <a href="mailto:info@newvalkyria.com" style={{ color: "rgba(255,255,255,0.65)" }}>info@newvalkyria.com</a>
        </p>
      </footer>
    </>
  );
}
