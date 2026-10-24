import Image from "next/image";

import logo from "@/content/image/logo/LogoNewValkeryarealincolor.png";

/** Mise en page des contrats d'embauche : fond blanc, texte foncé, simple et lisible. */
export default function ContratLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#f5f3f8", color: "#1d1730" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.7rem", padding: "1.1rem 1rem", background: "#fff", borderBottom: "1px solid #e6e0ee" }}>
        <Image src={logo} alt="New Valkyria" width={40} height={40} style={{ height: "40px", width: "auto" }} priority />
        <span style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "#3b1d5e" }}>New Valkyria</span>
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem 1rem 3rem" }}>{children}</main>
      <footer style={{ padding: "1.5rem 1rem 2rem", textAlign: "center", fontSize: "0.85rem", color: "#6b6478" }}>
        Une question ? <a href="mailto:info@newvalkyria.com" style={{ color: "#5b2a86", fontWeight: 600 }}>info@newvalkyria.com</a>
      </footer>
    </div>
  );
}
