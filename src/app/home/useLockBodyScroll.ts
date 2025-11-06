'use client';

import { useLayoutEffect } from 'react';

export function useLockBodyScroll(active: boolean) {
  useLayoutEffect(() => {
    if (!active) return;

    const scrollY = window.scrollY;
    const { position, top, width, overflowY } = document.body.style;

    // lock
    document.documentElement.style.scrollBehavior = 'auto';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflowY = 'scroll'; // keeps layout stable

    return () => {
      // unlock
      document.body.style.position = position;
      document.body.style.top = top;
      document.body.style.width = width;
      document.body.style.overflowY = overflowY;
      window.scrollTo(0, scrollY);
      document.documentElement.style.scrollBehavior = '';
    };
  }, [active]);
}
