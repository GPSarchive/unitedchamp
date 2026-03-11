'use client';

import Image from 'next/image';
import { forwardRef, type HTMLAttributes } from 'react';
import { Card } from '@/components/CardSwap';
import type { TopPlayerData } from './types';

const rankStyles = [
  {
    border: 'border-purple-400/40',
    text: 'text-purple-400',
    badge: 'bg-gradient-to-br from-purple-400 to-fuchsia-300',
    divider: 'from-purple-400/50',
    label: 'MVP KING',
    rankColor: 'text-black/80',
    accent: 'from-purple-500/10 to-transparent',
  },
  {
    border: 'border-slate-300/40',
    text: 'text-slate-300',
    badge: 'bg-gradient-to-br from-slate-300 to-gray-200',
    divider: 'from-slate-300/50',
    label: '2η Θέση',
    rankColor: 'text-black/70',
    accent: 'from-slate-300/5 to-transparent',
  },
  {
    border: 'border-violet-500/40',
    text: 'text-violet-400',
    badge: 'bg-gradient-to-br from-violet-500 to-violet-400',
    divider: 'from-violet-500/50',
    label: '3η Θέση',
    rankColor: 'text-white/90',
    accent: 'from-violet-500/5 to-transparent',
  },
  {
    border: 'border-white/10',
    text: 'text-white/40',
    badge: 'bg-white/10',
    divider: 'from-white/20',
    label: 'CONTENDER',
    rankColor: 'text-white',
    accent: 'from-white/5 to-transparent',
  },
];

interface MvpCardProps extends HTMLAttributes<HTMLDivElement> {
  player: TopPlayerData;
  index: number;
}

const MvpCard = forwardRef<HTMLDivElement, MvpCardProps>(
  ({ player, index, style, onClick, ...rest }, ref) => {
    const rankStyle = rankStyles[index] || rankStyles[3];
    const mvps = player.mvpAwards ?? 0;
    const perGame = player.matches > 0 ? (mvps / player.matches).toFixed(2) : '0.00';

    return (
      <Card
        ref={ref}
        style={style}
        onClick={onClick}
        customClass={`border ${rankStyle.border} bg-[#0d0a14] transition-all duration-500`}
      >
        {/* Purple ambient glow for MVPs */}
        <div className="absolute inset-0 bg-[#0d0a14]" />
        <div className={`absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l ${rankStyle.accent} opacity-40`} />

        <div className="relative flex h-full w-full z-10">

          {/* ─── Left: Player Image ─── */}
          <div className="relative w-[42%] h-full overflow-hidden flex-shrink-0 group border-r border-white/5">
            <Image
              src={player.photo || '/images/default-player.png'}
              alt={`${player.firstName} ${player.lastName}`}
              fill
              className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0d0a14]/40 to-[#0d0a14]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0a14] via-transparent to-transparent opacity-60" />

            {player.teamLogo && (
              <div className="absolute bottom-5 left-5">
                <div className="w-10 h-10 bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg p-1.5 flex items-center justify-center">
                  <Image
                    src={player.teamLogo}
                    alt={player.teamName || ''}
                    width={24}
                    height={24}
                    className="object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ─── Right: Stats ─── */}
          <div className="flex-1 flex flex-col justify-between py-8 pr-8 pl-6">

            {/* Name & Rank */}
            <div className="flex items-start justify-between w-full">
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-white/40 tracking-[0.2em] mb-1 uppercase">
                  {player.firstName}
                </p>
                <h3 className="text-4xl lg:text-5xl font-black text-white uppercase tracking-tight leading-[0.9]">
                  {player.lastName}
                </h3>
              </div>
              <div className="relative mt-1">
                <div className={`relative w-12 h-14 transform skew-x-[-12deg] flex flex-col items-center justify-center ${rankStyle.badge} shadow-sm`}>
                  <span className={`text-2xl font-black ${rankStyle.rankColor} leading-none skew-x-[12deg]`}>
                    {index + 1}
                  </span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full flex items-center gap-4 my-2">
              <div className={`h-[2px] w-12 bg-gradient-to-r ${rankStyle.divider} to-transparent`} />
              <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${rankStyle.text}`}>
                {rankStyle.label}
              </span>
            </div>

            {/* Hero Stat: MVP Awards */}
            <div className="relative mt-2">
              <div className="flex items-end gap-3">
                <span className={`text-7xl font-black leading-none tracking-tighter ${rankStyle.text}`}>
                  {mvps}
                </span>
                <span className="text-sm font-bold text-white/30 uppercase tracking-[0.15em] mb-2">
                  MVPs
                </span>
              </div>
            </div>

            {/* Secondary Stats */}
            <div className="flex items-center justify-between border-t border-white/[0.08] pt-5 mt-4">
              <div>
                <div className="text-2xl font-bold text-white tabular-nums">{player.goals}</div>
                <div className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium mt-1">Goals</div>
              </div>
              <div className="w-px h-8 bg-white/[0.08]" />
              <div>
                <div className="text-2xl font-bold text-white tabular-nums">{player.matches}</div>
                <div className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium mt-1">Matches</div>
              </div>
              <div className="w-px h-8 bg-white/[0.08]" />
              <div>
                <div className={`text-2xl font-bold tabular-nums ${rankStyle.text}`}>{perGame}</div>
                <div className="text-[10px] text-white/30 uppercase tracking-[0.1em] font-medium mt-1">Per Game</div>
              </div>
            </div>

          </div>
        </div>
      </Card>
    );
  }
);

MvpCard.displayName = 'MvpCard';
export default MvpCard;
