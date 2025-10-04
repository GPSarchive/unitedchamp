"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import SignedImg, { BUCKET, isStoragePath } from "./SignedImg";
import type { PlayerLite } from "./types";
import styles from "./PlayersClient.module.css"; // CSS module with .heroImg, .maskClip, etc.

export default function PlayerSpotlight({ player }: { player: PlayerLite }) {
  const full = `${player.first_name} ${player.last_name}`.trim();

  const cardRef = useRef<HTMLDivElement | null>(null);
  const inView = useInView(cardRef, { amount: 0.7 });

  // Build a SAME-ORIGIN mask URL for CSS mask-image
  const maskUrl = isStoragePath(player.photo)
    ? `/api/storage/mask?bucket=${encodeURIComponent(BUCKET)}&path=${encodeURIComponent(
        player.photo
      )}`
    : `/api/proxy?src=${encodeURIComponent(player.photo)}`;

  return (
    <div
      ref={cardRef}
      className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/70 via-zinc-900/60 to-slate-900/70 p-5"
    >
      {/* hero image */}
      <div className="relative w-full aspect-[16/9] md:aspect-[4/3] rounded-xl overflow-hidden isolate">
        <SignedImg src={player.photo} alt={full} className={styles.heroImg} />

        {/* CSS-Modules gloss overlay, clipped by PNG alpha */}
        {maskUrl && (
          <div
            className={styles.maskClip}
            style={{ ["--mask-url" as any]: `url("${maskUrl}")` }}

          >
            <div className={styles.specularBase} />
            <motion.div
              className={styles.specularSweep}
              style={{ transform: `rotate(18deg)` }} // adjust the angle if you like
              initial={false}
              animate={inView ? { x: ["-40%", "140%"] } : { x: "-40%" }}
              transition={{ duration: 3.2, ease: "linear", repeat: inView ? Infinity : 0 }}
            >
              <div className={styles.specularSweepLine} />
            </motion.div>
            <div className={styles.microRidges} />
          </div>
        )}
      </div>

      {/* identity */}
      <div className="flex items-start gap-3 mt-4">
        {player.team?.logo ? (
          <SignedImg
            src={player.team.logo}
            alt={player.team.name}
            className="w-12 h-12 rounded-md object-cover bg-white/10"
          />
        ) : (
          <div className="w-12 h-12 rounded-md bg-white/10" />
        )}

        <div className="flex-1">
          <div className="text-white text-xl md:text-2xl font-semibold leading-tight">
            {full}
          </div>
          <div className="text-white/70 text-sm">
            {player.team?.name ? player.team.name + " • " : ""}
            {player.position || "Θέση —"} {player.height_cm ? `• ${player.height_cm}cm` : ""}{" "}
            {player.age != null ? `• ${player.age} ετών` : ""}
          </div>
        </div>
      </div>

      {/* quick facts grid */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
        <Fact label="Αγώνες" value={player.matches} />
        <Fact label="Γκολ" value={player.goals} />
        <Fact label="Ασσίστ" value={player.assists} />
        <Fact label="Κίτρινες" value={player.yellow_cards} />
        <Fact label="Κόκκινες" value={player.red_cards} />
        <Fact label="Μπλε" value={player.blue_cards} />
        <Fact label="MVP" value={player.mvp} />
        <Fact label="Καλ. Τερμ." value={player.best_gk} />
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: number | string | null }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="text-white/60">{label}</div>
      <div className="text-white font-medium tabular-nums">{value ?? "—"}</div>
    </div>
  );
}