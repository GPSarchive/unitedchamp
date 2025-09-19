'use client'

import { useState, useRef, useEffect } from 'react'
import { useScroll, useMotionValueEvent } from 'framer-motion'

export type HeaderStage = 'visible' | 'peek' | 'hidden'

type Options = {
  /** Begin staged behavior only after this scrollY (px) */
  activateAt?: number
  /** Ignore tiny deltas (px) */
  jitter?: number
  /** Continuous downward pixels to reach the 'peek' stage */
  peekAfterPx?: number
  /** Continuous downward pixels to reach the 'hidden' stage after peek */
  hideAfterPx?: number
  /** Continuous upward pixels to fully reveal again */
  revealAfterPx?: number
}

/**
 * Framer Motion-powered staged header visibility with hysteresis.
 * Uses `useScroll` + `useMotionValueEvent` (no window listeners).
 *
 * visible ──(down > peekAfterPx)──▶ peek ──(down > hideAfterPx)──▶ hidden
 * ▲                                         │
 * └──────────────(up > revealAfterPx)◀──────┘
 */
export function useStagedHeaderMotion({
  activateAt = 72,
  jitter = 6,
  peekAfterPx = 36,
  hideAfterPx = 600,
  revealAfterPx = 28,
}: Options = {}) {
  const { scrollY } = useScroll()
  const [stage, setStage] = useState<HeaderStage>('visible')
  const [scrolled, setScrolled] = useState(false)

  const lastY = useRef(0)
  const downAccum = useRef(0)
  const upAccum = useRef(0)
  const lastDir = useRef<1 | -1 | 0>(0) // 1=down, -1=up, 0=none

  useEffect(() => {
    // initialize from current value when mounted on client
    lastY.current = scrollY.get()
    setScrolled(lastY.current > 10)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useMotionValueEvent(scrollY, 'change', (latest) => {
    const prev = lastY.current
    const delta = latest - prev

    setScrolled(latest > 10)

    if (Math.abs(delta) < jitter) {
      lastY.current = latest
      return
    }

    // lock behavior until we reach activateAt
    if (latest <= activateAt) {
      setStage('visible')
      downAccum.current = 0
      upAccum.current = 0
      lastDir.current = 0
      lastY.current = latest
      return
    }

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
      // scrolling DOWN
      upAccum.current = 0
      downAccum.current += delta

      if (downAccum.current > hideAfterPx) {
        setStage('hidden')
      } else if (downAccum.current > peekAfterPx) {
        setStage('peek')
      }
    } else {
      // scrolling UP
      downAccum.current = 0
      upAccum.current += -delta

      if (upAccum.current > revealAfterPx) {
        setStage('visible')
      }
    }

    lastY.current = latest
  })

  return { stage, scrolled }
}
