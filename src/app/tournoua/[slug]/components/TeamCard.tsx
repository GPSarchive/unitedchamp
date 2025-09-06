// app/tournoua/[slug]/components/TeamCard.tsx
import Image from "next/image";
import Link from "next/link";

type Props = {
  team: { id: number; name: string; logo?: string | null };
  seed?: number | null;
  href?: string; // optional link target (e.g., `/teams/[id]`)
};

export default function TeamCard({ team, seed, href }: Props) {
  const content = (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
      <div className="relative w-12 h-12 rounded-md overflow-hidden bg-black/40">
        <Image
          src={team.logo ?? "/placeholder.png"}
          alt={team.name}
          fill
          className="object-contain"
          sizes="48px"
        />
      </div>
      <div>
        <div className="font-semibold">{team.name}</div>
        {seed != null && (
          <div className="text-xs text-white/60">Seed: {seed}</div>
        )}
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
