/**
 * Premium football/soccer match icons as clean SVG components.
 * Used throughout match pages and dashboards for stats display.
 */

import React from "react";

type IconProps = { className?: string };

/** Soccer ball with pentagon patch pattern */
export function SoccerBall({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" />
      {/* Centre pentagon */}
      <polygon
        points="16,6 20.5,10.5 19,16.5 13,16.5 11.5,10.5"
        fill="currentColor"
        opacity="0.85"
      />
      {/* Lower-left patch */}
      <polygon
        points="11.5,10.5 6,11.5 4.5,17 8,21 13,16.5"
        fill="currentColor"
        opacity="0.55"
      />
      {/* Lower-right patch */}
      <polygon
        points="20.5,10.5 26,11.5 27.5,17 24,21 19,16.5"
        fill="currentColor"
        opacity="0.55"
      />
      {/* Bottom patch */}
      <polygon
        points="13,16.5 8,21 10,26.5 16,27.5 22,26.5 24,21 19,16.5"
        fill="currentColor"
        opacity="0.35"
      />
    </svg>
  );
}

/** Rectangular yellow booking card */
export function YellowCard({ className = "h-5 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 22"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="14"
        height="20"
        rx="2"
        ry="2"
        fill="#FACC15"
        stroke="#CA8A04"
        strokeWidth="1"
      />
      {/* Subtle gloss highlight */}
      <rect x="3" y="3" width="5" height="9" rx="1" fill="white" opacity="0.25" />
    </svg>
  );
}

/** Rectangular red booking card */
export function RedCard({ className = "h-5 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 22"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="14"
        height="20"
        rx="2"
        ry="2"
        fill="#EF4444"
        stroke="#B91C1C"
        strokeWidth="1"
      />
      <rect x="3" y="3" width="5" height="9" rx="1" fill="white" opacity="0.2" />
    </svg>
  );
}

/** Rectangular blue booking card (for blue-card leagues) */
export function BlueCard({ className = "h-5 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 22"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="14"
        height="20"
        rx="2"
        ry="2"
        fill="#3B82F6"
        stroke="#1D4ED8"
        strokeWidth="1"
      />
      <rect x="3" y="3" width="5" height="9" rx="1" fill="white" opacity="0.2" />
    </svg>
  );
}

/** Own-goal indicator (inverted soccer ball outline) */
export function OwnGoalIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
      <polygon
        points="16,6 20.5,10.5 19,16.5 13,16.5 11.5,10.5"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
}

/** Assist / pass arrow icon */
export function AssistIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Curved arrow path */}
      <path d="M4 17 C4 11 10 6 16 8 L16 5 L21 10 L16 15 L16 12 C11 10 7 14 7 17" />
    </svg>
  );
}

/** Captain armband badge */
export function CaptainIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Armband ring */}
      <rect x="2" y="9" width="20" height="6" rx="3" fill="currentColor" opacity="0.9" />
      {/* "C" letter */}
      <text
        x="12"
        y="14.5"
        textAnchor="middle"
        fontSize="5.5"
        fontWeight="bold"
        fill="white"
        fontFamily="sans-serif"
      >
        C
      </text>
    </svg>
  );
}

/** Goalkeeper glove icon */
export function GoalkeeperIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Palm */}
      <path
        d="M5 10 C5 7 7 5 9 5 L9 12 L8 14 L6 14 C5.5 14 5 13.5 5 13 Z"
        opacity="0.9"
      />
      {/* Fingers */}
      <rect x="9" y="3" width="2.5" height="9" rx="1.2" opacity="0.85" />
      <rect x="11.5" y="2" width="2.5" height="9" rx="1.2" opacity="0.85" />
      <rect x="14" y="3" width="2.5" height="9" rx="1.2" opacity="0.85" />
      {/* Thumb */}
      <path
        d="M17.5 8 C18.5 8 19 9 19 10 L19 12 L17.5 13 L16 12 L16 8 Z"
        opacity="0.85"
      />
      {/* Wrist strap */}
      <rect x="5" y="14" width="14" height="4" rx="2" opacity="0.7" />
    </svg>
  );
}

/** MVP / Star medal icon */
export function MvpIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon
        points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.95"
      />
    </svg>
  );
}

/** Match status: Finished checkmark */
export function FinishedIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** Match status: Scheduled clock */
export function ScheduledIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

/** Postponed / pause icon */
export function PostponedIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden="true"
    >
      <rect x="5" y="4" width="4" height="16" rx="1.5" />
      <rect x="15" y="4" width="4" height="16" rx="1.5" />
    </svg>
  );
}
