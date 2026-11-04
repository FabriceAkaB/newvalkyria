/** Pendant qu'une page de l'admin charge : le menu reste en place, le contenu montre tout de suite sa forme. */
export default function AdminLoading() {
  return (
    <div className="admin-content" aria-busy="true" aria-label="Chargement">
      <div className="admin-section mda">
        <div className="adm-skel" style={{ width: "38%", height: 14 }} />
        <div className="adm-skel" style={{ width: "72%", height: 30, marginTop: 10 }} />
        <div className="adm-skel-grid">
          {[0, 1, 2, 3].map((i) => <div key={i} className="adm-skel" style={{ height: 88 }} />)}
        </div>
        <div className="adm-skel" style={{ height: 220, marginTop: 16 }} />
      </div>
    </div>
  );
}
