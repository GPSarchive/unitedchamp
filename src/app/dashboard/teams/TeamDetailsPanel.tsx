import React, { useState, useEffect } from 'react';
import TeamRowEditor from './TeamRowEditor';
import PlayersPanel from './PlayersPanel';
import { PlayerAssociation } from "@/app/lib/types"; // Import PlayerAssociation type

type Props = {
  teamId: number;
  open: boolean;
  onClose: () => void;
  onSaved: (team: any) => void;
  players: PlayerAssociation[]; // Added players prop
};

export default function TeamDetailsPanel({
  teamId,
  open,
  onClose,
  onSaved,
  players, // Receiving players from parent
}: Props) {
  const [isPanelExpanded, setIsPanelExpanded] = useState(open);

  // Open/close logic
  useEffect(() => {
    setIsPanelExpanded(open);
  }, [open]);

  return (
    <div
      className={`fixed inset-0 z-50 transition-all duration-300 ${
        isPanelExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[520px] bg-zinc-950 border-l border-white/10 shadow-2xl transition-transform ${
          isPanelExpanded ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" title="Close">
            Close
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* TeamRowEditor component */}
          <TeamRowEditor
            initial={{ id: teamId }} // Assuming you fetch the team data by ID
            onCancel={onClose}
            onSaved={onSaved}
          />
          
          {/* PlayersPanel component */}
          <PlayersPanel
            teamId={teamId}
            isLoading={false} // Adjust according to your loading state
            error={null} // Handle errors as needed
            associations={players} // Pass the players here
            onOpenPlayer={(playerId: number) => {}} // Provide explicit type for playerId
          />
        </div>
      </div>
    </div>
  );
}
