'use client'

import { useEffect, useRef, useState } from 'react'

export type HeaderStage = 'visible' | 'peek' | 'hidden'

type Options = {
  /** Start considering hide behavior only after this scrollY */
  activateAt?: number
  /** Ignore tiny scroll jitter under this delta (px) */
  jitter?: number
  /** Continuous downward pixels to reach the 'peek' stage */
  peekAfterPx?: number
  /** Continuous downward pixels to reach the 'hidden' stage (after peek) */
  hideAfterPx?: number
  /** Continuous upward pixels to fully reveal again */
  revealAfterPx?: number
}

/**
 * Three-stage header visibility with hysteresis:
 * - visible → (down a bit) → peek (half hidden) → (down more) → hidden
 * - any meaningful upward scroll reveals to visible
 * - requires continuous movement in one direction (accumulated distance) before changing stage
 */
export function useStagedHeader({
  activateAt = 72,
  jitter = 6,
  peekAfterPx = 36,
  hideAfterPx = 120,
  revealAfterPx = 28,
}: Options = {}) {
  const [stage, setStage] = useState<HeaderStage>('visible')
  const [scrolled, setScrolled] = useState(false)

  const lastY = useRef(0)
  const downAccum = useRef(0)
  const upAccum = useRef(0)
  const lastDir = useRef<1 | -1 | 0>(0) // 1=down, -1=up, 0=none
  const prefersReduced = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    prefersReduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    lastY.current = window.scrollY || window.pageYOffset

    const onScroll = () => {
      const y = window.scrollY || window.pageYOffset
      setScrolled(y > 10)

      if (prefersReduced.current) {
        setStage('visible')
        lastY.current = y
        return
      }

      const delta = y - lastY.current
      if (Math.abs(delta) < jitter) return

      const dir: 1 | -1 = delta > 0 ? 1 : -1
      if (dir !== lastDir.current) {
        // direction changed: reset the opposite accumulator
        if (dir === 1) {
          downAccum.current = 0
        } else {
          upAccum.current = 0
        }
        lastDir.current = dir
      }

      if (dir === 1) {
        // DOWN
        upAccum.current = 0
        downAccum.current += delta

        if (y <= activateAt) {
          setStage('visible')
        } else {
          // First reach 'peek', then 'hidden' as we keep going down
          if (downAccum.current > hideAfterPx) {
            setStage('hidden')
          } else if (downAccum.current > peekAfterPx) {
            setStage('peek')
          }
        }
      } else {
        // UP
        downAccum.current = 0
        upAccum.current += -delta

        if (upAccum.current > revealAfterPx) {
          setStage('visible')
        }
      }

      lastY.current = y
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    // initialize once
    onScroll()

    return () => window.removeEventListener('scroll', onScroll)
  }, [activateAt, jitter, peekAfterPx, hideAfterPx, revealAfterPx])

  return { stage, scrolled }
}
