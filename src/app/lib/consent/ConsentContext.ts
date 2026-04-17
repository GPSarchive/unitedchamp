"use client";

import { createContext } from "react";
import type { ConsentState } from "./use-consent";

export type ConsentApi = {
  state: ConsentState;
  ready: boolean;
  accept: (kind: "all" | "essential") => void;
  setAnalytics: (on: boolean) => void;
  reopen: () => void;
};

export const ConsentContext = createContext<ConsentApi | null>(null);
