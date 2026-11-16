// AddPlayerToTeamLauncher.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import AddPlayerToTeamModal from "./AddPlayerToTeamModal"; // ← no .tsx
import { BUTTON_SHAPE } from "@/app/lib/ui/flat";

export default function AddPlayerToTeamLauncher({
  teamId,
  className,
  label = "Add player",
}: {
  teamId: number;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? `inline-flex items-center gap-2 px-3 py-2 ${BUTTON_SHAPE}`}
      >
        <Plus className="w-4 h-4" />
        {label}
      </button>

      <AddPlayerToTeamModal
        open={open}
        teamId={teamId}
        onAdded={() => router.refresh()}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
