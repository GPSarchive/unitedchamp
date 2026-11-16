// Players directory: each row carries the player's card, and a click sends
// that card spinning into a profile that opens on top of the list. Static +
// ISR; the browser does all the filtering.
import type { Metadata } from "next";
import DirectoryClient from "./DirectoryClient";
import { loadDirectoryV3 } from "./data";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Παίκτες · UltraChamp.gr",
  description: "Όλοι οι παίκτες της σεζόν: γκολ, ασίστ, αγώνες, νίκες και βραβεία ανά διοργάνωση και ομάδα.",
};

export default async function PaiktesPage() {
  const data = await loadDirectoryV3();
  return <DirectoryClient data={data} basePath="/paiktes" />;
}
