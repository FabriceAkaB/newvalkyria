import { Public_Sans } from "next/font/google";

/** Police "Public Sans" extraite de la charte visuelle fournie pour l'écran
 *  de création d'exercice (voir .exercise-create-panel dans globals.css) —
 *  chargée ici plutôt que dans layout.tsx pour rester scopée à cet écran
 *  précis, sans toucher la typographie du reste du site. */
export const publicSans = Public_Sans({
  variable: "--font-exercise-create",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"]
});
