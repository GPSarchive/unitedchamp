"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Save, X, AlertCircle, RotateCcw, Award } from "lucide-react";
import { useTournamentStore } from "../submit/tournamentStore";
import type { DraftMatch } from "../TournamentWizard";
import type { TeamDraft } from "../TournamentWizard";
import { saveMatchStatsAction, revertMatchToScheduledAction, awardForfeitWinAction } from "./actions";

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Types
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

   type PlayerStatRow = {
    player_id: number;
    first_name: string;
    last_name: string;
    played: boolean;
    position: string;
    is_captain: boolean;
    gk: boolean;
    goals: number;
    assists: number;
    own_goals: number;
    yellow_cards: number;
    red_cards: number;
    blue_cards: number;
  };
  
  type MatchControlPanelProps = {
    match: DraftMatch;
    teams: TeamDraft[];
    onClose: () => void;
    onSave?: () => void;
  };
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Utilities
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  
  function matchSig(m: DraftMatch): string {
    const isKO = m.round != null && m.bracket_pos != null;
    if (isKO) {
      return `KO|S${m.stageIdx ?? -1}|R${m.round ?? 0}|B${m.bracket_pos ?? 0}`;
    }
    const pairA = Math.min(m.team_a_id ?? 0, m.team_b_id ?? 0);
    const pairB = Math.max(m.team_a_id ?? 0, m.team_b_id ?? 0);
    return `RR|S${m.stageIdx ?? -1}|G${m.groupIdx ?? -1}|MD${m.matchday ?? 0}|${pairA}-${pairB}`;
  }
  
  function isoToLocalInput(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
  
  function localInputToISO(localStr?: string) {
    if (!localStr) return null;
    const m = localStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!m) return null;
    const [, yStr, moStr, dStr, hhStr, mmStr] = m;
    return new Date(Date.UTC(+yStr, +moStr - 1, +dStr, +hhStr, +mmStr, 0, 0)).toISOString();
  }
  
  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     Main Component
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  
  export default function MatchControlPanel({
    match,
    teams,
    onClose,
    onSave,
  }: MatchControlPanelProps) {
  
    // Store hooks
    const updateMatches = useTournamentStore(s => s.updateMatches);
    const dbOverlayBySig = useTournamentStore(s => s.dbOverlayBySig);
    const getTeamName = useTournamentStore(s => s.getTeamName);
  
    // Get DB overlay for this match
    const sig = matchSig(match);
    const overlay = dbOverlayBySig[sig] || {};
    const dbId = overlay.db_id || (match as any).db_id;
  
    // Track actual DB status (not just dropdown selection)
    const dbStatus = overlay.status as "scheduled" | "finished" | undefined;
  
    // Merged match data (draft + DB overlay)
    const mergedMatch = useMemo(() => ({ ...match, ...overlay }), [match, overlay]);
  
    // Local form state
    const [formData, setFormData] = useState({
      team_a_id: match.team_a_id ?? null,
      team_b_id: match.team_b_id ?? null,
      match_date: isoToLocalInput(match.match_date),
      field: (match as any).field ?? "",
      venue: (match as any).venue ?? "",
    });
  
    // Manual status override
    const [manualStatus, setManualStatus] = useState<"scheduled" | "finished">("scheduled");
  
    // Player stats state
    const [teamAPlayers, setTeamAPlayers] = useState<PlayerStatRow[]>([]);
    const [teamBPlayers, setTeamBPlayers] = useState<PlayerStatRow[]>([]);
    const [loadingPlayers, setLoadingPlayers] = useState(true);
    const [mvpPlayerId, setMvpPlayerId] = useState<number | null>(null);
    const [bestGkPlayerId, setBestGkPlayerId] = useState<number | null>(null);
  
    // Collapsible sections
    const [showMetadata, setShowMetadata] = useState(true);
    const [showTeamA, setShowTeamA] = useState(true);
    const [showTeamB, setShowTeamB] = useState(true);
  
    // Save state
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
  
    // Revert state
    const [reverting, setReverting] = useState(false);
    const [revertError, setRevertError] = useState<string | null>(null);
  
    // Forfeit state
    const [awarding, setAwarding] = useState(false);
    const [awardError, setAwardError] = useState<string | null>(null);

    // Ref to track if status has been initialized
    const hasInitialized = useRef(false);
  
    // Initialize manual status from DB overlay or auto-calculate (only once)
    useEffect(() => {
      // Only auto-set status on initial load
      if (hasInitialized.current) return;
      
      if (overlay.status) {
        setManualStatus(overlay.status as "scheduled" | "finished");
      } else {
        // Set initial status based on participants
        const hasParticipants = teamAPlayers.some(p => p.played) || teamBPlayers.some(p => p.played);
        setManualStatus(hasParticipants ? "finished" : "scheduled");
      }
      
      hasInitialized.current = true;
    }, [overlay.status, teamAPlayers, teamBPlayers]);
  
    // Fetch data on mount
    useEffect(() => {
      if (!formData.team_a_id || !formData.team_b_id) {
        setLoadingPlayers(false);
        return;
      }
  
      setLoadingPlayers(true);
  
      async function loadData() {
        try {
          // Fetch team rosters
          const [resA, resB] = await Promise.all([
            fetch(`/api/teams/${formData.team_a_id}/players`),
            fetch(`/api/teams/${formData.team_b_id}/players`),
          ]);
  
          if (!resA.ok || !resB.ok) {
            throw new Error("Failed to load players");
          }
  
          const dataA = await resA.json();
          const dataB = await resB.json();
  
          // Extract players from API response
          const playersA = (dataA.playerAssociations || []).map((assoc: any) => assoc.player);
          const playersB = (dataB.playerAssociations || []).map((assoc: any) => assoc.player);
  
          // Fetch existing match stats if match exists in DB
          let existingStats: Record<number, any> = {};
          if (dbId && dbId > 0) {
            const statsRes = await fetch(`/api/matches/${dbId}/stats`);
            if (statsRes.ok) {
              const statsData = await statsRes.json();
              existingStats = statsData.stats || {};
  
              // Find MVP and Best GK
              const mvp = Object.entries(existingStats).find(([, stat]: [string, any]) => stat.mvp);
              const bestGk = Object.entries(existingStats).find(([, stat]: [string, any]) => stat.best_goalkeeper);
              if (mvp) setMvpPlayerId(Number(mvp[0]));
              if (bestGk) setBestGkPlayerId(Number(bestGk[0]));
            }
          }
  
          // Map players to stat rows with existing data
          const mapPlayers = (players: any[], teamId: number) => {
            return players.map((p: any) => {
              const stat = existingStats[p.id] || {};
              return {
                player_id: p.id,
                first_name: p.first_name || "",
                last_name: p.last_name || "",
                played: stat.played || false,
                position: stat.position || "",
                is_captain: stat.is_captain || false,
                gk: stat.gk || false,
                goals: stat.goals || 0,
                assists: stat.assists || 0,
                own_goals: stat.own_goals || 0,
                yellow_cards: stat.yellow_cards || 0,
                red_cards: stat.red_cards || 0,
                blue_cards: stat.blue_cards || 0,
              };
            });
          };
  
          setTeamAPlayers(mapPlayers(playersA, formData.team_a_id!));
          setTeamBPlayers(mapPlayers(playersB, formData.team_b_id!));
  
        } catch (err) {
          console.error("Failed to load match data:", err);
        } finally {
          setLoadingPlayers(false);
        }
      }
  
      loadData();
    }, []); // Only run on mount
  
    // Team options
    const teamOptions = useMemo(() => {
      return teams.map(t => ({
        id: t.id,
        name: t.name || getTeamName(t.id),
        logo: t.logo || null,
      }));
    }, [teams, getTeamName]);
  
    // Get team names
    const teamAName = teamOptions.find(t => t.id === formData.team_a_id)?.name || "Team A";
    const teamBName = teamOptions.find(t => t.id === formData.team_b_id)?.name || "Team B";
  
    // Calculate scores from player stats
    const calculatedScores = useMemo(() => {
      const aGoals = teamAPlayers.filter(p => p.played).reduce((sum, p) => sum + p.goals, 0);
      const aOwnGoals = teamAPlayers.filter(p => p.played).reduce((sum, p) => sum + p.own_goals, 0);
      const bGoals = teamBPlayers.filter(p => p.played).reduce((sum, p) => sum + p.goals, 0);
      const bOwnGoals = teamBPlayers.filter(p => p.played).reduce((sum, p) => sum + p.own_goals, 0);
  
      return {
        team_a_score: aGoals + bOwnGoals,
        team_b_score: bGoals + aOwnGoals,
      };
    }, [teamAPlayers, teamBPlayers]);
  
    // Auto-determine winner
    const autoWinner = useMemo(() => {
      const { team_a_score, team_b_score } = calculatedScores;
      if (team_a_score > team_b_score) return formData.team_a_id;
      if (team_b_score > team_a_score) return formData.team_b_id;
      return null;
    }, [calculatedScores, formData.team_a_id, formData.team_b_id]);
  
    // Effective status is always the manual status (user controlled)
    const effectiveStatus = manualStatus;
  
    // Update player stat
    const updatePlayerStat = (teamId: number, playerId: number, field: keyof PlayerStatRow, value: any) => {
      const setter = teamId === formData.team_a_id ? setTeamAPlayers : setTeamBPlayers;
      setter(prev => prev.map(p => p.player_id === playerId ? { ...p, [field]: value } : p));
    };
  
    // Handle save
    const handleSave = async () => {
      if (!dbId || dbId <= 0) {
        setSaveError("Match must be saved to database first (no db_id found)");
        return;
      }
  
      if (!formData.team_a_id || !formData.team_b_id) {
        setSaveError("Both teams must be selected");
        return;
      }
  
      setSaving(true);
      setSaveError(null);
  
      try {
        const result = await saveMatchStatsAction({
          matchId: dbId,
          teamAStats: teamAPlayers.map(p => ({
            player_id: p.player_id,
            team_id: formData.team_a_id!,
            played: p.played,
            position: p.position,
            is_captain: p.is_captain,
            gk: p.gk,
            goals: p.goals,
            assists: p.assists,
            own_goals: p.own_goals,
            yellow_cards: p.yellow_cards,
            red_cards: p.red_cards,
            blue_cards: p.blue_cards,
          })),
          teamBStats: teamBPlayers.map(p => ({
            player_id: p.player_id,
            team_id: formData.team_b_id!,
            played: p.played,
            position: p.position,
            is_captain: p.is_captain,
            gk: p.gk,
            goals: p.goals,
            assists: p.assists,
            own_goals: p.own_goals,
            yellow_cards: p.yellow_cards,
            red_cards: p.red_cards,
            blue_cards: p.blue_cards,
          })),
          mvpPlayerId,
          bestGkPlayerId,
          matchData: {
            match_date: localInputToISO(formData.match_date),
            field: formData.field || null,
            venue: formData.venue || null,
          },
          manualStatus: manualStatus, // Always pass manual status
        });
  
        if (!result.success) {
          setSaveError(result.error || "Failed to save match");
          return;
        }
  
        // Update overlay to reflect new scores/status (progression already ran)
        const nextOverlay = { ...dbOverlayBySig };
        nextOverlay[sig] = {
          ...nextOverlay[sig],
          team_a_score: calculatedScores.team_a_score,
          team_b_score: calculatedScores.team_b_score,
          winner_team_id: autoWinner,
          status: effectiveStatus,
        };
        useTournamentStore.setState({ dbOverlayBySig: nextOverlay });
  
        onSave?.();
        onClose();
  
      } catch (error) {
        console.error("Save error:", error);
        setSaveError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setSaving(false);
      }
    };
  
    // Handle revert to scheduled
    const handleRevert = async () => {
      if (!dbId || dbId <= 0) {
        setRevertError("Match must be saved to database first (no db_id found)");
        return;
      }
  
      const confirmed = confirm(
        "Are you sure you want to revert this match to scheduled status?\n\n" +
        "This will:\n" +
        "• Delete all player stats\n" +
        "• Delete all participation records\n" +
        "• Reset scores to 0-0\n" +
        "• Recalculate tournament standings\n\n" +
        "This action cannot be undone."
      );
  
      if (!confirmed) return;
  
      setReverting(true);
      setRevertError(null);
  
      try {
        const result = await revertMatchToScheduledAction(dbId);
  
        if (!result.success) {
          setRevertError(result.error || "Failed to revert match");
          return;
        }
  
        // Update overlay to reflect reverted status
        const nextOverlay = { ...dbOverlayBySig };
        nextOverlay[sig] = {
          ...nextOverlay[sig],
          team_a_score: null,
          team_b_score: null,
          winner_team_id: null,
          status: "scheduled",
        };
        useTournamentStore.setState({ dbOverlayBySig: nextOverlay });
  
        // Clear local state
        setTeamAPlayers(prev => prev.map(p => ({
          ...p,
          played: false,
          goals: 0,
          assists: 0,
          own_goals: 0,
          yellow_cards: 0,
          red_cards: 0,
          blue_cards: 0,
          is_captain: false,
          gk: false,
          position: "",
        })));
        setTeamBPlayers(prev => prev.map(p => ({
          ...p,
          played: false,
          goals: 0,
          assists: 0,
          own_goals: 0,
          yellow_cards: 0,
          red_cards: 0,
          blue_cards: 0,
          is_captain: false,
          gk: false,
          position: "",
        })));
        setMvpPlayerId(null);
        setBestGkPlayerId(null);
        setManualStatus("scheduled"); // Reset to scheduled
  
        onSave?.();
        onClose();
  
      } catch (error) {
        console.error("Revert error:", error);
        setRevertError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setReverting(false);
      }
    };
  
    // Handle forfeit win (3-0)
    const handleAwardForfeit = async (winningTeam: 'A' | 'B') => {
      if (!dbId || dbId <= 0) {
        setAwardError("Match must be saved to database first (no db_id found)");
        return;
      }
  
      if (!formData.team_a_id || !formData.team_b_id) {
        setAwardError("Both teams must be selected");
        return;
      }
  
      const teamName = winningTeam === 'A' ? teamAName : teamBName;
      const confirmed = confirm(
        `Award 3-0 forfeit win to ${teamName}?\n\n` +
        `This will:\n` +
        `• Set the score to ${winningTeam === 'A' ? '3-0' : '0-3'}\n` +
        `• Mark the match as finished\n` +
        `• Trigger tournament progression\n` +
        `• No player stats will be recorded`
      );
  
      if (!confirmed) return;
  
      setAwarding(true);
      setAwardError(null);
  
      try {
        const result = await awardForfeitWinAction(dbId, winningTeam);
  
        if (!result.success) {
          setAwardError(result.error || "Failed to award forfeit win");
          return;
        }
  
        // Update overlay to reflect new scores/status
        const nextOverlay = { ...dbOverlayBySig };
        nextOverlay[sig] = {
          ...nextOverlay[sig],
          team_a_score: result.team_a_score,
          team_b_score: result.team_b_score,
          winner_team_id: winningTeam === 'A' ? formData.team_a_id : formData.team_b_id,
          status: "finished",
        };
        useTournamentStore.setState({ dbOverlayBySig: nextOverlay });
  
        onSave?.();
        onClose();
  
      } catch (error) {
        console.error("Award forfeit error:", error);
        setAwardError(error instanceof Error ? error.message : "Unknown error");
      } finally {
        setAwarding(false);
      }
    };
  
    // Render player stats table
    const renderPlayerTable = (teamPlayers: PlayerStatRow[], teamId: number, teamName: string) => {
      if (loadingPlayers) {
        return (
          <div className="py-8 text-center text-white/50">
            Φόρτωση παικτών...
          </div>
        );
      }
  
      if (teamPlayers.length === 0) {
        return (
          <div className="py-8 text-center text-white/50">
            Δεν βρέθηκαν παίκτες για την ομάδα {teamName}
          </div>
        );
      }
  
      return (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-zinc-800/50 text-white/80">
              <tr>
                <th className="px-2 py-2 text-left" title="Επιλέξτε αν ο παίκτης έπαιξε">Έπαιξε</th>
                <th className="px-2 py-2 text-left">Παίκτης</th>
                <th className="px-2 py-2 text-left" title="Θέση παίκτη">Θέση</th>
                <th className="px-2 py-2 text-center" title="Αρχηγός">Αρχ</th>
                <th className="px-2 py-2 text-center" title="Τερματοφύλακας">ΤΦ</th>
                <th className="px-2 py-2 text-center" title="Γκολ">Γκολ</th>
                <th className="px-2 py-2 text-center" title="Ασίστ">Ασίστ</th>
                <th className="px-2 py-2 text-center" title="Αυτογκόλ">Αυτογκ.</th>
                <th className="px-2 py-2 text-center" title="Κίτρινες Κάρτες">ΚΚ</th>
                <th className="px-2 py-2 text-center" title="Κόκκινες Κάρτες">ΚοΚ</th>
                <th className="px-2 py-2 text-center" title="Μπλε Κάρτες">ΜΚ</th>
                <th className="px-2 py-2 text-center" title="MVP αγώνα">MVP</th>
                <th className="px-2 py-2 text-center" title="Καλύτερος Τερματοφύλακας">Καλ. ΤΦ</th>
              </tr>
            </thead>
            <tbody>
              {teamPlayers.map(player => {
                // Fields editable only when status is finished AND player is marked as played
                const isEditable = effectiveStatus === 'finished' && player.played;
                // Participation checkbox editable only when status is finished
                const canToggleParticipation = effectiveStatus === 'finished';
  
                return (
                  <tr key={player.player_id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={player.played}
                        onChange={(e) => updatePlayerStat(teamId, player.player_id, 'played', e.target.checked)}
                        disabled={!canToggleParticipation}
                        className="rounded border-white/20 bg-zinc-900 text-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2 text-white">
                      {player.first_name} {player.last_name}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={player.position}
                        onChange={(e) => updatePlayerStat(teamId, player.player_id, 'position', e.target.value)}
                        disabled={!isEditable}
                        className="w-16 rounded border border-white/10 bg-zinc-900 px-1 py-0.5 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="Pos"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={player.is_captain}
                        onChange={(e) => updatePlayerStat(teamId, player.player_id, 'is_captain', e.target.checked)}
                        disabled={!isEditable}
                        className="rounded border-white/20 bg-zinc-900 text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={player.gk}
                        onChange={(e) => updatePlayerStat(teamId, player.player_id, 'gk', e.target.checked)}
                        disabled={!isEditable}
                        className="rounded border-white/20 bg-zinc-900 text-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        value={player.goals}
                        onChange={(e) => updatePlayerStat(teamId, player.player_id, 'goals', Number(e.target.value) || 0)}
                        disabled={!isEditable}
                        className="w-12 rounded border border-white/10 bg-zinc-900 px-1 py-0.5 text-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        value={player.assists}
                        onChange={(e) => updatePlayerStat(teamId, player.player_id, 'assists', Number(e.target.value) || 0)}
                        disabled={!isEditable}
                        className="w-12 rounded border border-white/10 bg-zinc-900 px-1 py-0.5 text-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        value={player.own_goals}
                        onChange={(e) => updatePlayerStat(teamId, player.player_id, 'own_goals', Number(e.target.value) || 0)}
                        disabled={!isEditable}
                        className="w-12 rounded border border-white/10 bg-zinc-900 px-1 py-0.5 text-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        value={player.yellow_cards}
                        onChange={(e) => updatePlayerStat(teamId, player.player_id, 'yellow_cards', Number(e.target.value) || 0)}
                        disabled={!isEditable}
                        className="w-12 rounded border border-white/10 bg-zinc-900 px-1 py-0.5 text-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        value={player.red_cards}
                        onChange={(e) => updatePlayerStat(teamId, player.player_id, 'red_cards', Number(e.target.value) || 0)}
                        disabled={!isEditable}
                        className="w-12 rounded border border-white/10 bg-zinc-900 px-1 py-0.5 text-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min="0"
                        value={player.blue_cards}
                        onChange={(e) => updatePlayerStat(teamId, player.player_id, 'blue_cards', Number(e.target.value) || 0)}
                        disabled={!isEditable}
                        className="w-12 rounded border border-white/10 bg-zinc-900 px-1 py-0.5 text-center text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="radio"
                        name="mvp"
                        checked={mvpPlayerId === player.player_id}
                        onChange={() => setMvpPlayerId(player.player_id)}
                        disabled={!isEditable}
                        className="border-white/20 bg-zinc-900 text-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="radio"
                        name="best_gk"
                        checked={bestGkPlayerId === player.player_id}
                        onChange={() => setBestGkPlayerId(player.player_id)}
                        disabled={!isEditable}
                        className="border-white/20 bg-zinc-900 text-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    };
  
    return (
      <div className="space-y-3 rounded-lg border border-white/20 bg-zinc-900/50 p-4">
        {/* Header with Close button */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">Πίνακας Ελέγχου Αγώνα</h3>
            <div className="group relative">
              <AlertCircle className="h-4 w-4 text-white/50 hover:text-white/80 cursor-help" />
              <div className="absolute left-0 top-6 z-50 hidden w-80 rounded-lg border border-white/20 bg-zinc-900 p-3 text-xs text-white shadow-xl group-hover:block">
                <p className="font-semibold mb-2">Οδηγίες Χρήσης:</p>
                <ul className="space-y-1 list-disc list-inside text-white/80">
                  <li>Για νέο αγώνα: Ορίστε κατάσταση "Ολοκληρωμένο", επιλέξτε παίκτες που έπαιξαν, συμπληρώστε στατιστικά</li>
                  <li>Για ήττα/bye: Χρησιμοποιήστε τα κουμπιά "Απονομή 3-0" (εμφανίζονται μόνο αν ο αγώνας δεν είναι αποθηκευμένος ως ολοκληρωμένος)</li>
                  <li>Για διόρθωση ολοκληρωμένου αγώνα: Πατήστε το κουμπί επαναφοράς (↻) για να διαγράψετε τα στατιστικά και να επιστρέψετε στην αρχική κατάσταση</li>
                  <li>Μην επιλέξετε "Προγραμματισμένο" από τη λίστα - μπορεί να προκαλέσει σφάλματα</li>
                  <li>Μετά από κάθε αλλαγή, πατήστε "Αποθήκευση Αγώνα"</li>
                </ul>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
            title="Κλείσιμο"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
  
        {/* Metadata Section */}
        <div className="rounded-lg border border-white/10 bg-zinc-950/50">
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="flex w-full items-center justify-between px-4 py-3 text-white hover:bg-white/5"
          >
            <span className="font-medium">Λεπτομέρειες Αγώνα</span>
            {showMetadata ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showMetadata && (
            <div className="space-y-3 border-t border-white/10 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70">Ομάδα A</label>
                  <div className="text-white">{teamAName}</div>
                </div>
                <div>
                  <label className="block text-sm text-white/70">Ομάδα B</label>
                  <div className="text-white">{teamBName}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70">Σκορ</label>
                  <div className="text-xl font-bold text-white">
                    {calculatedScores.team_a_score} - {calculatedScores.team_b_score}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/70 mb-1">Κατάσταση</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={manualStatus}
                      onChange={(e) => {
                        setManualStatus(e.target.value as "scheduled" | "finished");
                      }}
                      className="flex-1 rounded border border-white/10 bg-zinc-900 px-2 py-1 text-sm text-white"
                      title="Επιλέξτε την κατάσταση του αγώνα"
                    >
                      <option value="scheduled" disabled>Προγραμματισμένο (μην επιλέξετε)</option>
                      <option value="finished">Ολοκληρωμένο</option>
                    </select>
                    {dbStatus === 'finished' && (
                      <button
                        onClick={handleRevert}
                        disabled={reverting || saving || awarding || !dbId}
                        className="flex items-center gap-1 rounded border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs text-orange-300 hover:bg-orange-500/20 disabled:opacity-50"
                        title="Επαναφορά στο προγραμματισμένο - διαγράφει όλα τα στατιστικά"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-white/70">Ημερομηνία Αγώνα (UTC)</label>
                  <input
                    type="datetime-local"
                    value={formData.match_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, match_date: e.target.value }))}
                    className="w-full rounded border border-white/10 bg-zinc-900 px-3 py-2 text-white"
                    title="Επιλέξτε ημερομηνία και ώρα αγώνα"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/70">Γήπεδο</label>
                  <input
                    type="text"
                    value={formData.field}
                    onChange={(e) => setFormData(prev => ({ ...prev, field: e.target.value }))}
                    className="w-full rounded border border-white/10 bg-zinc-900 px-3 py-2 text-white"
                    placeholder="Όνομα γηπέδου"
                    title="Εισάγετε το όνομα του γηπέδου"
                  />
                </div>
              </div>
  
              {/* Forfeit/Bye Quick Actions - only show when NOT saved as finished in DB */}
              {dbStatus !== 'finished' && (
                <div className="border-t border-white/10 pt-3">
                  <label className="block text-sm text-white/70 mb-2">Γρήγορες Ενέργειες (Ήττα/Bye)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleAwardForfeit('A')}
                      disabled={awarding || saving || reverting || !dbId}
                      className="flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
                      title="Απονομή νίκης 3-0 λόγω ήττας αντιπάλου"
                    >
                      <Award className="h-4 w-4" />
                      Απονομή 3-0 στην {teamAName}
                    </button>
                    <button
                      onClick={() => handleAwardForfeit('B')}
                      disabled={awarding || saving || reverting || !dbId}
                      className="flex items-center justify-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
                      title="Απονομή νίκης 3-0 λόγω ήττας αντιπάλου"
                    >
                      <Award className="h-4 w-4" />
                      Απονομή 3-0 στην {teamBName}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-white/50">
                    Χρησιμοποιήστε για ήττες ή byes. Αυτό θα ολοκληρώσει τον αγώνα με σκορ 3-0 χωρίς να απαιτούνται στατιστικά παικτών.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
  
        {/* Team A Players */}
        <div className="rounded-lg border border-white/10 bg-zinc-950/50">
          <button
            onClick={() => setShowTeamA(!showTeamA)}
            className="flex w-full items-center justify-between px-4 py-3 text-white hover:bg-white/5"
            title="Στατιστικά παικτών της ομάδας"
          >
            <span className="font-medium">{teamAName} - Στατιστικά Παικτών</span>
            {showTeamA ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showTeamA && (
            <div className="border-t border-white/10 p-4">
              {renderPlayerTable(teamAPlayers, formData.team_a_id!, teamAName)}
            </div>
          )}
        </div>
  
        {/* Team B Players */}
        <div className="rounded-lg border border-white/10 bg-zinc-950/50">
          <button
            onClick={() => setShowTeamB(!showTeamB)}
            className="flex w-full items-center justify-between px-4 py-3 text-white hover:bg-white/5"
            title="Στατιστικά παικτών της ομάδας"
          >
            <span className="font-medium">{teamBName} - Στατιστικά Παικτών</span>
            {showTeamB ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showTeamB && (
            <div className="border-t border-white/10 p-4">
              {renderPlayerTable(teamBPlayers, formData.team_b_id!, teamBName)}
            </div>
          )}
        </div>
  
        {/* Actions */}
        <div className="space-y-2">
          {saveError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{saveError}</p>
            </div>
          )}
  
          {revertError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{revertError}</p>
            </div>
          )}
  
          {awardError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{awardError}</p>
            </div>
          )}
  
          <div className="flex justify-end gap-2 border-t border-white/10 pt-3">
            <button
              onClick={onClose}
              disabled={saving || reverting || awarding}
              className="rounded-lg border border-white/20 px-4 py-2 text-white hover:bg-white/10 disabled:opacity-50"
              title="Κλείσιμο χωρίς αποθήκευση"
            >
              Ακύρωση
            </button>
            <button
              onClick={handleSave}
              disabled={saving || reverting || awarding || !dbId}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50"
              title="Αποθήκευση όλων των αλλαγών στον αγώνα"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση Αγώνα'}
            </button>
          </div>
        </div>
      </div>
    );
  }