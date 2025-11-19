    "use client";

    import { motion } from "framer-motion";
    import { Users, Star } from "lucide-react";
    import {
    FaUser,
    FaRulerVertical,
    FaBirthdayCake,
    FaFutbol,
    FaHandsHelping,
    } from "react-icons/fa";
    import AvatarImage from "./AvatarImage";
    import type { PlayerAssociation } from "@/app/lib/types";
    import { resolvePlayerPhotoUrl } from "@/app/lib/player-images";

    interface TeamRosterShowcaseProps {
    playerAssociations: PlayerAssociation[] | null;
    seasonStatsByPlayer?: Record<number, any[]>;
    errorMessage?: string | null;
    }

    type StatPillProps = {
    label: string;
    value: number;
    highlight?: boolean;
    };

    function StatPill({ label, value, highlight = false }: StatPillProps) {
    return (
        <div
        className={[
            "flex flex-col items-center justify-center rounded-2xl px-2 py-1 bg-black/45 border transition-all",
            highlight
            ? "border-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.35)]"
            : "border-white/10",
        ].join(" ")}
        >
        <span className="text-[9px] uppercase tracking-[0.16em] text-white/55">
            {label}
        </span>
        <span className="mt-0.5 text-sm font-semibold text-white tabular-nums">
            {value}
        </span>
        </div>
    );
    }

    export default function TeamRosterShowcase({
    playerAssociations,
    seasonStatsByPlayer,
    errorMessage,
    }: TeamRosterShowcaseProps) {
    if (errorMessage) {
        return (
        <section className="rounded-2xl bg-red-950/40 border border-red-500/40 p-4">
            <p className="text-red-200 text-sm">
            Error loading players: {errorMessage}
            </p>
        </section>
        );
    }

    if (!playerAssociations || playerAssociations.length === 0) {
        return (
        <section className="rounded-2xl bg-black/40 border border-white/10 p-6">
            <h2
            className="text-xl font-bold text-white mb-2"
            style={{
                textShadow:
                "1px 1px 2px rgba(0,0,0,0.8), -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000",
            }}
            >
            Ρόστερ Ομάδας
            </h2>
            <p className="text-sm text-zinc-300">
            Δεν υπάρχουν παίκτες στο ρόστερ για αυτή την ομάδα.
            </p>
        </section>
        );
    }

    return (
        <section className="py-6">
        {/* Header (similar to MatchParticipantsShowcase) */}
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-8 text-center"
        >
            <div className="mb-3 flex items-center justify-center gap-3">
            <Users className="h-8 w-8 text-red-500" />
            <h2
                id="team-roster-heading"
                className="text-3xl font-bold md:text-4xl text-white"
                style={{
                textShadow:
                    "2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
                }}
            >
                Ρόστερ Ομάδας
            </h2>
            </div>
            <p
            className="text-lg text-white/80"
            style={{
                textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
            }}
            >
            Επίσημο ρόστερ και βασικά στατιστικά παικτών
            </p>
            <p className="mt-1 text-sm text-red-300/90">
            Σύνολο παικτών: {playerAssociations.length}
            </p>
        </motion.div>

        {/* Grid of players – cards styled like MatchParticipantsShowcase */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-6 justify-items-center">
            {playerAssociations.map((assoc, index) => {
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

            // Per-season rows for this team
            const perSeason = (seasonStatsByPlayer?.[p.id] ?? []) as Array<any>;

            const totals = perSeason.reduce(
                (acc, row) => {
                acc.matches += row.matches ?? 0;
                acc.goals += row.goals ?? 0;
                acc.assists += row.assists ?? 0;
                acc.mvp += row.mvp ?? 0;
                acc.best_gk += row.best_gk ?? 0;
                return acc;
                },
                {
                matches: 0,
                goals: 0,
                assists: 0,
                mvp: 0,
                best_gk: 0,
                }
            );

            const fullName =
                `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Άγνωστος";
            const firstName = p.first_name || fullName || "Άγνωστος";

            const age = stats.age as number | null;
            const heightCm = p.height_cm as number | null;

            return (
                <PlayerCard
                key={p.id}
                index={index}
                firstName={firstName}
                lastName={p.last_name}
                fullName={fullName}
                position={p.position}
                age={age}
                heightCm={heightCm}
                photoUrl={photoUrl}
                totals={totals}
                />
            );
            })}
        </div>
        </section>
    );
    }

    type PlayerCardProps = {
    index: number;
    firstName: string;
    lastName?: string | null;
    fullName: string;
    position?: string | null;
    age?: number | null;
    heightCm?: number | null;
    photoUrl: string;
    totals: {
        matches: number;
        goals: number;
        assists: number;
        mvp: number;
        best_gk: number;
    };
    };
    type StatsModalProps = {
        totals: {
        matches: number;
        goals: number;
        assists: number;
        mvp: number;
        best_gk: number;
        };
    };
    
    function StatsModal({ totals }: StatsModalProps) {
        return (
        <div className="relative w-full max-w-[190px]">
            <div
            className={[
                "relative rounded-[20px] border border-white/12 px-3 py-3 shadow-[0_18px_35px_rgba(0,0,0,0.75)] overflow-hidden",
                "backdrop-blur-md",
                "bg-[radial-gradient(circle_at_0_0,rgba(248,250,252,0.18),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(239,68,68,0.32),transparent_55%)]"
    ,
                // ==== PATTERN OPTION 1: subtle radial glow dots ====
                // "bg-[radial-gradient(circle_at_top,_rgba(248,250,252,0.24),_transparent_55%)]",
                //
                // ==== PATTERN OPTION 2: diagonal sporty stripes ====
                // "bg-[linear-gradient(135deg,_rgba(249,250,251,0.12)_0%,_rgba(249,250,251,0.02)_35%,_transparent_70%)]",
                //
                // ==== PATTERN OPTION 3: fine grid pattern (default) ====
                "bg-[radial-gradient(circle_at_0_0,rgba(248,250,252,0.18),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(239,68,68,0.32),transparent_55%)]"
    ,
            ].join(" ")}
            >
            {/* Small glow on top */}
            <div className="pointer-events-none absolute inset-x-6 -top-6 h-10 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.55),_transparent_60%)] opacity-70" />
    
            <div className="relative space-y-2">
                {/* Header row */}
                <div className="flex items-center justify-between">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-black/65 border border-amber-400/70 px-2 py-0.5">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-semibold tracking-[0.16em] uppercase text-amber-50">
                    Στατιστικά
                    </span>
                </div>
    
                <span className="text-[10px] text-white/60">All seasons</span>
                </div>
    
                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-1.5">
                <StatPill label="MATCHES" value={totals.matches} />
                <StatPill label="GOALS" value={totals.goals} highlight />
                <StatPill label="ASSISTS" value={totals.assists} />
                </div>
    
                <div className="grid grid-cols-2 gap-1.5">
                <StatPill
                    label="MVP"
                    value={totals.mvp}
                    highlight={totals.mvp > 0}
                />
                <StatPill
                    label="GK"
                    value={totals.best_gk}
                    highlight={totals.best_gk > 0}
                />
                </div>
    
                {/* Footer line */}
                <div className="flex items-center justify-between pt-1 text-[9px] text-white/35">
                <span className="inline-flex items-center gap-1">
                    <FaFutbol className="text-[9px]" />
                    Stats (team)
                </span>
                <span className="inline-flex items-center gap-1">
                    <FaHandsHelping className="text-[9px]" />
                    Σύνολο καριέρας
                </span>
                </div>
            </div>
            </div>
        </div>
        );
    }
    
    function PlayerCard({
        index,
        firstName,
        lastName,
        fullName,
        position,
        age,
        heightCm,
        photoUrl,
        totals,
    }: PlayerCardProps) {
        return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
            delay: index * 0.06,
            duration: 0.5,
            type: "spring",
            stiffness: 200,
            }}
            whileHover={{ scale: 1.05, y: -8 }}
            className="cursor-pointer group flex flex-col items-center gap-3"
        >
            {/* Top card: full image with basic info */}
            <div
            className="relative overflow-hidden rounded-2xl border-2 border-white/30 bg-black/40 backdrop-blur-sm transition-shadow hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] hover:border-red-500/60"
            style={{ width: "180px", height: "240px" }}
            >
            {/* Full-card background image */}
            <AvatarImage
                src={photoUrl}
                alt={fullName}
                width={360}
                height={480}
                className="absolute inset-0 h-full w-full object-cover object-center"
            />
    
            {/* Dark gradient overlay for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />
    
            {/* Content overlay at bottom */}
            <div className="relative flex h-full flex-col justify-end p-3 gap-2">
                {/* Name */}
                <div className="text-center">
                <div
                    className="mb-0.5 text-sm font-bold text-white"
                    style={{
                    textShadow:
                        "1px 1px 2px rgba(0,0,0,0.8), -0.5px -0.5px 0 #000, 0.5px -0.5px 0 #000, -0.5px 0.5px 0 #000, 0.5px 0.5px 0 #000",
                    }}
                >
                    {firstName}
                </div>
                {lastName && (
                    <div
                    className="text-xs text-white/80"
                    style={{
                        textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                    }}
                    >
                    {lastName}
                    </div>
                )}
                </div>
    
                {/* Meta row (position / age / height) */}
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1 text-[10px] text-zinc-200">
                {position && (
                    <span className="inline-flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded-full border border-white/10">
                    <FaUser className="text-[9px]" />
                    {position}
                    </span>
                )}
                {age != null && (
                    <span className="inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                    <FaBirthdayCake className="text-[9px]" />
                    {age}y
                    </span>
                )}
                {heightCm != null && (
                    <span className="inline-flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                    <FaRulerVertical className="text-[9px]" />
                    {heightCm}cm
                    </span>
                )}
                </div>
            </div>
    
            {/* Decorative star */}
            <motion.div
                initial={{ opacity: 0, scale: 0 }}
                whileHover={{ opacity: 1, scale: 1 }}
                className="absolute right-2 top-2"
            >
                <Star className="h-4 w-4 text-red-500 drop-shadow-[0_0_6px_rgba(0,0,0,0.8)]" />
            </motion.div>
            </div>
    
            {/* Stats “modal” under the card */}
            <StatsModal totals={totals} />
        </motion.div>
        );
    }
    