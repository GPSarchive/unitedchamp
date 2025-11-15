import {
  FaUser,
  FaRulerVertical,
  FaBirthdayCake,
  FaFutbol,
  FaHandsHelping,
  FaExclamationTriangle,
  FaTimesCircle,
  FaCircle,
  FaUsers,
} from "react-icons/fa";
import AvatarImage from "./AvatarImage";
import { PlayerAssociation } from "@/app/lib/types";
import { resolvePlayerPhotoUrl } from "@/app/lib/player-images";

interface PlayersGridProps {
  playerAssociations: PlayerAssociation[] | null;
  seasonStatsByPlayer?: Record<number, any[]>;
  errorMessage?: string | null;
}

const DEV = process.env.NODE_ENV !== "production";

export default function PlayersGrid({
  playerAssociations,
  seasonStatsByPlayer,
  errorMessage,
}: PlayersGridProps) {
  if (errorMessage) {
    return <p className="text-red-400">Error loading players: {errorMessage}</p>;
  }

  if (!playerAssociations || playerAssociations.length === 0) {
    return <p className="text-zinc-400">No players currently on this team.</p>;
  }

  return (
    <section className="rounded-2xl p-6 shadow-xl backdrop-blur-sm border border-amber-500/20 bg-gradient-to-b from-stone-900/60 via-amber-950/5 to-zinc-900">
      <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-red-400 mb-6 flex items-center gap-2">
        <FaUsers className="text-amber-400" /> Squad
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {playerAssociations.map((assoc) => {
          const p = assoc.player;
          const photoUrl = resolvePlayerPhotoUrl(p.photo);

          const stats =
            p.player_statistics?.[0] ?? {
              age: null,
              total_goals: 0,
              total_assists: 0,
              yellow_cards: 0,
              red_cards: 0,
              blue_cards: 0,
            };

          const perSeason = (seasonStatsByPlayer?.[p.id] ?? []) as Array<{
            season: string;
            matches: number;
            goals: number;
            assists: number;
            yellow_cards: number;
            red_cards: number;
            blue_cards: number;
            mvp: number;
            best_gk: number;
            updated_at: string;
          }>;

          return (
            <div
              key={p.id}
              className="group relative aspect-[5/8] rounded-xl overflow-hidden border-2 border-amber-600/40 hover:border-amber-400/70 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/30 hover:scale-[1.02]"
            >
              {/* Background Image */}
              <div className="absolute inset-0">
                <AvatarImage
                  src={photoUrl}
                  alt={`${p.first_name} ${p.last_name}`}
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                />
                {/* Gradient Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent opacity-90" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
              </div>

              {/* Content Overlay */}
              <div className="absolute inset-0 flex flex-col justify-between p-4">
                {/* Top Section - Name & Basic Info */}
                <div className="space-y-1">
                  <h3 className="font-bold text-white text-lg leading-tight drop-shadow-lg">
                    {p.first_name} {p.last_name}
                  </h3>
                  <div className="flex flex-wrap gap-2 text-[10px] text-zinc-200/90">
                    <span className="inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                      <FaUser className="text-amber-400" /> {p.position ?? "—"}
                    </span>
                    {p.height_cm && (
                      <span className="inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                        <FaRulerVertical className="text-amber-400" /> {p.height_cm}cm
                      </span>
                    )}
                    {p.birth_date && (
                      <span className="inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                        <FaBirthdayCake className="text-amber-400" />{" "}
                        {new Date(p.birth_date).toLocaleDateString("el-GR")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Section - Stats */}
                <div className="space-y-2">
                  {/* Quick Stats */}
                  <div className="flex justify-between items-center gap-1 text-xs bg-black/60 backdrop-blur-md rounded-lg p-2 border border-amber-500/30">
                    <div className="flex items-center gap-1 text-amber-400">
                      <FaFutbol className="text-[10px]" />
                      <span className="font-semibold text-white">{stats.total_goals ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-400">
                      <FaHandsHelping className="text-[10px]" />
                      <span className="font-semibold text-white">{stats.total_assists ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-400">
                      <FaExclamationTriangle className="text-[10px]" />
                      <span className="font-semibold text-white">{stats.yellow_cards ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-red-400">
                      <FaTimesCircle className="text-[10px]" />
                      <span className="font-semibold text-white">{stats.red_cards ?? 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-blue-400">
                      <FaCircle className="text-[10px]" />
                      <span className="font-semibold text-white">{stats.blue_cards ?? 0}</span>
                    </div>
                  </div>

                  {/* Season Stats - Compact List */}
                  {perSeason.length > 0 && (
                    <div className="bg-black/60 backdrop-blur-md rounded-lg p-2 border border-amber-500/30 max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-amber-600 scrollbar-track-transparent">
                      <div className="space-y-1">
                        {perSeason.map((row, i) => (
                          <div
                            key={i}
                            className="flex justify-between text-[9px] text-zinc-200 border-b border-white/10 last:border-0 pb-1 last:pb-0"
                          >
                            <span className="font-semibold text-amber-400 min-w-[45px]">
                              {row.season}
                            </span>
                            <span className="flex gap-2">
                              <span title="Matches">M:{row.matches}</span>
                              <span title="Goals/Assists">
                                {row.goals}/{row.assists}
                              </span>
                              <span title="Yellow/Red/Blue Cards" className="text-yellow-300">
                                {row.yellow_cards}/{row.red_cards}/{row.blue_cards}
                              </span>
                              {(row.mvp > 0 || row.best_gk > 0) && (
                                <span title="MVP/Best GK" className="text-amber-300">
                                  ⭐{row.mvp + row.best_gk}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {DEV && (
                <div className="absolute top-0 right-0 text-[8px] text-zinc-400 bg-black/80 p-1 rounded-bl max-w-[120px] truncate">
                  {photoUrl}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
