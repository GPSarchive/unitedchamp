"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Phone layout for the tournament editor, switched on by /dashboard/tournaments
 * (promoted from the preview on 2026-10-27). Without a provider, components
 * fall back to compact=false — the original layout.
 *
 * compact: flatter nesting on phones (wrappers lose side padding/borders
 * below the sm breakpoint) and match cards instead of the wide table.
 */
const EditorLayoutContext = createContext<{ compact: boolean }>({ compact: false });

export function EditorLayoutProvider({
  compact = true,
  children,
}: {
  compact?: boolean;
  children: ReactNode;
}) {
  return <EditorLayoutContext.Provider value={{ compact }}>{children}</EditorLayoutContext.Provider>;
}

export const useEditorLayout = () => useContext(EditorLayoutContext);

/** True below Tailwind's sm breakpoint (640px). False during SSR. */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}
