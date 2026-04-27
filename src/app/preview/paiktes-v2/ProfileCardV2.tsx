// src/app/preview/paiktes-v2/ProfileCardV2.tsx
// Midnight Dossier — v2.0 of the 3D player card, theme-aligned with /paiktes
"use client";

import React, {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import styles from "./ProfileCardV2.module.css";

export type TeamBadge = { id: number; name: string; logo?: string | null };

export type ProfileCardV2Props = {
  /** Player photo */
  avatarUrl?: string | null;
  /** Display names */
  firstName?: string;
  lastName?: string;
  /** Position / height / age summary, e.g. "GK · 180cm · 24y" */
  meta?: string;
  /** File number (1..999). If omitted, derives from player id. */
  fileNumber?: number;
  /** Team badges — first is primary */
  teams?: TeamBadge[];
  /** Career or tournament stats — order determines rail */
  stats?: Array<{
    label: string;
    value: number;
    accent?: "orange" | "gold" | "cyan" | "default";
  }>;
  /** Whether tournament mode is active — shows a TRN badge */
  isTournamentScoped?: boolean;
  /** Enable 3D tilt */
  enableTilt?: boolean;
  className?: string;
};

function clamp(v: number, min = 0, max = 100) {
  return Math.min(Math.max(v, min), max);
}

function round(v: number, p = 3) {
  return parseFloat(v.toFixed(p));
}

function adjust(v: number, fromMin: number, fromMax: number, toMin: number, toMax: number) {
  return round(toMin + ((toMax - toMin) * (v - fromMin)) / (fromMax - fromMin));
}

function easeOut(x: number) {
  return 1 - Math.pow(1 - x, 3);
}

export default function ProfileCardV2({
  avatarUrl,
  firstName = "",
  lastName = "—",
  meta = "",
  fileNumber,
  teams = [],
  stats = [],
  isTournamentScoped = false,
  enableTilt = true,
  className = "",
}: ProfileCardV2Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const fileLabel = useMemo(() => {
    const n = fileNumber ?? 7;
    return String(n).padStart(3, "0");
  }, [fileNumber]);

  const setVars = useCallback(
    (offsetX: number, offsetY: number, rect: DOMRect) => {
      const wrap = wrapRef.current;
      if (!wrap) return;

      const percentX = clamp((100 / rect.width) * offsetX);
      const percentY = clamp((100 / rect.height) * offsetY);
      const centerX = percentX - 50;
      const centerY = percentY - 50;

      wrap.style.setProperty("--pointer-x", `${percentX}%`);
      wrap.style.setProperty("--pointer-y", `${percentY}%`);
      wrap.style.setProperty("--pointer-from-left", `${percentX / 100}`);
      wrap.style.setProperty("--pointer-from-top", `${percentY / 100}`);
      wrap.style.setProperty(
        "--pointer-from-center",
        `${clamp(Math.hypot(centerX, centerY) / 50, 0, 1)}`
      );
      wrap.style.setProperty("--background-x", `${adjust(percentX, 0, 100, 30, 70)}%`);
      wrap.style.setProperty("--background-y", `${adjust(percentY, 0, 100, 25, 75)}%`);
      wrap.style.setProperty("--rotate-x", `${round(-(centerX / 6))}deg`);
      wrap.style.setProperty("--rotate-y", `${round(centerY / 5)}deg`);
    },
    []
  );

  const handleEnter = useCallback(
    (e: PointerEvent) => {
      if (!enableTilt) return;
      const card = cardRef.current;
      const wrap = wrapRef.current;
      if (!card || !wrap) return;

      card.classList.add(styles.active);
      wrap.classList.add(styles.active);
      wrap.style.setProperty("--card-opacity", "1");

      const rect = card.getBoundingClientRect();
      setVars(e.clientX - rect.left, e.clientY - rect.top, rect);
    },
    [enableTilt, setVars]
  );

  const handleMove = useCallback(
    (e: PointerEvent) => {
      if (!enableTilt) return;
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      setVars(e.clientX - rect.left, e.clientY - rect.top, rect);
    },
    [enableTilt, setVars]
  );

  const handleLeave = useCallback(() => {
    const card = cardRef.current;
    const wrap = wrapRef.current;
    if (!card || !wrap) return;

    card.classList.remove(styles.active);
    wrap.classList.remove(styles.active);
    wrap.style.setProperty("--card-opacity", "0");

    // smooth recentre
    const startTime = performance.now();
    const duration = 500;
    const rect = card.getBoundingClientRect();
    const startRX = parseFloat(wrap.style.getPropertyValue("--rotate-x")) || 0;
    const startRY = parseFloat(wrap.style.getPropertyValue("--rotate-y")) || 0;

    const loop = (now: number) => {
      const t = clamp((now - startTime) / duration, 0, 1);
      const e = easeOut(t);
      const cx = adjust(e, 0, 1, startRX, 0);
      const cy = adjust(e, 0, 1, startRY, 0);
      wrap.style.setProperty("--rotate-x", `${cx}deg`);
      wrap.style.setProperty("--rotate-y", `${cy}deg`);
      wrap.style.setProperty("--pointer-x", `${adjust(e, 0, 1, 50, 50)}%`);
      wrap.style.setProperty("--pointer-y", `${adjust(e, 0, 1, 50, 50)}%`);
      if (t < 1) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    const card = cardRef.current;
    if (!card || !enableTilt) return;

    const enter = handleEnter as EventListener;
    const move = handleMove as EventListener;
    const leave = handleLeave as EventListener;

    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerleave", leave);

    return () => {
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", leave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enableTilt, handleEnter, handleMove, handleLeave]);

  const statStyle = useMemo<CSSProperties>(
    () => ({ ["--stat-count" as any]: String(Math.max(1, stats.length)) }),
    [stats.length]
  );

  const primary = teams[0];
  const secondaries = teams.slice(1, 4);

  return (
    <div
      ref={wrapRef}
      className={`${styles.wrap} ${className}`.trim()}
    >
      <div ref={cardRef} className={styles.card}>
        <div className={styles.grid} />
        <div className={styles.ambient} />
        <div className={styles.scan} />

        {/* player photo */}
        {avatarUrl && (
          <div className={styles.photoWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.photo}
              src={avatarUrl}
              alt={`${firstName} ${lastName}`.trim()}
              loading="eager"
            />
          </div>
        )}

        {/* iridescent sheen (above the photo) */}
        <div className={styles.sheen} />

        {/* corner registration marks */}
        <span className={`${styles.reg} ${styles.regTL}`} />
        <span className={`${styles.reg} ${styles.regTR}`} />
        <span className={`${styles.reg} ${styles.regBL}`} />
        <span className={`${styles.reg} ${styles.regBR}`} />

        {/* side tick rails */}
        <div className={`${styles.tickRail} ${styles.left}`}>
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>
        <div className={`${styles.tickRail} ${styles.right}`}>
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>

        {/* top rail */}
        <div className={styles.topRail}>
          <span className={styles.fileNo}>
            <span>N°</span>
            <span>{fileLabel}</span>
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {isTournamentScoped && (
              <span style={{ color: "var(--orange)" }}>Τουρνουά</span>
            )}
            <span className={styles.statusDot} />
            <span>Dossier</span>
          </span>
        </div>

        {/* team badges */}
        {(primary || secondaries.length > 0) && (
          <div className={styles.teamStrip}>
            {primary && (
              <div className={styles.teamTile} title={primary.name}>
                {primary.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={primary.logo} alt={primary.name} />
                ) : (
                  <span style={{ color: "var(--orange)", fontSize: 10 }}>
                    {primary.name?.[0] ?? "·"}
                  </span>
                )}
              </div>
            )}
            {secondaries.map((t) => (
              <div key={t.id} className={styles.teamTile} title={t.name}>
                {t.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.logo} alt={t.name} />
                ) : (
                  <span style={{ color: "var(--ink-dim)", fontSize: 9 }}>
                    {t.name?.[0] ?? "·"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* name block */}
        <div className={styles.nameBlock}>
          {firstName && <span className={styles.firstName}>{firstName}</span>}
          <span className={styles.lastName}>{lastName}</span>
          {meta && <div className={styles.nameMark}>{meta}</div>}
        </div>

        {/* stat rail */}
        {stats.length > 0 && (
          <div className={styles.statRail} style={statStyle}>
            {stats.map((s, i) => (
              <div key={`${s.label}-${i}`} className={styles.statCell}>
                <span className={styles.statLabel}>{s.label}</span>
                <span
                  className={`${styles.statValue} ${
                    s.accent === "orange"
                      ? styles.statValueHot
                      : s.accent === "gold"
                      ? styles.statValueGold
                      : s.accent === "cyan"
                      ? styles.statValueCyan
                      : ""
                  }`.trim()}
                >
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
