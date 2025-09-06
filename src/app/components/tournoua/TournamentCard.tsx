// components/tournaments/TournamentCard.tsx
import Image from "next/image";
import Link from "next/link";
import StatusBadge from "./StatusBadge";

export type TournamentCardData = {
  id: number;
  name: string;
  slug: string;
  logo?: string | null;
  season?: string | null;
  status?: "scheduled" | "running" | "completed" | "archived" | string | null;
};

export default function TournamentCard({
  t,
  showStatus = false,
}: {
  t: TournamentCardData;
  showStatus?: boolean;
}) {
  return (
    <Link
      href={`/tournoua/${t.slug}`}
      className="group rounded-xl border border-white/15 bg-white/5 p-4 hover:border-white/30 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-black/40">
          <Image
            src={t.logo ?? "/placeholder.png"}
            alt={t.name}
            fill
            className="object-contain"
            sizes="64px"
          />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold truncate">{t.name}</h3>
            {showStatus && <StatusBadge status={t.status} />}
          </div>
          {t.season && (
            <div className="text-white/70 text-sm">{t.season}</div>
          )}
        </div>
      </div>
    </Link>
  );
}
