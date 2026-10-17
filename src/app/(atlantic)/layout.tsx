/* eslint-disable @next/next/no-img-element */

/** Mise en page FC Atlantic : logo FC Atlantic seulement, aucune mention de New Valkyria. */
export default function AtlanticLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="page-background" aria-hidden />
      <header style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.7rem", padding: "1.1rem 1rem" }}>
        <img src="/brand/fc-atlantic.jpg" alt="FC Atlantic" width={52} height={52} style={{ height: "52px", width: "52px", borderRadius: "10px", objectFit: "cover" }} />
        <span className="font-display" style={{ fontSize: "1.15rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "#fff" }}>FC Atlantic</span>
      </header>
      <main>{children}</main>
      <footer style={{ marginTop: "4rem", padding: "2rem 1rem 2.5rem", textAlign: "center", background: "#06040c", fontSize: "0.78rem", color: "rgba(255,255,255,0.45)" }}>
        <p style={{ margin: 0, color: "#fff", letterSpacing: "0.18em", textTransform: "uppercase" }}>FC Atlantic</p>
        <p style={{ margin: "0.4rem 0 0" }}>Programme intensif de soccer · encadré par un coach certifié</p>
      </footer>
    </>
  );
}
