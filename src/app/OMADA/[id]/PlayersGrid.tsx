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
    <section className="rounded-2xl p-6 shadow-lg backdrop-blur-sm border border-white/20 bg-black/50">
      <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 mb-4 flex items-center gap-2">
        <FaUsers className="text-cyan-400" /> Squad
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              className="p-4 rounded-xl bg-black/40 border border-white/20 hover:border-white/40 transition-all hover:shadow-md hover:shadow-cyan-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3 mb-3">
                <AvatarImage
                  src={photoUrl}
                  alt={`${p.first_name} ${p.last_name}`}
                  width={48}
                  height={48}
                  className="rounded-full border-2 border-cyan-400/30 object-cover"
                  sizes="48px"
                />
                <div>
                  <p className="font-semibold text-white" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="text-sm text-white/70 flex flex-wrap items-center gap-3" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}>
                    <span className="inline-flex items-center gap-1">
                      <FaUser /> {p.position ?? "—"}
                    </span>
                    {p.height_cm && (
                      <span className="inline-flex items-center gap-1">
                        <FaRulerVertical /> {p.height_cm}cm
                      </span>
                    )}
                    {p.birth_date && (
                      <span className="inline-flex items-center gap-1">
                        <FaBirthdayCake />{" "}
                        {new Date(p.birth_date).toLocaleDateString("el-GR")}
                      </span>
                    )}
                  </p>

                  {DEV && (
                    <p className="text-[10px] text-zinc-500 break-all mt-1">
                      img: <code>{photoUrl}</code>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-5 gap-2 text-sm">
                <div className="text-center bg-emerald-500/10 border border-emerald-500/20 p-2 rounded">
                  <FaFutbol className="mx-auto text-emerald-400" />
                  <p className="text-white font-semibold">{stats.total_goals ?? 0}</p>
                </div>
                <div className="text-center bg-cyan-500/10 border border-cyan-500/20 p-2 rounded">
                  <FaHandsHelping className="mx-auto text-cyan-400" />
                  <p className="text-white font-semibold">{stats.total_assists ?? 0}</p>
                </div>
                <div className="text-center bg-yellow-500/10 border border-yellow-500/20 p-2 rounded">
                  <FaExclamationTriangle className="mx-auto text-yellow-400" />
                  <p className="text-white font-semibold">{stats.yellow_cards ?? 0}</p>
                </div>
                <div className="text-center bg-red-500/10 border border-red-500/20 p-2 rounded">
                  <FaTimesCircle className="mx-auto text-red-400" />
                  <p className="text-white font-semibold">{stats.red_cards ?? 0}</p>
                </div>
                <div className="text-center bg-blue-500/10 border border-blue-500/20 p-2 rounded">
                  <FaCircle className="mx-auto text-blue-400" />
                  <p className="text-white font-semibold">{stats.blue_cards ?? 0}</p>
                </div>
              </div>

              {perSeason.length > 0 && (
                <div className="mt-4 text-xs overflow-x-auto">
                  <table className="w-full text-white/80">
                    <thead>
                      <tr className="border-b border-white/20">
                        <th className="text-left py-1 pr-2">Season</th>
                        <th className="text-left py-1 pr-2">M</th>
                        <th className="text-left py-1 pr-2">G/A</th>
                        <th className="text-left py-1 pr-2">Y/R/B</th>
                        <th className="text-left py-1 pr-2">MVP/GK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perSeason.map((row, i) => (
                        <tr key={i} className="border-b border-white/5 last:border-0">
                          <td className="py-1 pr-2">{row.season}</td>
                          <td className="py-1 pr-2">{row.matches}</td>
                          <td className="py-1 pr-2">
                            {row.goals}/{row.assists}
                          </td>
                          <td className="py-1 pr-2">
                            {row.yellow_cards}/{row.red_cards}/{row.blue_cards}
                          </td>
                          <td className="py-1 pr-2">
                            {row.mvp}/{row.best_gk}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
