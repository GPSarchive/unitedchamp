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
  "radial-gradient(farthest-side circle at var(--pointer-x) var(--pointer-y),hsla(266,100%,90%,var(--card-opacity)) 4%,hsla(266,50%,80%,calc(var(--card-opacity)*0.75)) 10%,hsla(266,25%,70%,calc(var(--card-opacity)*0.5)) 50%,hsla(266,0%,60%,0) 100%),radial-gradient(35% 52% at 55% 20%,#00ffaac4 0%,#073aff00 100%),radial-gradient(100% 100% at 50% 50%,#00c1ffff 1%,#073aff00 76%),conic-gradient(from 124deg at 50% 50%,#c137ffff 0%,#07c6ffff 40%,#07c6ffff 60%,#c137ffff 100%)";

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
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      },
    };
  }, [enableTilt]);

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const card = cardRef.current;
      const wrap = wrapRef.current;
      if (!card || !wrap || !animationHandlers) return;

      const rect = card.getBoundingClientRect();
      animationHandlers.updateCardTransform(
        event.clientX - rect.left,
        event.clientY - rect.top,
        card,
        wrap
      );
    },
    [animationHandlers]
  );

  const handlePointerEnter = useCallback(() => {
    const card = cardRef.current;
    const wrap = wrapRef.current;
    if (!card || !wrap || !animationHandlers) return;

    animationHandlers.cancelAnimation();
    wrap.classList.add(activeClass);
    card.classList.add(activeClass);
  }, [animationHandlers, activeClass]);

  const handlePointerLeave = useCallback(
    (event: PointerEvent & { offsetX: number; offsetY: number }) => {
      const card = cardRef.current;
      const wrap = wrapRef.current;
      if (!card || !wrap || !animationHandlers) return;

      animationHandlers.createSmoothAnimation(
        ANIMATION_CONFIG.SMOOTH_DURATION,
        event.offsetX,
        event.offsetY,
        card,
        wrap
      );
      wrap.classList.remove(activeClass);
      card.classList.remove(activeClass);
    },
    [animationHandlers, activeClass]
  );

  const handleDeviceOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      const card = cardRef.current as unknown as HTMLElement | null;
      const wrap = wrapRef.current as unknown as HTMLElement | null;
      if (!card || !wrap || !animationHandlers) return;

      const { beta, gamma } = event;
      if (beta == null || gamma == null) return;

      animationHandlers.updateCardTransform(
        card.clientHeight / 2 + gamma * mobileTiltSensitivity,
        card.clientWidth / 2 +
          (beta - ANIMATION_CONFIG.DEVICE_BETA_OFFSET) * mobileTiltSensitivity,
        card,
        wrap
      );
    },
    [animationHandlers, mobileTiltSensitivity]
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
                    <SignedImg
                      src={(miniAvatarUrl ?? avatarUrl) || null}
                      alt={`${name || "User"} mini avatar`}
                    />
                  </div>
                  <div className={styles["pc-user-text"]}>
                    <div className={styles["pc-handle"]}>@{handle}</div>
                    <div className={styles["pc-status"]}>{status}</div>
                  </div>
                </div>
                <button
                  className={styles["pc-contact-btn"]}
                  onClick={handleContactClick}
                  style={{ pointerEvents: "auto" }}
                  type="button"
                  aria-label={`Contact ${name || "user"}`}
                >
                  {contactText}
                </button>
              </div>
            )}
          </div>

          {/* === TEXT LAYER === */}
          <div className={styles["pc-content"]}>
            <div className={styles["pc-details"]}>
              <h3>{name}</h3>
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
