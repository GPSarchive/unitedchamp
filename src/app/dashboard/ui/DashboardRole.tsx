// src/app/dashboard/ui/DashboardRole.tsx
// Lets any dashboard client component ask "is this an admin?" without the
// role being threaded through every prop list. The value is set once by
// ClientShell from the server-verified roles; it only decides what to SHOW —
// every write is re-checked by its API route.
"use client";

import { createContext, useContext } from "react";

const DashboardRoleContext = createContext<{ isAdmin: boolean }>({ isAdmin: false });

export function DashboardRoleProvider({
  isAdmin,
  children,
}: { isAdmin: boolean; children: React.ReactNode }) {
  return (
    <DashboardRoleContext.Provider value={{ isAdmin }}>{children}</DashboardRoleContext.Provider>
  );
}

/** True for admins; false for editor-only accounts. */
export function useIsAdmin(): boolean {
  return useContext(DashboardRoleContext).isAdmin;
}
