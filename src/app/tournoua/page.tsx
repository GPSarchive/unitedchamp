// app/tournoua/page.tsx
import Image from "next/image";
import Link from "next/link";
import { listRunningTournaments, listCompletedTournaments } from "@/app/lib/repos/tournaments";

export const revalidate = 60;

export default async function TournouaPage() {
  const [running, completed] = await Promise.all([
    listRunningTournaments(),
    listCompletedTournaments(),
  ]);

  return (
    <div className="px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Τουρνουά που τρέχουν τώρα</h1>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {(running ?? []).map((t: any) => (
          <Link key={t.id} href={`/tournoua/${t.slug}`} className="group rounded-xl border border-white/15 bg-white/5 p-4 hover:border-white/30">
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-black/40">
                <Image src={t.logo ?? "/placeholder.png"} alt={t.name} fill className="object-contain" />
              </div>
              <div>
                <div className="text-xl font-semibold">{t.name}</div>
                {t.season && <div className="text-white/70 text-sm">{t.season}</div>}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <h2 className="text-2xl font-bold mt-12 mb-4">Ολοκληρωμένα</h2>
      <ul className="space-y-3">
        {(completed ?? []).map((t: any) => (
          <li key={t.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
            <span className="font-medium">{t.name}</span>
            <Link href={`/tournoua/${t.slug}`} className="text-sm underline opacity-80 hover:opacity-100">Περισσότερα</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
