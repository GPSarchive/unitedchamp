'use client';

import { AnimatePresence, motion } from 'framer-motion';
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

  const podiumData = [
    {
      bg: 'bg-gradient-to-br from-amber-500 via-yellow-400 to-amber-600',
      glow: 'shadow-[0_0_40px_rgba(251,191,36,0.4)]',
      border: 'border-amber-400',
      label: '1ΟΣ',
      textColor: 'text-amber-900',
    },
    {
      bg: 'bg-gradient-to-br from-gray-300 via-gray-200 to-gray-400',
      glow: 'shadow-[0_0_30px_rgba(192,192,192,0.3)]',
      border: 'border-gray-300',
      label: '2ΟΣ',
      textColor: 'text-gray-700',
    },
    {
      bg: 'bg-gradient-to-br from-orange-600 via-orange-500 to-orange-700',
      glow: 'shadow-[0_0_30px_rgba(234,88,12,0.3)]',
      border: 'border-orange-500',
      label: '3ΟΣ',
      textColor: 'text-orange-900',
    },
  ];

  // How much of a collapsed card peeks out from behind (px)
  const PEEK = 52;
  // Full card width
  const CARD_WIDTH = 340;
  // Card height
  const CARD_HEIGHT = 380;

  return (
    <section
      ref={sectionRef}
      className="relative py-20 sm:py-28 overflow-hidden bg-[#0f1115]"
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
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-6xl font-bold text-white mb-4 tracking-tight">
            ΚΟΡΥΦΑΙΟΙ ΣΚΟΡΕΡ
          </h2>
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent mx-auto" />
          <p className="mt-4 text-base text-gray-400 font-light">
            Οι κορυφαίοι γκολ σκορερ όλων των εποχών
          </p>
        </motion.div>

        {/* Horizontally Stacked Cards */}
        <div
          className="relative mx-auto"
          style={{
            width: `${CARD_WIDTH + (scorers.length - 1) * PEEK}px`,
            maxWidth: '100%',
            height: `${CARD_HEIGHT}px`,
          }}
        >
          {scorers.map((scorer, index) => {
            const podium = podiumData[index] || podiumData[2];
            const isActive = activeIndex === index;

            // Horizontal position: cards before/at active stack normally,
            // cards after active get pushed right past the full card width
            let xPosition: number;
            if (index <= activeIndex) {
              xPosition = index * PEEK;
            } else {
              xPosition = CARD_WIDTH + index * PEEK;
            }

            return (
              <motion.div
                key={scorer.id}
                initial={{ opacity: 0, x: 100 }}
                animate={isVisible ? {
                  opacity: 1,
                  x: xPosition,
                } : { opacity: 0, x: 100 }}
                transition={{
                  duration: 0.5,
                  delay: isVisible ? index * 0.15 : 0,
                  type: 'spring',
                  stiffness: 200,
                  damping: 25,
                }}
                onClick={() => setActiveIndex(index)}
                className="absolute top-0 cursor-pointer"
                style={{
                  zIndex: activeIndex === index ? 10 : scorers.length - index,
                  width: `${CARD_WIDTH}px`,
                  height: `${CARD_HEIGHT}px`,
                }}
              >
                <div className={`relative w-full h-full bg-gradient-to-b from-neutral-900 to-black border ${isActive ? 'border-orange-500/60' : 'border-white/10'} overflow-hidden rounded-xl transition-colors duration-300 ${isActive ? 'shadow-[0_0_30px_rgba(249,115,22,0.2)]' : 'shadow-lg shadow-black/50'}`}>

                  {/* Collapsed peek strip - vertical strip on the right edge visible when not active */}
                  {!isActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-neutral-900 via-neutral-800 to-black z-10 px-2">
                      {/* Rank badge */}
                      <div
                        className={`${podium.bg} flex items-center justify-center mb-3`}
                        style={{ width: '40px', height: '40px', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
                      >
                        <span className={`text-lg font-black ${podium.textColor}`}>{index + 1}</span>
                      </div>
                      {/* Vertical name */}
                      <div className="writing-vertical text-white font-bold text-xs uppercase tracking-widest"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                      >
                        {scorer.lastName}
                      </div>
                      <div className="mt-3 text-orange-500 font-black text-lg">{scorer.goals}</div>
                    </div>
                  )}

                  {/* Full card content - visible when active */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="h-full flex flex-col"
                      >
                        {/* Top: Photo */}
                        <div className="relative w-full h-1/2 flex-shrink-0 overflow-hidden">
                          <Image
                            src={scorer.photo || '/images/default-player.png'}
                            alt={`${scorer.firstName} ${scorer.lastName}`}
                            fill
                            className="object-cover object-top"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                          {/* Rank hexagon */}
                          <div
                            className={`absolute top-3 left-3 ${podium.bg} ${podium.glow} flex items-center justify-center`}
                            style={{ width: '44px', height: '44px', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}
                          >
                            <span className={`text-xl font-black ${podium.textColor}`}>{index + 1}</span>
                          </div>

                          {/* Goals overlay */}
                          <div className="absolute top-3 right-3 backdrop-blur-md bg-black/60 border border-orange-500/30 px-3 py-1.5 rounded">
                            <span className="text-3xl font-black text-orange-500 leading-none">{scorer.goals}</span>
                            <span className="text-[10px] text-gray-300 ml-1 uppercase">γκολ</span>
                          </div>

                          {/* Team badge */}
                          {scorer.teamLogo && (
                            <div className="absolute bottom-3 left-3 w-9 h-9 bg-white/10 backdrop-blur-sm border border-white/20 rounded p-1">
                              <Image
                                src={scorer.teamLogo}
                                alt={scorer.teamName || 'Team'}
                                width={28}
                                height={28}
                                className="object-contain"
                              />
                            </div>
                          )}
                        </div>

                        {/* Bottom: Info */}
                        <div className="flex-1 p-4 flex flex-col justify-center">
                          <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight">
                            {scorer.firstName}
                          </h3>
                          <h3 className="text-lg font-black text-orange-500 uppercase tracking-tight leading-tight mb-3">
                            {scorer.lastName}
                          </h3>

                          {/* Stats row */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white/5 border border-white/10 rounded p-2 text-center">
                              <div className="text-base font-bold text-white">{scorer.assists}</div>
                              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Ασίστ</div>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded p-2 text-center">
                              <div className="text-base font-bold text-white">{scorer.matches}</div>
                              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Αγώνες</div>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded p-2 text-center">
                              <div className="text-base font-bold text-orange-500">{(scorer.goals / scorer.matches).toFixed(2)}</div>
                              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Γ/Α</div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
