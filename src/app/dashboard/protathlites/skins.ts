// The special card skins staff can give on /dashboard/protathlites.
//
// TO ADD A SKIN (two steps, no migration):
//   1. add `{ key, label }` here — `key` is what the database stores
//      (lowercase latin, digits, `-` or `_`; never rename one already in use);
//   2. add its big + mini card components under the same key in
//      ./skinCards.tsx.
// The dashboard then shows it as a new tab, with team/player assignment and
// photo framing working the same as for «Θρύλος».
//
// Plain data (no React) so the server actions can validate keys with it.

export const CARD_SKINS = [
  { key: "legend", label: "Θρύλος" },
  { key: "toty", label: "Ομάδα της Χρονιάς" },
  { key: "totw", label: "Ομάδα της Εβδομάδας" },
  { key: "hero", label: "Ήρωας" },
  { key: "pro", label: "Επαγγελματίας" },
] as const;

export type SkinKey = (typeof CARD_SKINS)[number]["key"];

export function isSkinKey(value: unknown): value is SkinKey {
  return CARD_SKINS.some((s) => s.key === value);
}

/** Photo framing on a card — same three numbers as preview/special-cards/framing.tsx. */
export type CardFraming = { x: number; y: number; zoom: number };

/** One player holding one skin, as the dashboard sees it. */
export type SkinHolder = {
  playerId: number;
  skin: SkinKey;
  /** Team whose logo the card wears; null = no team on the card. */
  teamId: number | null;
  framing: CardFraming;
};

/** A player_card_skins row, as read with SKIN_ROW_SELECT. */
export type SkinRow = {
  player_id: number;
  skin: string;
  team_id: number | null;
  frame_x: number;
  frame_y: number;
  frame_zoom: number;
};

export const SKIN_ROW_SELECT = "player_id, skin, team_id, frame_x, frame_y, frame_zoom";

export function holderFromRow(row: SkinRow): SkinHolder {
  return {
    playerId: row.player_id,
    skin: row.skin as SkinKey,
    teamId: row.team_id,
    framing: { x: Number(row.frame_x), y: Number(row.frame_y), zoom: Number(row.frame_zoom) },
  };
}
