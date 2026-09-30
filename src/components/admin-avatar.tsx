"use client";

/** Photo permanente d'une joueuse (players.photo_url) — bulle d'initiales
 *  tant qu'aucune photo n'a été téléversée. Partagé entre l'Évaluation et
 *  les Inscriptions : la photo est liée à la fiche joueuse, donc un
 *  changement fait dans l'un se reflète immédiatement dans l'autre. */
export function Avatar({
  firstName,
  lastName,
  photoUrl,
  colorHex,
  size = 32
}: {
  firstName: string | null | undefined;
  lastName: string | null | undefined;
  photoUrl: string | null | undefined;
  colorHex?: string;
  size?: number;
}) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt="" style={{ width: `${size}px`, height: `${size}px`, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: colorHex ?? "#342b40",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: `${Math.max(0.6, size * 0.32) / 16}rem`,
        fontWeight: 700,
        color: "#fff",
        flexShrink: 0
      }}
    >
      {initials || "?"}
    </div>
  );
}
