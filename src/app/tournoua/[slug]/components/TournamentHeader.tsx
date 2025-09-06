// app/tournoua/[slug]/components/TournamentHeader.tsx
import Image from "next/image";

type Props = {
  t: {
    id: number;
    name: string;
    slug: string;
    logo?: string | null;
    season?: string | null;
    status?: string | null;
    format?: string | null;
  };
  rightSlot?: React.ReactNode; // optional area on the right (e.g., actions)
};

export default function TournamentHeader({ t, rightSlot }: Props) {
  return (
    <header className="px-6 py-6 border-b border-white/10 bg-black/40">
      <div className="flex items-center justify-between gap-4">
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
          <div>
            <h1 className="text-3xl font-bold">{t.name}</h1>
            <p className="text-white/70">
              {(t.season ?? "—")} • {(t.format ?? "").toString().toUpperCase()} • {t.status ?? "—"}
            </p>
          </div>
        </div>
        {rightSlot ? <div className="shrink-0">{rightSlot}</div> : null}
      </div>
    </header>
  );
}
