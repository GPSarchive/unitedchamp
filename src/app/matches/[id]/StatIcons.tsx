// Stat icons using react-icons & lucide-react
import { FaFutbol, FaHandsHelping, FaCrown, FaMedal } from "react-icons/fa";
import { GiSoccerBall, GiWhistle } from "react-icons/gi";
import { MdSportsSoccer, MdEmojiEvents } from "react-icons/md";
import { Shield, Target } from "lucide-react";

export function GoalIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <GiSoccerBall className={`${className} text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]`} />;
}

export function AssistIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <FaHandsHelping className={`${className} text-sky-400 drop-shadow-[0_0_4px_rgba(56,189,248,0.5)]`} />;
}

export function OwnGoalIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <GiSoccerBall className={`${className} text-orange-500 drop-shadow-[0_0_4px_rgba(249,115,22,0.5)]`} />;
}

export function YellowCardIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="2" width="14" height="20" rx="2" fill="url(#yellowGrad)" />
      <rect x="5" y="2" width="14" height="20" rx="2" stroke="#d97706" strokeWidth="0.5" />
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
  return <MdEmojiEvents className={`${className} text-amber-300 drop-shadow-[0_0_6px_rgba(252,211,77,0.6)]`} />;
}

export function BestGkIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <FaMedal className={`${className} text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]`} />;
}

export function CaptainIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <FaCrown className={`${className} text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]`} />;
}

export function GkIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <Shield className={`${className} text-indigo-400 drop-shadow-[0_0_4px_rgba(129,140,248,0.5)]`} />;
}

export function PositionIcon({ className = "h-5 w-5" }: { className?: string }) {
  return <Target className={`${className} text-violet-400 drop-shadow-[0_0_4px_rgba(167,139,250,0.4)]`} />;
}
