"use client";

import React, {
  useEffect,
  useRef,
  useCallback,
  useMemo,
  CSSProperties,
} from "react";
import SignedImg from "./SignedImg";
import GlossOverlay from "./GlossOverlay";
import styles from "./ProfileCard.module.css";

/** ====== Visual defaults (you can tweak freely) ====== */
const DEFAULT_BEHIND_GRADIENT =
  "conic-gradient(from 124deg at 50% 50%, #8B5CF6 0%, #3B82F6 40%, #3B82F6 60%, #8B5CF6 100%)"; // Updated to violet-blue mix for softened holo effect

const DEFAULT_INNER_GRADIENT =
  "linear-gradient(145deg,#60496e8c 0%,#71C4FF44 100%)";

const ANIMATION_CONFIG = {
  SMOOTH_DURATION: 600,
  INITIAL_DURATION: 1500,
  INITIAL_X_OFFSET: 70,
  INITIAL_Y_OFFSET: 60,
  DEVICE_BETA_OFFSET: 20,
};

/** ====== helpers ====== */
const clamp = (value: number, min = 0, max = 100) =>
  Math.min(Math.max(value, min), max);

const round = (value: number, precision = 3) =>
  parseFloat(value.toFixed(precision));

const adjust = (
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number
) => round(toMin + ((toMax - toMin) * (value - fromMin)) / (fromMax - fromMin));

const easeInOutCubic = (x: number) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/** ====== types ====== */
type AnimationHandlers = {
  updateCardTransform: (
    offsetX: number,
    offsetY: number,
    card: HTMLElement,
    wrap: HTMLElement
  ) => void;
  createSmoothAnimation: (
    duration: number,
    startX: number,
    startY: number,
    card: HTMLElement,
    wrap: HTMLElement
  ) => void;
  cancelAnimation: () => void;
};

export type ProfileCardProps = {
  avatarUrl?: string | null;
  iconUrl?: string | null;
  grainUrl?: string | null;
  behindGradient?: string;
  innerGradient?: string;
  showBehindGradient?: boolean;
  className?: string;
  enableTilt?: boolean;
  enableMobileTilt?: boolean;
  mobileTiltSensitivity?: number;

  /** UI copy */
  miniAvatarUrl?: string | null;
  name?: string;
  title?: string;
  handle?: string;
  status?: string;
  contactText?: string;
  showUserInfo?: boolean;

  onContactClick?: () => void;

  /** New stats props */
  teams?: { id: number; name: string; logo?: string | null }[]; // Array for multiple teams
  totalGoals?: number;
  totalAssists?: number;
  mvpAwards?: number;
  bestGkAwards?: number;
  matchesPlayed?: number;

  /** Toggle to show stats section */
  showStats?: boolean; // Default true if stats provided
};

function ProfileCardComponent({
  avatarUrl = "/player-placeholder.jpg",
  iconUrl = null,
  grainUrl = null,
  behindGradient,
  innerGradient,
  showBehindGradient = true,
  className = "",
  enableTilt = true,
  enableMobileTilt = false,
  mobileTiltSensitivity = 5,
  miniAvatarUrl = null,
  name = "Javi A. Torres",
  title = "Software Engineer",
  handle = "javicodes",
  status = "Online",
  contactText = "Contact",
  showUserInfo = true,
  onContactClick,
  teams = [],
  totalGoals = 0,
  totalAssists = 0,
  mvpAwards = 0,
  bestGkAwards = 0,
  matchesPlayed = 0,
  showStats = true,
}: ProfileCardProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);

  // If .active exists in the CSS module, use it; otherwise fall back to global "active"
  const activeClass = (styles as Record<string, string>)["active"] ?? "active";

  /** ---- animation handlers ---- */
  const animationHandlers = useMemo<AnimationHandlers | null>(() => {
    if (!enableTilt) return null;

    let rafId: number | null = null;

    const updateCardTransform = (
      offsetX: number,
      offsetY: number,
      card: HTMLElement,
      wrap: HTMLElement
    ) => {
      const width = card.clientWidth;
      const height = card.clientHeight;

      const percentX = clamp((100 / width) * offsetX);
      const percentY = clamp((100 / height) * offsetY);

      const centerX = percentX - 50;
      const centerY = percentY - 50;

      const properties: Record<string, string> = {
        "--pointer-x": `${percentX}%`,
        "--pointer-y": `${percentY}%`,
        "--background-x": `${adjust(percentX, 0, 100, 35, 65)}%`,
        "--background-y": `${adjust(percentY, 0, 100, 35, 65)}%`,
        "--pointer-from-center": `${clamp(
          Math.hypot(percentY - 50, percentX - 50) / 50,
          0,
          1
        )}`,
        "--pointer-from-top": `${percentY / 100}`,
        "--pointer-from-left": `${percentX / 100}`,
        "--rotate-x": `${round(-(centerX / 5))}deg`,
        "--rotate-y": `${round(centerY / 4)}deg`,
      };

      Object.entries(properties).forEach(([property, value]) => {
        wrap.style.setProperty(property, value);
      });
    };

    const createSmoothAnimation = (
      duration: number,
      startX: number,
      startY: number,
      card: HTMLElement,
      wrap: HTMLElement
    ) => {
      const startTime = performance.now();
      const targetX = wrap.clientWidth / 2;
      const targetY = wrap.clientHeight / 2;

      const animationLoop = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = clamp(elapsed / duration);
        const eased = easeInOutCubic(progress);

        const currentX = adjust(eased, 0, 1, startX, targetX);
        const currentY = adjust(eased, 0, 1, startY, targetY);

        updateCardTransform(currentX, currentY, card, wrap);

        if (progress < 1) {
          rafId = requestAnimationFrame(animationLoop);
        }
      };

      rafId = requestAnimationFrame(animationLoop);
    };

    return {
      updateCardTransform,
      createSmoothAnimation,
      cancelAnimation: () => {
        if (rafId) cancelAnimationFrame(rafId);
      },
    };
  }, [enableTilt]);

  const handlePointerEnter = useCallback(
    (e: PointerEvent) => {
      if (!enableTilt || !animationHandlers) return;

      const card = cardRef.current!;
      const wrap = wrapRef.current!;
      card.classList.add(activeClass);

      wrap.style.setProperty("--card-opacity", "1");

      const { clientX, clientY } = e;
      const bounds = card.getBoundingClientRect();
      const offsetX = clientX - bounds.left;
      const offsetY = clientY - bounds.top;

      animationHandlers.createSmoothAnimation(
        ANIMATION_CONFIG.SMOOTH_DURATION,
        offsetX,
        offsetY,
        card,
        wrap
      );
    },
    [enableTilt, animationHandlers, activeClass]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!enableTilt || !animationHandlers) return;

      const card = cardRef.current!;
      const wrap = wrapRef.current!;
      const { clientX, clientY } = e;
      const bounds = card.getBoundingClientRect();
      const offsetX = clientX - bounds.left;
      const offsetY = clientY - bounds.top;

      animationHandlers.updateCardTransform(offsetX, offsetY, card, wrap);
    },
    [enableTilt, animationHandlers]
  );

  const handlePointerLeave = useCallback(() => {
    if (!enableTilt || !animationHandlers) return;

    const card = cardRef.current!;
    const wrap = wrapRef.current!;
    card.classList.remove(activeClass);

    wrap.style.setProperty("--card-opacity", "0");

    animationHandlers.cancelAnimation();
  }, [enableTilt, animationHandlers, activeClass]);

  const handleDeviceOrientation = useCallback(
    (e: DeviceOrientationEvent) => {
      if (!enableTilt || !animationHandlers) return;

      const card = cardRef.current!;
      const wrap = wrapRef.current!;

      const { beta, gamma } = e;

      if (beta == null || gamma == null) return;

      const x = clamp(gamma + ANIMATION_CONFIG.DEVICE_BETA_OFFSET, -90, 90);
      const y = clamp(beta + ANIMATION_CONFIG.DEVICE_BETA_OFFSET, -90, 90);

      const offsetX = adjust(x, -90, 90, 0, card.clientWidth);
      const offsetY = adjust(y, -90, 90, 0, card.clientHeight);

      animationHandlers.updateCardTransform(offsetX, offsetY, card, wrap);
    },
    [enableTilt, animationHandlers]
  );

  useEffect(() => {
    if (!enableTilt || !animationHandlers) return;

    const card = cardRef.current!;
    const wrap = wrapRef.current!;

    const pointerMoveHandler = handlePointerMove as EventListener;
    const pointerEnterHandler = handlePointerEnter as EventListener;
    const pointerLeaveHandler = handlePointerLeave as EventListener;
    const deviceOrientationHandler = handleDeviceOrientation as EventListener;

    const handleClick = () => {
      if (!enableMobileTilt || location.protocol !== "https:") return;
      const anyWin = window as any;
      if (typeof anyWin.DeviceMotionEvent?.requestPermission === "function") {
        anyWin.DeviceMotionEvent.requestPermission()
          .then((state: string) => {
            if (state === "granted") {
              window.addEventListener(
                "deviceorientation",
                deviceOrientationHandler
              );
            }
          })
          .catch(() => {});
      } else {
        window.addEventListener("deviceorientation", deviceOrientationHandler);
      }
    };

    card.addEventListener("pointerenter", pointerEnterHandler);
    card.addEventListener("pointermove", pointerMoveHandler);
    card.addEventListener("pointerleave", pointerLeaveHandler);
    card.addEventListener("click", handleClick);

    const initialX = wrap.clientWidth - ANIMATION_CONFIG.INITIAL_X_OFFSET;
    const initialY = ANIMATION_CONFIG.INITIAL_Y_OFFSET;

    animationHandlers.updateCardTransform(initialX, initialY, card, wrap);
    animationHandlers.createSmoothAnimation(
      ANIMATION_CONFIG.INITIAL_DURATION,
      initialX,
      initialY,
      card,
      wrap
    );

    return () => {
      card.removeEventListener("pointerenter", pointerEnterHandler);
      card.removeEventListener("pointermove", pointerMoveHandler);
      card.removeEventListener("pointerleave", pointerLeaveHandler);
      card.removeEventListener("click", handleClick);
      window.removeEventListener("deviceorientation", deviceOrientationHandler);
      animationHandlers.cancelAnimation();
    };
  }, [
    enableTilt,
    enableMobileTilt,
    animationHandlers,
    handlePointerMove,
    handlePointerEnter,
    handlePointerLeave,
    handleDeviceOrientation,
  ]);

  /** CSS variables for gradients/icons */
  const cardStyle = useMemo(() => {
    const vars: CSSProperties = {
      ["--icon" as any]: iconUrl ? `url(${iconUrl})` : "none",
      ["--grain" as any]: grainUrl ? `url(${grainUrl})` : "none",
      ["--behind-gradient" as any]: showBehindGradient
        ? behindGradient ?? DEFAULT_BEHIND_GRADIENT
        : "none",
      ["--inner-gradient" as any]: innerGradient ?? DEFAULT_INNER_GRADIENT,
    };
    return vars;
  }, [iconUrl, grainUrl, showBehindGradient, behindGradient, innerGradient]);

  const handleContactClick = useCallback(() => {
    onContactClick?.();
  }, [onContactClick]);

  return (
    <div
      ref={wrapRef}
      className={`${styles["pc-card-wrapper"]} ${className}`.trim()}
      style={cardStyle}
    >
      <section ref={cardRef} className={styles["pc-card"]}>
        <div className={styles["pc-inside"]}>
          <div className={styles["pc-shine"]} />
          <div className={styles["pc-glare"]} />

          {/* === AVATAR LAYER (image + gloss) === */}
          <div
            className={`${styles["pc-content"]} ${styles["pc-avatar-content"]}`}
          >
            {/* Signed image (Supabase or regular URL) */}
            <SignedImg
              className={styles["avatar"]}
              src={avatarUrl ?? null}
              alt={`${name || "User"} avatar`}
            />

            {/* Specular gloss, clipped to the PNG alpha */}
            <GlossOverlay
              src={avatarUrl ?? null}
              maskSrc={avatarUrl ?? null}
              angle={18}
              thickness={120}
              intensity={1}
              // disableIfOpaque keeps it off on JPEGs (no alpha).
              disableIfOpaque
            />

                        {/* Floating user panel */}
            {showUserInfo && (
              <div className={styles["pc-user-info"]}>
                <div className={styles["pc-user-details"]}>
                  <div className={styles["pc-mini-avatar"]}>
            {/*<SignedImg
                      src={(miniAvatarUrl ?? avatarUrl) || null}
                      alt={`${name || "User"} mini avatar`}
                    />*/}
                  </div>
                  <div className={styles["pc-user-text"]}>
                    
                    <div className={styles["pc-status"]}>{status}</div>
                  </div>
                </div>
                
                {showStats && (
              <div className={`${styles["pc-stats"]} mt-auto`}>
                {/* Player name as first item */}
                <div className={`${styles["pc-player-name"]} text-3xl font-bold mb-6`}>
                  {name}
                </div>

                {/* Stats container with grid */}
                <div className={`${styles["pc-stats-container"]} grid grid-cols-3 gap-8`}>
                  {/* Teams */}
                  {teams.length > 0 && (
                    <div className={`${styles["pc-stat-item"]} p-6 rounded-lg text-center`}>
                      <span className={`${styles["pc-stat-field"]} block text-xl text-white/70 mb-3`}>Teams</span>
                      <span className={`${styles["pc-stat-value"]} block text-4xl font-bold text-white`}>
                        {teams.map((team) => team.name).join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Goals */}
                  <div className={`${styles["pc-stat-item"]} p-6 rounded-lg text-center`}>
                    <span className={`${styles["pc-stat-field"]} block text-xl text-white/70 mb-3`}>Goals</span>
                    <span className={`${styles["pc-stat-value"]} block text-4xl font-bold text-white`}>{totalGoals}</span>
                  </div>

                  {/* Assists */}
                  <div className={`${styles["pc-stat-item"]} p-6 rounded-lg text-center`}>
                    <span className={`${styles["pc-stat-field"]} block text-xl text-white/70 mb-3`}>Assists</span>
                    <span className={`${styles["pc-stat-value"]} block text-4xl font-bold text-white`}>{totalAssists}</span>
                  </div>

                  {/* MVP */}
                  <div className={`${styles["pc-stat-item"]} p-6 rounded-lg text-center`}>
                    <span className={`${styles["pc-stat-field"]} block text-xl text-white/70 mb-3`}>MVP</span>
                    <span className={`${styles["pc-stat-value"]} block text-4xl font-bold text-white`}>{mvpAwards}</span>
                  </div>

                  {/* Best GK (if >=1) */}
                  {bestGkAwards >= 1 && (
                    <div className={`${styles["pc-stat-item"]} p-6 rounded-lg text-center`}>
                      <span className={`${styles["pc-stat-field"]} block text-xl text-white/70 mb-3`}>Best GK</span>
                      <span className={`${styles["pc-stat-value"]} block text-4xl font-bold text-white`}>{bestGkAwards}</span>
                    </div>
                  )}

                  {/* Matches */}
                  <div className={`${styles["pc-stat-item"]} p-6 rounded-lg text-center`}>
                    <span className={`${styles["pc-stat-field"]} block text-xl text-white/70 mb-3`}>Matches</span>
                    <span className={`${styles["pc-stat-value"]} block text-4xl font-bold text-white`}>{matchesPlayed}</span>
                  </div>
                </div>
              </div>
              )}
              </div>
            )}
          </div>

          {/* === TEXT LAYER === */}
          <div className={styles["pc-content"]}>
            <div className={styles["pc-details"]}>
              <p>{title}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const ProfileCard = React.memo(ProfileCardComponent);
export default ProfileCard;