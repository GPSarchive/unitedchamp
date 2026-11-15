// The inspection grid behind /preview/special-cards: pick which players
// (with a photo, without, all) and which styling (all three side by side, or
// one at a time), search by name, and scroll. Players are added to the page a
// dozen at a time as you scroll, because every big card carries its own
// effects and a full-size photo.
//
// Any card with a photo can be framed by hand: «Προσαρμογή» under it, then
// drag the photo and set the zoom. See framing.tsx — a trial, saved in this
// browser only.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import HoloShieldCard from "@/app/preview/paiktes-v2/[id]/HoloShieldCard";
import { foldText, type DirectoryTeam, type StatTuple } from "@/app/preview/paiktes-v2/model";
import MiniCard from "@/app/preview/paiktes-v3/MiniCard";
import {
  DEFAULT_FRAMING,
  Framed,
  FramingControls,
  FramingStyles,
  PhotoDragLayer,
  useFramings,
  type Framing,
} from "./framing";
import LegendMiniCardV1 from "./legend/v1/LegendMiniCard";
import LegendShieldCardV1 from "./legend/v1/LegendShieldCard";
import LegendMiniCardV2 from "./legend/v2/LegendMiniCard";
import LegendShieldCardV2 from "./legend/v2/LegendShieldCard";

export type InspectedPlayer = {
  id: number;
  first: string;
  last: string;
  photo: string | null;
  hasPhoto: boolean;
  team: DirectoryTeam | null;
  stats: StatTuple | null;
};

type StyleKey = "normal" | "legend1" | "legend2";
type Who = "photo" | "nophoto" | "all";

const STYLES: { key: StyleKey; label: string }[] = [
  { key: "normal", label: "Κανονική" },
  { key: "legend1", label: "Θρύλος 1" },
  { key: "legend2", label: "Θρύλος 2" },
];

const STEP = 12;

/** One framing per player per card styling. */
const framingKey = (player: InspectedPlayer, style: StyleKey) => `${player.id}:${style}`;

function BigCard({ style, player }: { style: StyleKey; player: InspectedPlayer }) {
  const props = {
    first: player.first,
    last: player.last,
    photo: player.photo,
    team: player.team,
    stats: player.stats,
    intro: false,
  };
  if (style === "legend1") return <LegendShieldCardV1 {...props} />;
  if (style === "legend2") return <LegendShieldCardV2 {...props} />;
  return <HoloShieldCard {...props} />;
}

function SmallCard({ style, player }: { style: StyleKey; player: InspectedPlayer }) {
  const props = {
    photo: player.photo,
    logo: player.team?.logo ?? null,
    initial: (player.last || player.first || "?").charAt(0).toUpperCase(),
  };
  if (style === "legend1") return <LegendMiniCardV1 {...props} />;
  if (style === "legend2") return <LegendMiniCardV2 {...props} />;
  return <MiniCard {...props} />;
}

/**
 * A big card in a 300px box (the width it is designed for), shown at the
 * page's scale: smaller on a phone, full size from `md` up.
 */
function Sized({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[calc(420px*var(--card-scale))] w-[calc(300px*var(--card-scale))]">
      <div className="w-[300px] origin-top-left [transform:scale(var(--card-scale))]">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        active
          ? "border-[#D4AF37] bg-[#D4AF37] font-semibold text-[#0a0a14]"
          : "border-white/15 text-[#F3EFE6]/80 hover:border-white/40"
      }`}
    >
      {children}
    </button>
  );
}

/** Name line shared by both layouts: id first, so a card can be named back. */
function PlayerLabel({ player }: { player: InspectedPlayer }) {
  return (
    <>
      <span className="tabular-nums text-[#D4AF37]">#{player.id}</span>{" "}
      <span className="font-semibold">{`${player.last} ${player.first}`.trim() || "—"}</span>
      {player.team && <span className="text-[#F3EFE6]/55"> · {player.team.name}</span>}
    </>
  );
}

/** One player in one styling: big card, its mini, a label, and the framing tools. */
function CardFigure({
  player,
  style,
  label,
  framing,
  editing,
  onEdit,
  onChange,
  onReset,
  onDone,
}: {
  player: InspectedPlayer;
  style: StyleKey;
  label: React.ReactNode;
  /** Saved framing for this card, if any. */
  framing: Framing | null;
  editing: boolean;
  onEdit: () => void;
  onChange: (next: Framing) => void;
  onReset: () => void;
  onDone: () => void;
}) {
  return (
    <figure className="w-[calc(300px*var(--card-scale))]">
      <div className="relative">
        <Sized>
          <Framed framing={framing}>
            <BigCard style={style} player={player} />
          </Framed>
        </Sized>
        {editing && <PhotoDragLayer framing={framing ?? DEFAULT_FRAMING} onChange={onChange} />}
      </div>
      <figcaption className="mt-3 flex items-center gap-3 text-[13px] text-[#F3EFE6]/65">
        <span className="w-12 shrink-0 md:w-14">
          <Framed framing={framing}>
            <SmallCard style={style} player={player} />
          </Framed>
        </span>
        <span className="min-w-0">{label}</span>
      </figcaption>
      {player.hasPhoto &&
        (editing ? (
          <FramingControls
            framing={framing ?? DEFAULT_FRAMING}
            changed={framing != null}
            onChange={onChange}
            onReset={onReset}
            onDone={onDone}
          />
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[13px] text-[#F3EFE6]/80 transition-colors hover:border-white/40"
          >
            {/* A gold dot marks a card that already has its own framing. */}
            {framing && <span aria-hidden className="h-2 w-2 rounded-full bg-[#D4AF37]" />}
            Προσαρμογή
          </button>
        ))}
    </figure>
  );
}

export default function CardInspector({ players }: { players: InspectedPlayer[] }) {
  const [who, setWho] = useState<Who>("photo");
  const [style, setStyle] = useState<StyleKey | "all">("all");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(STEP);
  const [framings, setFraming] = useFramings();
  /** Key of the card whose photo is being framed. */
  const [editing, setEditing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const counts = useMemo(() => {
    const photo = players.filter((p) => p.hasPhoto).length;
    return { photo, nophoto: players.length - photo, all: players.length };
  }, [players]);

  const list = useMemo(() => {
    const q = foldText(query);
    return players.filter((p) => {
      if (who === "photo" && !p.hasPhoto) return false;
      if (who === "nophoto" && p.hasPhoto) return false;
      if (!q) return true;
      return foldText(`${p.first} ${p.last} ${p.team?.name ?? ""} ${p.id}`).includes(q);
    });
  }, [players, who, query]);

  // A new filter starts again from the top of the list, with nothing selected.
  useEffect(() => {
    setShown(STEP);
    setEditing(null);
  }, [who, style, query]);

  // Add the next dozen when the end of the page comes near.
  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setShown((n) => n + STEP);
      },
      { rootMargin: "1200px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [list, shown]);

  const visible = list.slice(0, shown);
  const framed = Object.keys(framings).length;

  async function copyFramings() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(framings, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: nothing to do, the values stay saved in the browser.
    }
  }

  const figure = (player: InspectedPlayer, key: StyleKey, label: React.ReactNode) => {
    const id = framingKey(player, key);
    return (
      <CardFigure
        key={key}
        player={player}
        style={key}
        label={label}
        framing={framings[id] ?? null}
        editing={editing === id}
        onEdit={() => setEditing(id)}
        onChange={(next) => setFraming(id, next)}
        onReset={() => setFraming(id, null)}
        onDone={() => setEditing(null)}
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a14] text-[#F3EFE6] [--card-scale:0.53] md:[--card-scale:1]">
      <FramingStyles />
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 md:px-6 md:pt-14">
        <h1 className="text-4xl font-bold italic leading-none tracking-tight md:text-5xl">Έλεγχος καρτών</h1>

        {/* Stays in view while scrolling on wide screens only: on a phone it would cover a third of the screen. */}
        <div className="z-20 -mx-4 mt-6 space-y-3 bg-[#0a0a14]/95 px-4 py-3 md:sticky md:top-0 md:-mx-6 md:px-6 md:backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={who === "photo"} onClick={() => setWho("photo")}>
              Με φωτογραφία <span className="tabular-nums opacity-70">{counts.photo}</span>
            </Chip>
            <Chip active={who === "nophoto"} onClick={() => setWho("nophoto")}>
              Χωρίς φωτογραφία <span className="tabular-nums opacity-70">{counts.nophoto}</span>
            </Chip>
            <Chip active={who === "all"} onClick={() => setWho("all")}>
              Όλοι <span className="tabular-nums opacity-70">{counts.all}</span>
            </Chip>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Αναζήτηση παίκτη"
              aria-label="Αναζήτηση παίκτη"
              className="ml-auto w-full rounded-full border border-white/15 bg-transparent px-4 py-1.5 text-sm placeholder:text-[#F3EFE6]/40 focus:border-[#D4AF37] focus:outline-none sm:w-56"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip active={style === "all"} onClick={() => setStyle("all")}>
              Όλες οι κάρτες
            </Chip>
            {STYLES.map((s) => (
              <Chip key={s.key} active={style === s.key} onClick={() => setStyle(s.key)}>
                {s.label}
              </Chip>
            ))}
            {framed > 0 && (
              <span className="ml-auto flex items-center gap-2 text-[13px] text-[#F3EFE6]/65">
                <span aria-hidden className="h-2 w-2 rounded-full bg-[#D4AF37]" />
                <span>
                  <span className="tabular-nums">{framed}</span> {framed === 1 ? "προσαρμογή" : "προσαρμογές"}
                </span>
                <button
                  type="button"
                  onClick={copyFramings}
                  className="rounded-full border border-white/15 px-3 py-1 text-[#F3EFE6]/80 transition-colors hover:border-white/40"
                >
                  {copied ? "Αντιγράφηκε" : "Αντιγραφή"}
                </button>
              </span>
            )}
          </div>
        </div>

        {visible.length === 0 && <p className="mt-10 text-[15px] text-[#F3EFE6]/65">Δεν βρέθηκαν παίκτες.</p>}

        {style === "all" ? (
          // One row per player: the same photo in every styling, side by side.
          <div className="mt-6 divide-y divide-white/10">
            {visible.map((player) => (
              <article key={player.id} className="py-8">
                <h2 className="text-[15px]">
                  <PlayerLabel player={player} />
                </h2>
                <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-8 md:justify-start md:gap-x-10">
                  {STYLES.map((s) => figure(player, s.key, s.label))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          // One styling: all the players in it, as a wall of cards.
          <div className="mt-8 flex flex-wrap justify-center gap-x-4 gap-y-10 md:justify-start md:gap-x-10">
            {visible.map((player) => (
              <div key={player.id} className="text-[#F3EFE6]">
                {figure(player, style, <PlayerLabel player={player} />)}
              </div>
            ))}
          </div>
        )}

        {shown < list.length && <div ref={sentinel} aria-hidden className="h-10" />}
      </div>
    </div>
  );
}
