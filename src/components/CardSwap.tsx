// components/CardSwap.tsx
'use client';

import React, {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type HTMLAttributes,
  type CSSProperties,
} from 'react';
import gsap from 'gsap';

/* ───────── Card ───────── */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  customClass?: string;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ customClass, className, children, ...rest }, ref) => (
    <div
      ref={ref}
      {...rest}
      className={`
        absolute top-1/2 left-1/2 overflow-hidden rounded-2xl
        [transform-style:preserve-3d] [will-change:transform] [backface-visibility:hidden]
        cursor-pointer select-none
        ${customClass ?? ''} ${className ?? ''}
      `}
    >
      {children}
    </div>
  )
);
Card.displayName = 'Card';

/* ───────── helpers ───────── */
const makeSlot = (
  i: number,
  distX: number,
  distY: number,
  total: number
) => ({
  x: i * distX,
  y: -i * distY,
  z: -i * distX * 1.5,
  zIndex: total - i,
});

const placeNow = (
  el: HTMLElement,
  slot: ReturnType<typeof makeSlot>,
  skew: number
) =>
  gsap.set(el, {
    x: slot.x,
    y: slot.y,
    z: slot.z,
    xPercent: -50,
    yPercent: -50,
    skewY: skew,
    transformOrigin: 'center center',
    zIndex: slot.zIndex,
    force3D: true,
  });

/* ───────── CardSwap ───────── */
interface CardSwapProps {
  width?: number;
  height?: number;
  cardDistance?: number;
  verticalDistance?: number;
  delay?: number;
  pauseOnHover?: boolean;
  onCardClick?: (index: number) => void;
  skewAmount?: number;
  easing?: 'elastic' | 'smooth';
  containerClassName?: string;
  containerStyle?: CSSProperties;
  children: ReactNode;
}

const CardSwap = ({
  width = 600,
  height = 340,
  cardDistance = 55,
  verticalDistance = 0,
  delay = 5000,
  pauseOnHover = false,
  onCardClick,
  skewAmount = 0,
  easing = 'elastic',
  containerClassName,
  containerStyle,
  children,
}: CardSwapProps) => {
  const autoConfig =
    easing === 'elastic'
      ? {
          ease: 'elastic.out(0.6,0.9)',
          durDrop: 2,
          durMove: 2,
          durReturn: 2,
          promoteOverlap: 0.9,
          returnDelay: 0.05,
        }
      : {
          ease: 'power1.inOut',
          durDrop: 0.8,
          durMove: 0.8,
          durReturn: 0.8,
          promoteOverlap: 0.45,
          returnDelay: 0.2,
        };

  // Snappy config used only for user-initiated clicks
  const clickDur = 0.45;
  const clickEase = 'power3.out';

  const childArr = useMemo(() => Children.toArray(children), [children]);
  const refs = useMemo(
    () => childArr.map(() => React.createRef<HTMLDivElement>()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childArr.length]
  );

  const order = useRef(Array.from({ length: childArr.length }, (_, i) => i));
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);
  const container = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const isAnimatingRef = useRef(false);

  /* ── kill running animation & pending timer ── */
  const cancelCurrent = useCallback(() => {
    clearTimeout(timeoutRef.current);
    if (tlRef.current) {
      tlRef.current.kill();
      tlRef.current = null;
    }
  }, []);

  /* ── schedule next auto-swap ── */
  const scheduleNext = useCallback(
    (fn: () => void) => {
      if (!isPausedRef.current) {
        timeoutRef.current = window.setTimeout(fn, delay);
      }
    },
    [delay]
  );

  /* ── auto-swap: send front card to back ── */
  const autoSwap = useCallback(() => {
    if (order.current.length < 2) return;
    if (isAnimatingRef.current) return;

    const [front, ...rest] = order.current;
    const elFront = refs[front].current;
    if (!elFront) return;

    isAnimatingRef.current = true;

    const tl = gsap.timeline({
      onComplete: () => {
        isAnimatingRef.current = false;
        scheduleNext(autoSwap);
      },
    });
    tlRef.current = tl;

    tl.to(elFront, {
      y: '+=500',
      opacity: 0,
      duration: autoConfig.durDrop,
      ease: autoConfig.ease,
    });

    tl.addLabel('promote', `-=${autoConfig.durDrop * autoConfig.promoteOverlap}`);
    rest.forEach((idx, i) => {
      const el = refs[idx].current;
      if (!el) return;
      const slot = makeSlot(i, cardDistance, verticalDistance, refs.length);
      tl.set(el, { zIndex: slot.zIndex }, 'promote');
      tl.to(
        el,
        {
          x: slot.x,
          y: slot.y,
          z: slot.z,
          duration: autoConfig.durMove,
          ease: autoConfig.ease,
        },
        `promote+=${i * 0.15}`
      );
    });

    const backSlot = makeSlot(
      refs.length - 1,
      cardDistance,
      verticalDistance,
      refs.length
    );
    tl.addLabel('return', `promote+=${autoConfig.durMove * autoConfig.returnDelay}`);
    tl.call(
      () => {
        gsap.set(elFront, { zIndex: backSlot.zIndex });
      },
      [],
      'return'
    );
    tl.to(
      elFront,
      {
        x: backSlot.x,
        y: backSlot.y,
        z: backSlot.z,
        opacity: 1,
        duration: autoConfig.durReturn,
        ease: autoConfig.ease,
      },
      'return'
    );
    tl.call(() => {
      order.current = [...rest, front];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardDistance, verticalDistance, delay, skewAmount, easing]);

  /* ── click-to-select: bring any card to front ── */
  const selectCard = useCallback(
    (clickedOriginalIndex: number) => {
      const currentOrder = order.current;
      const posInOrder = currentOrder.indexOf(clickedOriginalIndex);

      // Already in front or not found
      if (posInOrder <= 0) return;

      // ① Interrupt anything in flight immediately
      cancelCurrent();

      // ② Reset every card's opacity & scale
      refs.forEach((r) => {
        if (r.current) gsap.set(r.current, { opacity: 1, scale: 1 });
      });

      isAnimatingRef.current = true;

      // ③ Build new order: clicked card → front
      const newOrder = [
        clickedOriginalIndex,
        ...currentOrder.filter((idx) => idx !== clickedOriginalIndex),
      ];

      const tl = gsap.timeline({
        onComplete: () => {
          order.current = newOrder;
          isAnimatingRef.current = false;
          scheduleNext(autoSwap);
        },
      });
      tlRef.current = tl;

      // ④ Animate every card to its new slot
      newOrder.forEach((originalIdx, newSlotIndex) => {
        const el = refs[originalIdx].current;
        if (!el) return;

        const slot = makeSlot(
          newSlotIndex,
          cardDistance,
          verticalDistance,
          refs.length
        );

        if (originalIdx === clickedOriginalIndex) {
          // Selected card: quick pop-to-front with subtle scale pulse
          tl.set(el, { zIndex: slot.zIndex }, 0);
          tl.to(
            el,
            {
              x: slot.x,
              y: slot.y,
              z: slot.z,
              scale: 1.04,
              duration: clickDur * 0.55,
              ease: 'power2.out',
            },
            0
          );
          tl.to(
            el,
            {
              scale: 1,
              duration: clickDur * 0.45,
              ease: 'power2.inOut',
            },
            clickDur * 0.55
          );
        } else {
          // Other cards slide into place
          tl.set(el, { zIndex: slot.zIndex }, 0);
          tl.to(
            el,
            {
              x: slot.x,
              y: slot.y,
              z: slot.z,
              duration: clickDur,
              ease: clickEase,
            },
            newSlotIndex * 0.035
          );
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cardDistance, verticalDistance, delay, skewAmount, easing, autoSwap, cancelCurrent, scheduleNext]
  );

  /* ── initial placement + start auto-swap loop ── */
  useEffect(() => {
    const total = refs.length;
    refs.forEach((r, i) => {
      if (r.current)
        placeNow(
          r.current,
          makeSlot(i, cardDistance, verticalDistance, total),
          skewAmount
        );
    });

    timeoutRef.current = window.setTimeout(autoSwap, delay);

    if (pauseOnHover && container.current) {
      const node = container.current;

      const pause = () => {
        isPausedRef.current = true;
        tlRef.current?.pause();
        clearTimeout(timeoutRef.current);
      };

      const resume = () => {
        isPausedRef.current = false;
        if (tlRef.current && tlRef.current.progress() < 1) {
          tlRef.current.play();
        } else {
          timeoutRef.current = window.setTimeout(autoSwap, delay);
        }
      };

      node.addEventListener('mouseenter', pause);
      node.addEventListener('mouseleave', resume);

      return () => {
        node.removeEventListener('mouseenter', pause);
        node.removeEventListener('mouseleave', resume);
        clearTimeout(timeoutRef.current);
        tlRef.current?.kill();
      };
    }

    return () => {
      clearTimeout(timeoutRef.current);
      tlRef.current?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardDistance, verticalDistance, delay, pauseOnHover, skewAmount, easing]);

  /* ── render children with refs + click handlers ── */
  const rendered = childArr.map((child, i) =>
    isValidElement(child)
      ? cloneElement(child as React.ReactElement<any>, {
          key: i,
          ref: refs[i],
          style: {
            width,
            height,
            ...((child as React.ReactElement<any>).props?.style ?? {}),
          },
          onClick: (e: React.MouseEvent) => {
            (child as React.ReactElement<any>).props?.onClick?.(e);
            onCardClick?.(i);
            selectCard(i);
          },
        })
      : child
  );

  /* ── merge computed size with any externally provided styles ── */
  const mergedStyle: CSSProperties = {
    width: width + cardDistance * childArr.length,
    height,
    ...containerStyle,
  };

  return (
    <div
      ref={container}
      className={containerClassName}
      style={mergedStyle}
    >
      {rendered}
    </div>
  );
};

export default CardSwap;