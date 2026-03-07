// Premium SVG stat icons for match events
// Inspired by Super League broadcast graphics

export function GoalIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Outer ball */}
      <circle cx="12" cy="12" r="10.5" fill="url(#ballBase)" stroke="#e5e7eb" strokeWidth="0.6" />
      {/* Classic pentagon patches */}
      <path d="M12 5.5L14.4 8.2L13.3 11.5H10.7L9.6 8.2Z" fill="#1a1a2e" />
      <path d="M5.8 10.5L8.8 9.2L10 12.3L8.2 15H5.2Z" fill="#1a1a2e" />
      <path d="M18.2 10.5L15.2 9.2L14 12.3L15.8 15H18.8Z" fill="#1a1a2e" />
      <path d="M8.5 17L10.2 14.5H13.8L15.5 17L12 19.5Z" fill="#1a1a2e" />
      {/* Seam lines connecting patches */}
      <line x1="12" y1="1.5" x2="12" y2="5.5" stroke="#d1d5db" strokeWidth="0.4" />
      <line x1="14.4" y1="8.2" x2="18.2" y2="10.5" stroke="#d1d5db" strokeWidth="0.4" />
      <line x1="9.6" y1="8.2" x2="5.8" y2="10.5" stroke="#d1d5db" strokeWidth="0.4" />
      <line x1="8.2" y1="15" x2="8.5" y2="17" stroke="#d1d5db" strokeWidth="0.4" />
      <line x1="15.8" y1="15" x2="15.5" y2="17" stroke="#d1d5db" strokeWidth="0.4" />
      {/* Shine highlight */}
      <ellipse cx="9" cy="7" rx="2.5" ry="1.5" fill="white" opacity="0.25" transform="rotate(-20 9 7)" />
      <defs>
        <radialGradient id="ballBase" cx="40%" cy="35%" r="60%">
          <stop stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#e8e8e8" />
          <stop offset="1" stopColor="#c8c8c8" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function AssistIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Football boot */}
      <path
        d="M3 17.5L5 12C5.5 10.5 6.5 9.5 8 9H11L13 10L15 9.5V12L13.5 13L11 12.5L9.5 15L6.5 17.5H3Z"
        fill="url(#assistBoot)"
        stroke="#1e3a5f"
        strokeWidth="0.5"
      />
      {/* Boot studs */}
      <circle cx="4.5" cy="18" r="0.6" fill="#0ea5e9" />
      <circle cx="6.5" cy="18.2" r="0.6" fill="#0ea5e9" />
      {/* Curved pass trajectory (dotted arc) */}
      <path
        d="M15 10C17 6 20 5 22 6"
        stroke="#38bdf8"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="2 1.5"
        opacity="0.8"
      />
      {/* Small ball at end of trajectory */}
      <circle cx="22" cy="6" r="2" fill="white" stroke="#d1d5db" strokeWidth="0.4" />
      <path d="M22 4.5L22.8 5.5L22.3 6.8H21.7L21.2 5.5Z" fill="#1a1a2e" opacity="0.5" />
      {/* Arrow tip on trajectory */}
      <path d="M20.5 4.5L22 6L20 6.5" stroke="#38bdf8" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
      <defs>
        <linearGradient id="assistBoot" x1="3" y1="9" x2="15" y2="17">
          <stop stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function OwnGoalIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Ball with orange/red tint */}
      <circle cx="13" cy="13" r="9" fill="url(#ownBallBase)" stroke="#f97316" strokeWidth="0.8" />
      {/* Pentagon patches */}
      <path d="M13 7.5L15 9.7L14.1 12.3H11.9L11 9.7Z" fill="#7c2d12" opacity="0.7" />
      <path d="M8.5 11.5L10.6 10.5L11.5 13L10 15H8Z" fill="#7c2d12" opacity="0.7" />
      <path d="M17.5 11.5L15.4 10.5L14.5 13L16 15H18Z" fill="#7c2d12" opacity="0.7" />
      {/* Wrong-way arrow overlay */}
      <path d="M7 3L3 7M3 7L7 7M3 7L3 3" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function YellowCardIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="2" width="14" height="20" rx="2" fill="url(#yellowGrad)" />
      <rect x="5" y="2" width="14" height="20" rx="2" stroke="#d97706" strokeWidth="0.5" />
      {/* Shine effect */}
      <rect x="7" y="4" width="3" height="8" rx="1" fill="white" opacity="0.2" />
      <defs>
        <linearGradient id="yellowGrad" x1="5" y1="2" x2="19" y2="22">
          <stop stopColor="#fde047" />
          <stop offset="0.5" stopColor="#facc15" />
          <stop offset="1" stopColor="#eab308" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function RedCardIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="2" width="14" height="20" rx="2" fill="url(#redGrad)" />
      <rect x="5" y="2" width="14" height="20" rx="2" stroke="#991b1b" strokeWidth="0.5" />
      <rect x="7" y="4" width="3" height="8" rx="1" fill="white" opacity="0.15" />
      <defs>
        <linearGradient id="redGrad" x1="5" y1="2" x2="19" y2="22">
          <stop stopColor="#f87171" />
          <stop offset="0.5" stopColor="#ef4444" />
          <stop offset="1" stopColor="#dc2626" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function BlueCardIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="2" width="14" height="20" rx="2" fill="url(#blueGrad)" />
      <rect x="5" y="2" width="14" height="20" rx="2" stroke="#1e40af" strokeWidth="0.5" />
      <rect x="7" y="4" width="3" height="8" rx="1" fill="white" opacity="0.15" />
      <defs>
        <linearGradient id="blueGrad" x1="5" y1="2" x2="19" y2="22">
          <stop stopColor="#60a5fa" />
          <stop offset="0.5" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function MvpIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Star shape */}
      <path
        d="M12 2L14.9 8.6L22 9.2L16.7 14L18.2 21L12 17.3L5.8 21L7.3 14L2 9.2L9.1 8.6L12 2Z"
        fill="url(#mvpGrad)"
        stroke="#b45309"
        strokeWidth="0.5"
      />
      {/* Inner glow */}
      <path
        d="M12 6L13.5 9.8L17.5 10.1L14.5 12.8L15.4 16.7L12 14.6L8.6 16.7L9.5 12.8L6.5 10.1L10.5 9.8L12 6Z"
        fill="white"
        opacity="0.25"
      />
      <defs>
        <linearGradient id="mvpGrad" x1="2" y1="2" x2="22" y2="21">
          <stop stopColor="#fcd34d" />
          <stop offset="0.5" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function BestGkIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Glove palm */}
      <path
        d="M5 20V14L5.5 11L7 8.5V5C7 4 8 3.5 8.5 4.5L9 7V5C9 3.5 10 3 10.5 4L11 7V4.5C11 3 12 2.5 12.5 3.5L13 7V5C13 3.5 14 3 14.5 4L15 7L16 9C17 10.5 17 12 17 14V17C17 19 15.5 20.5 13 20.5H7C6 20.5 5 20 5 20Z"
        fill="url(#bestGkGrad)"
        stroke="#047857"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      {/* Finger segments */}
      <line x1="8" y1="5" x2="8" y2="8" stroke="#059669" strokeWidth="0.4" opacity="0.5" />
      <line x1="10" y1="4.5" x2="10" y2="8" stroke="#059669" strokeWidth="0.4" opacity="0.5" />
      <line x1="12" y1="4" x2="12" y2="8" stroke="#059669" strokeWidth="0.4" opacity="0.5" />
      <line x1="14" y1="4.5" x2="14" y2="8" stroke="#059669" strokeWidth="0.4" opacity="0.5" />
      {/* Palm grip texture */}
      <path d="M7 12H15" stroke="white" strokeWidth="0.3" opacity="0.2" />
      <path d="M7 14H15" stroke="white" strokeWidth="0.3" opacity="0.2" />
      <path d="M7 16H14" stroke="white" strokeWidth="0.3" opacity="0.2" />
      {/* Star badge for "best" */}
      <circle cx="19" cy="6" r="4.5" fill="url(#bestStarBg)" stroke="#b45309" strokeWidth="0.5" />
      <path d="M19 2.8L20 5L22.3 5.2L20.5 6.8L21 9L19 7.8L17 9L17.5 6.8L15.7 5.2L18 5Z" fill="#fbbf24" />
      <defs>
        <linearGradient id="bestGkGrad" x1="5" y1="3" x2="17" y2="20">
          <stop stopColor="#6ee7b7" />
          <stop offset="0.5" stopColor="#34d399" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
        <radialGradient id="bestStarBg" cx="50%" cy="50%" r="50%">
          <stop stopColor="#fef3c7" />
          <stop offset="1" stopColor="#f59e0b" />
        </radialGradient>
      </defs>
    </svg>
  );
}

export function CaptainIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Arm silhouette */}
      <path
        d="M7 22V6C7 4.5 8 3 10 3H14C16 3 17 4.5 17 6V22"
        fill="#374151"
        stroke="#4b5563"
        strokeWidth="0.5"
      />
      {/* Captain armband wrapped around */}
      <rect x="5" y="9" width="14" height="6" rx="1" fill="url(#capBand)" />
      <rect x="5" y="9" width="14" height="6" rx="1" stroke="#92400e" strokeWidth="0.6" />
      {/* Armband stripe detail */}
      <rect x="5" y="9" width="14" height="1.5" rx="0.5" fill="white" opacity="0.15" />
      {/* Bold C letter */}
      <text
        x="12"
        y="14.2"
        textAnchor="middle"
        fill="white"
        fontSize="5.5"
        fontWeight="bold"
        fontFamily="sans-serif"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" } as React.CSSProperties}
      >
        C
      </text>
      {/* Shine on armband */}
      <ellipse cx="8" cy="11" rx="1.5" ry="0.8" fill="white" opacity="0.12" />
      <defs>
        <linearGradient id="capBand" x1="5" y1="9" x2="19" y2="15">
          <stop stopColor="#fcd34d" />
          <stop offset="0.3" stopColor="#fbbf24" />
          <stop offset="0.7" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#d97706" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function GkIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Goal post frame */}
      <path d="M3 20V6H21V20" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      {/* Net pattern */}
      <line x1="7" y1="6" x2="7" y2="20" stroke="white" strokeWidth="0.5" opacity="0.3" />
      <line x1="12" y1="6" x2="12" y2="20" stroke="white" strokeWidth="0.5" opacity="0.3" />
      <line x1="17" y1="6" x2="17" y2="20" stroke="white" strokeWidth="0.5" opacity="0.3" />
      <line x1="3" y1="10" x2="21" y2="10" stroke="white" strokeWidth="0.5" opacity="0.3" />
      <line x1="3" y1="14" x2="21" y2="14" stroke="white" strokeWidth="0.5" opacity="0.3" />
      <line x1="3" y1="18" x2="21" y2="18" stroke="white" strokeWidth="0.5" opacity="0.3" />
      {/* GK text */}
      <rect x="7" y="11" width="10" height="5" rx="1" fill="url(#gkBadge)" opacity="0.9" />
      <text x="12" y="15" textAnchor="middle" fill="white" fontSize="4" fontWeight="bold" fontFamily="sans-serif">
        GK
      </text>
      <defs>
        <linearGradient id="gkBadge" x1="7" y1="11" x2="17" y2="16">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#4f46e5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function PositionIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Jersey/shirt shape */}
      <path
        d="M8 3L4 6V10L6 10V20H18V10L20 10V6L16 3H14C14 4.1 13.1 5 12 5C10.9 5 10 4.1 10 3H8Z"
        fill="url(#posGrad)"
        stroke="#4338ca"
        strokeWidth="0.6"
      />
      <defs>
        <linearGradient id="posGrad" x1="4" y1="3" x2="20" y2="20">
          <stop stopColor="#818cf8" />
          <stop offset="1" stopColor="#6366f1" />
        </linearGradient>
      </defs>
    </svg>
  );
}
