"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * Phone layout for the tournament editor, switched on only by the preview
 * route /dashboard/preview/tournaments-mobile. The live editor renders with
 * compact=false and is unchanged until the preview is promoted.
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
