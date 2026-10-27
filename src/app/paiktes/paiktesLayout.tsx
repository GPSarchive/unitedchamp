"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Phone layout for /paiktes, switched on only by the preview route
 * /preview/paiktes-mobile. The live page renders with compact=false and is
 * unchanged until the preview is promoted.
 *
 * compact (below md): search + «Φίλτρα» button with the other filters in a
 * bottom sheet, column header sticking under the navbar, slim letter dividers.
 */
const PaiktesLayoutContext = createContext<{ compact: boolean }>({ compact: false });

export function PaiktesLayoutProvider({
  compact = true,
  children,
}: {
  compact?: boolean;
  children: ReactNode;
}) {
  return <PaiktesLayoutContext.Provider value={{ compact }}>{children}</PaiktesLayoutContext.Provider>;
}

export const usePaiktesLayout = () => useContext(PaiktesLayoutContext);
