// Preview route — v2 announcements-only page in the editorial broadsheet aesthetic.
// Mirrors the styling system used in /OMADA/[id] (Fraunces/Archivo/JetBrains/Figtree,
// #0a0a14 ground, #F3EFE6 ink, #fb923c orange, #E8B931 saffron, 2px borders + hard shadow).
import AnnouncementsClient from "./AnnouncementsClient";

export const metadata = {
  title: "Ανακοινώσεις · v2 preview",
};

export default function AnnouncementsV2Page() {
  return <AnnouncementsClient />;
}
