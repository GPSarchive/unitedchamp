// Preview route — the redesigned players directory. Static + ISR: it reads no
// searchParams on the server, so one cached page serves every filter/sort
// combination and the browser does the rest. The live /paiktes is untouched.
import type { Metadata } from "next";
import DirectoryClient from "./DirectoryClient";
import { loadDirectory } from "./data";
import { PAIKTES_BASE_PATH } from "./paths";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Παίκτες · UltraChamp.gr",
  description: "Όλοι οι παίκτες της σεζόν: γκολ, ασίστ, αγώνες, νίκες και βραβεία ανά διοργάνωση και ομάδα.",
  robots: { index: false, follow: false },
};

export default async function PaiktesV2Page() {
  const data = await loadDirectory();
  return <DirectoryClient data={data} basePath={PAIKTES_BASE_PATH} />;
}
