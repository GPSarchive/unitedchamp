// Premium SVG stat icons for match events
// Inspired by Super League broadcast graphics

export function GoalIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="url(#goalGrad)" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6" stroke="url(#goalGrad)" strokeWidth="1" opacity="0.6" />
      {/* Pentagon pattern */}
      <path d="M12 6L14.5 9.5L13.5 13H10.5L9.5 9.5L12 6Z" fill="url(#goalGrad)" opacity="0.8" />
      <line x1="12" y1="2" x2="12" y2="6" stroke="url(#goalGrad)" strokeWidth="0.8" opacity="0.5" />
      <line x1="22" y1="12" x2="18" y2="12" stroke="url(#goalGrad)" strokeWidth="0.8" opacity="0.5" />
      <line x1="2" y1="12" x2="6" y2="12" stroke="url(#goalGrad)" strokeWidth="0.8" opacity="0.5" />
      <line x1="12" y1="22" x2="12" y2="18" stroke="url(#goalGrad)" strokeWidth="0.8" opacity="0.5" />
      <defs>
        <linearGradient id="goalGrad" x1="0" y1="0" x2="24" y2="24">
          <stop stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function AssistIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Boot/shoe shape */}
      <path
        d="M4 18L6 10C6.5 8 8 7 10 7H14L16 9L20 10V13L18 14L14 13L12 16L8 18H4Z"
        fill="url(#assistGrad)"
        stroke="url(#assistGrad)"
        strokeWidth="0.8"
        opacity="0.9"
      />
      {/* Speed lines */}
      <line x1="2" y1="8" x2="5" y2="8" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <line x1="1" y1="11" x2="4" y2="11" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <line x1="2" y1="14" x2="4.5" y2="14" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" opacity="0.3" />
      <defs>
        <linearGradient id="assistGrad" x1="2" y1="7" x2="20" y2="18">
          <stop stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function OwnGoalIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="#f97316" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="6" stroke="#f97316" strokeWidth="1" opacity="0.5" />
      <path d="M12 6L14.5 9.5L13.5 13H10.5L9.5 9.5L12 6Z" fill="#f97316" opacity="0.6" />
      {/* Arrow pointing wrong way */}
      <path d="M8 4L4 8M4 8L8 8M4 8L4 4" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
      {/* Glove shape */}
      <path
        d="M6 20V12C6 10 7 8 8 7L9 4C9.5 3 10.5 3 11 4L11.5 6L12.5 3.5C13 2.5 14 2.5 14.5 3.5L15 6L16 4C16.5 3 17.5 3 18 4L18.5 7C19 8 19.5 9 19.5 11V15C19.5 18 17.5 20 15 20H6Z"
        fill="url(#gkGrad)"
        stroke="#065f46"
        strokeWidth="0.6"
      />
      {/* Grip lines */}
      <line x1="9" y1="12" x2="9" y2="16" stroke="white" strokeWidth="0.6" opacity="0.3" />
      <line x1="12" y1="11" x2="12" y2="16" stroke="white" strokeWidth="0.6" opacity="0.3" />
      <line x1="15" y1="11" x2="15" y2="16" stroke="white" strokeWidth="0.6" opacity="0.3" />
      <defs>
        <linearGradient id="gkGrad" x1="6" y1="3" x2="19" y2="20">
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function CaptainIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Armband with C */}
      <rect x="3" y="7" width="18" height="10" rx="5" fill="url(#capGrad)" stroke="#7c2d12" strokeWidth="0.6" />
      <text
        x="12"
        y="14.5"
        textAnchor="middle"
        fill="white"
        fontSize="8"
        fontWeight="bold"
        fontFamily="sans-serif"
      >
        C
      </text>
      <defs>
        <linearGradient id="capGrad" x1="3" y1="7" x2="21" y2="17">
          <stop stopColor="#fbbf24" />
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
