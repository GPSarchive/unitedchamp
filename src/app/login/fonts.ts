// Typeface of the sign-in screen, loaded only here.
//   Inter Tight: all text. Carries Greek.
import { Inter_Tight } from "next/font/google";

const sans = Inter_Tight({
  subsets: ["latin", "greek"],
  weight: ["400", "600", "800"],
  variable: "--font-auth-sans",
  display: "swap",
});

export const authFontClass = sans.variable;
