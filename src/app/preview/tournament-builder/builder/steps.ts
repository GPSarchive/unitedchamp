import type { LucideIcon } from "lucide-react";
import { Settings2, Users, Layers, CalendarDays, CheckCircle2 } from "lucide-react";

export type StepId = "basics" | "teams" | "stages" | "fixtures" | "review";

export type StepDef = {
  id: StepId;
  label: string;
  icon: LucideIcon;
};

export const STEPS: StepDef[] = [
  { id: "basics", label: "Στοιχεία", icon: Settings2 },
  { id: "teams", label: "Ομάδες", icon: Users },
  { id: "stages", label: "Στάδια", icon: Layers },
  { id: "fixtures", label: "Αγώνες", icon: CalendarDays },
  { id: "review", label: "Έλεγχος", icon: CheckCircle2 },
];

export const STEP_IDS = STEPS.map((s) => s.id);

export function isStepId(v: string | null | undefined): v is StepId {
  return !!v && (STEP_IDS as string[]).includes(v);
}
