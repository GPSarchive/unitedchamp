// Which components draw each skin's card: the big shield card and the mini
// card of a list row. Keyed by the skin keys in ./skins.ts — TypeScript
// refuses to build until every skin listed there has its cards here.
//
// The cards still live in the preview folders where they are designed;
// «Θρύλος» is version 1 (the owner's choice over version 3, 2026-11-15);
// the other four are the v1 editions shown on /preview/special-cards/editions.
// Switching a version = changing that skin's two imports.
"use client";

import type { ComponentType } from "react";
import type { DirectoryTeam, StatTuple } from "@/app/preview/paiktes-v2/model";
import LegendMiniCard from "@/app/preview/special-cards/legend/v1/LegendMiniCard";
import LegendShieldCard from "@/app/preview/special-cards/legend/v1/LegendShieldCard";
import TotyMiniCard from "@/app/preview/special-cards/toty/v1/TotyMiniCard";
import TotyShieldCard from "@/app/preview/special-cards/toty/v1/TotyShieldCard";
import TotwMiniCard from "@/app/preview/special-cards/totw/v1/TotwMiniCard";
import TotwShieldCard from "@/app/preview/special-cards/totw/v1/TotwShieldCard";
import HeroMiniCard from "@/app/preview/special-cards/heroes/v1/HeroMiniCard";
import HeroShieldCard from "@/app/preview/special-cards/heroes/v1/HeroShieldCard";
import ProMiniCard from "@/app/preview/special-cards/pro-players/v1/ProMiniCard";
import ProShieldCard from "@/app/preview/special-cards/pro-players/v1/ProShieldCard";
import type { SkinKey } from "./skins";

export type BigCardProps = {
  first: string;
  last: string;
  photo: string | null;
  team: DirectoryTeam | null;
  stats: StatTuple | null;
  intro?: boolean;
};

export type MiniCardProps = {
  photo: string | null;
  logo: string | null;
  initial: string;
};

export const SKIN_CARDS: Record<SkinKey, { Big: ComponentType<BigCardProps>; Mini: ComponentType<MiniCardProps> }> = {
  legend: { Big: LegendShieldCard, Mini: LegendMiniCard },
  toty: { Big: TotyShieldCard, Mini: TotyMiniCard },
  totw: { Big: TotwShieldCard, Mini: TotwMiniCard },
  hero: { Big: HeroShieldCard, Mini: HeroMiniCard },
  pro: { Big: ProShieldCard, Mini: ProMiniCard },
};
