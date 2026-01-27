'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

interface TopScorerData {
  id: number;
  firstName: string;
  lastName: string;
  photo: string;
  goals: number;
  assists: number;
  matches: number;
  teamName?: string;
  teamLogo?: string;
}

interface TopScorersProps {
  scorers: TopScorerData[];
}

export default function TopScorers({ scorers }: TopScorersProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Medal colors and labels for 1st, 2nd, 3rd
  const podiumData = [
    {
      bg: 'bg-gradient-to-br from-amber-500 via-yellow-400 to-amber-600',
      glow: 'shadow-[0_0_60px_rgba(251,191,36,0.6)]',
      border: 'border-amber-400',
      label: '1ΟΣ',
      textColor: 'text-amber-900'
    }, // Gold
    {
      bg: 'bg-gradient-to-br from-gray-300 via-gray-200 to-gray-400',
      glow: 'shadow-[0_0_50px_rgba(192,192,192,0.5)]',
      border: 'border-gray-300',
      label: '2ΟΣ',
      textColor: 'text-gray-700'
    }, // Silver
    {
      bg: 'bg-gradient-to-br from-orange-600 via-orange-500 to-orange-700',
      glow: 'shadow-[0_0_40px_rgba(234,88,12,0.5)]',
      border: 'border-orange-500',
      label: '3ΟΣ',
      textColor: 'text-orange-900'
    }, // Bronze
  ];

  return (
    <section
      ref={sectionRef}
      className="relative py-20 sm:py-32 overflow-hidden bg-[#0f1115]"
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/10 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Title */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-5xl sm:text-7xl font-bold text-white mb-4 tracking-tight">
            ΚΟΡΥΦΑΙΟΙ ΣΚΟΡΕΡ
          </h2>
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent mx-auto" />
          <p className="mt-6 text-lg text-gray-400 font-light">
            Οι κορυφαίοι γκολ σκορερ όλων των εποχών
          </p>
        </motion.div>

        {/* Stacked Cards Container - Horizontal */}
        <div className="relative max-w-7xl mx-auto" style={{ height: '700px' }}>
          {scorers.map((scorer, index) => {
            const podium = podiumData[index] || podiumData[2];
            const isActive = index === activeIndex;

            // Calculate offset for horizontal stacked cards
            // Active card is at the left (0)
            // Other cards are pushed to the right so only 10% is visible
            const cardWidth = 600; // Approximate card width
            const visiblePortion = 0.1; // 10% visible
            const stackOffset = cardWidth * (1 - visiblePortion);

            // Position cards: active at left, others stacked to the right
            let xOffset = 0;
            let zIndex = scorers.length - index;

            if (!isActive) {
              // Find position in stack (how many cards are to the left of this one)
              const positionInStack = index > activeIndex ? index - 1 : index;
              xOffset = stackOffset + (positionInStack * (cardWidth * visiblePortion));
              zIndex = scorers.length - index;
            } else {
              zIndex = scorers.length + 10; // Active card always on top
            }

            return (
              <motion.div
                key={scorer.id}
                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                animate={
                  isVisible
                    ? {
                        opacity: 1,
                        x: xOffset,
                        scale: 1,
                      }
                    : {}
                }
                transition={{
                  duration: 0.6,
                  delay: index * 0.2,
                  type: 'spring',
                  stiffness: 100,
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${cardWidth}px`,
                  zIndex,
                }}
                className={`group ${!isActive ? 'cursor-pointer' : ''}`}
                onClick={() => {
                  if (!isActive) {
                    setActiveIndex(index);
                  }
                }}
              >
                {/* Rank Badge - Hexagon Shape */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={isVisible ? { scale: 1, rotate: 0 } : {}}
                  transition={{ duration: 0.8, delay: index * 0.2 + 0.3 }}
                  className={`absolute -top-8 -left-8 z-20 ${podium.bg} ${podium.glow} border-4 ${podium.border} overflow-hidden`}
                  style={{
                    width: '90px',
                    height: '90px',
                    clipPath:
                      'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  }}
                >
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <span
                      className={`text-xs font-black ${podium.textColor} tracking-wider`}
                    >
                      {podium.label}
                    </span>
                    <span
                      className={`text-4xl font-black ${podium.textColor} drop-shadow-md leading-none mt-1`}
                    >
                      {index + 1}
                    </span>
                  </div>
                </motion.div>

                {/* Card Container */}
                <div
                  className={`relative h-full bg-gradient-to-b from-neutral-900 to-black border-2 overflow-hidden transition-all duration-500 ${
                    isActive
                      ? 'border-orange-500/50 shadow-[0_0_40px_rgba(249,115,22,0.3)]'
                      : 'border-white/10 hover:border-orange-500/30'
                  }`}
                >
                  {/* Photo Container with Shimmer */}
                  <div className="relative h-[400px] sm:h-[500px] overflow-hidden">
                    {/* Player Photo */}
                    <Image
                      src={scorer.photo || '/images/default-player.png'}
                      alt={`${scorer.firstName} ${scorer.lastName}`}
                      fill
                      className="object-cover object-top transition-transform duration-700 group-hover:scale-110"
                    />

                    {/* Dark Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

                    {/* Shimmer/Glare Effect */}
                    <motion.div
                      initial={{ x: '-100%', opacity: 0 }}
                      animate={
                        isVisible
                          ? {
                              x: ['100%', '200%'],
                              opacity: [0, 0.7, 0],
                            }
                          : {}
                      }
                      transition={{
                        duration: 2,
                        delay: index * 0.2 + 0.5,
                        repeat: Infinity,
                        repeatDelay: 5,
                        ease: 'easeInOut',
                      }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                      style={{ width: '50%' }}
                    />

                    {/* Animated Corner Accents */}
                    <div
                      className={`absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-orange-500 transition-opacity duration-300 ${
                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    />
                    <div
                      className={`absolute bottom-0 right-0 w-20 h-20 border-b-4 border-r-4 border-orange-500 transition-opacity duration-300 ${
                        isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}
                    />

                    {/* Goals Count Overlay */}
                    <div className="absolute top-6 right-6 backdrop-blur-md bg-black/60 border border-orange-500/30 px-6 py-3">
                      <div className="text-6xl font-black text-orange-500 leading-none">
                        {scorer.goals}
                      </div>
                      <div className="text-xs text-gray-300 font-light tracking-wider mt-1">
                        ΓΚΟΛ
                      </div>
                    </div>

                    {/* Team Badge (if available) */}
                    {scorer.teamLogo && (
                      <div className="absolute bottom-6 left-6 w-16 h-16 bg-white/10 backdrop-blur-sm border border-white/20 p-2">
                        <Image
                          src={scorer.teamLogo}
                          alt={scorer.teamName || 'Team'}
                          width={48}
                          height={48}
                          className="object-contain"
                        />
                      </div>
                    )}
                  </div>

                  {/* Player Info Section */}
                  <div className="p-6 bg-gradient-to-b from-black to-neutral-950">
                    {/* Name */}
                    <h3 className="text-3xl sm:text-4xl font-black text-white mb-1 tracking-tight uppercase">
                      {scorer.firstName}
                    </h3>
                    <h3 className="text-3xl sm:text-4xl font-black text-orange-500 mb-6 tracking-tight uppercase">
                      {scorer.lastName}
                    </h3>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 border border-white/10 p-4 transition-all duration-300 hover:bg-orange-500/10 hover:border-orange-500/30">
                        <div className="text-2xl font-bold text-white">
                          {scorer.assists}
                        </div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">
                          Ασίστ
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/10 p-4 transition-all duration-300 hover:bg-orange-500/10 hover:border-orange-500/30">
                        <div className="text-2xl font-bold text-white">
                          {scorer.matches}
                        </div>
                        <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">
                          Αγώνες
                        </div>
                      </div>
                    </div>

                    {/* Goals per Match Ratio */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400 uppercase tracking-wider">
                          Γκολ/Αγώνα
                        </span>
                        <span className="text-xl font-bold text-orange-500">
                          {(scorer.goals / scorer.matches).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Animated Border Pulse */}
                  <motion.div
                    animate={{
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className={`absolute inset-0 border-2 pointer-events-none ${
                      isActive ? 'border-orange-500/50' : 'border-orange-500/0'
                    }`}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
