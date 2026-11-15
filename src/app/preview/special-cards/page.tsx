// Preview route — every player in every card styling we have (the normal
// card, «Θρύλος» version 1 and version 2), big card and mini card, to check
// by eye how each real photo behaves in each one. Real players from the
// players directory; static + ISR like the directory itself.
import type { Metadata } from "next";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { loadDirectoryV3 } from "@/app/preview/paiktes-v3/data";
import CardInspector, { type InspectedPlayer } from "./CardInspector";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Έλεγχος καρτών · UltraChamp.gr",
  robots: { index: false, follow: false },
};

export default async function CardInspectorPage() {
  const data = await loadDirectoryV3();
  const teamsById = new Map([...data.teams, ...data.extraTeams].map((team) => [team.id, team] as const));

  // By id, so the order matches the photo folders (players/<id>/…).
  const players: InspectedPlayer[] = data.players
    .map((player) => ({
      id: player.id,
      first: player.first,
      last: player.last,
      photo: player.photo,
      hasPhoto: !isPlaceholderPhoto(player.photo),
      team: teamsById.get(player.teamIds[0]) ?? null,
      stats: player.season,
    }))
    .sort((a, b) => a.id - b.id);

  return <CardInspector players={players} />;
}
