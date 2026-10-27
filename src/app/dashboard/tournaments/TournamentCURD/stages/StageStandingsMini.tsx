"use client";

import * as React from "react";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";
import { useEditorLayout } from "../editorLayout";
import { applyPointAdjustmentAction } from "./actions";

type Kind = "league" | "groups";

type StandingRow = {
  stage_id: number;
  group_id?: number | null;
  team_id: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd?: number;   // optional in DB; we'll derive if missing
  points: number;
  rank?: number | null;
};

type PointAdjustmentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  teamId: number;
  teamName: string;
  currentPoints: number;
  stageId: number;
  groupId: number | null;
  onSuccess: () => void;
};

function PointAdjustmentModal({
  isOpen,
  onClose,
  teamId,
  teamName,
  currentPoints,
  stageId,
  groupId,
  onSuccess,
}: PointAdjustmentModalProps) {
  const [adjustment, setAdjustment] = React.useState<string>("");
  const [reason, setReason] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [debugLogs, setDebugLogs] = React.useState<string[]>([]);

  const addLog = (message: string) => {
    setDebugLogs(prev => [...prev, `[${new Date().toLocaleTimeString('el-GR')}] ${message}`]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDebugLogs([]);

    const pointsAdjustment = parseInt(adjustment);
    if (isNaN(pointsAdjustment) || pointsAdjustment === 0) {
      setError("Παρακαλώ εισάγετε έγκυρο αριθμό βαθμών (θετικό ή αρνητικό)");
      return;
    }

    if (!reason.trim()) {
      setError("Παρακαλώ εισάγετε αιτιολογία");
      return;
    }

    setIsSubmitting(true);
    addLog(`📝 Αποστολή αίτησης προσαρμογής βαθμών...`);
    addLog(`   Ομάδα: ${teamName} (ID: ${teamId})`);
    addLog(`   Στάδιο: ${stageId}, Όμιλος: ${groupId ?? 'League'}`);
    addLog(`   Προσαρμογή: ${pointsAdjustment > 0 ? '+' : ''}${pointsAdjustment} βαθμοί`);

    try {
      addLog(`🔐 Έλεγχος δικαιωμάτων διαχειριστή...`);

      const result = await applyPointAdjustmentAction({
        stageId,
        groupId,
        teamId,
        pointsAdjustment,
        reason: reason.trim(),
      });

      if (result.success) {
        addLog(`✅ Επιτυχία!`);
        addLog(`   Προηγούμενοι βαθμοί: ${result.previousPoints ?? 0}`);
        addLog(`   Νέοι βαθμοί: ${result.newPoints ?? 0}`);
        const adjustment = result.adjustment ?? pointsAdjustment;
        addLog(`   Μεταβολή: ${adjustment > 0 ? '+' : ''}${adjustment}`);

        setTimeout(() => {
          onSuccess();
          onClose();
          setAdjustment("");
          setReason("");
          setDebugLogs([]);
        }, 2000);
      } else {
        addLog(`❌ Αποτυχία: ${result.error}`);
        setError(result.error || "Αποτυχία εφαρμογής προσαρμογής βαθμών");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Άγνωστο σφάλμα";
      addLog(`❌ Εξαίρεση: ${errorMsg}`);
      setError(`Παρουσιάστηκε σφάλμα: ${errorMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const newPoints = currentPoints + (parseInt(adjustment) || 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-slate-900 rounded-lg border border-white/20 p-6 max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-white mb-4">Προσαρμογή Βαθμών</h2>
        <div className="text-sm text-white/70 mb-4">
          <div className="mb-2">Ομάδα: <span className="text-white font-medium">{teamName}</span></div>
          <div>Τρέχοντες Βαθμοί: <span className="text-white font-medium">{currentPoints}</span></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-white/80 mb-2">
              Προσαρμογή Βαθμών (αρνητικός για αφαίρεση)
            </label>
            <input
              type="number"
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              placeholder="π.χ. -3 ή +2"
              className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded text-white focus:outline-none focus:border-blue-500"
              disabled={isSubmitting}
              autoFocus
            />
            {adjustment && (
              <div className="mt-2 text-sm">
                Νέοι Βαθμοί: <span className={`font-semibold ${newPoints < currentPoints ? 'text-red-400' : 'text-green-400'}`}>
                  {Math.max(0, newPoints)}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-white/80 mb-2">
              Αιτιολογία
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="π.χ. Πειθαρχική ποινή για ανάρμοστη συμπεριφορά"
              rows={3}
              className="w-full px-3 py-2 bg-slate-800 border border-white/20 rounded text-white focus:outline-none focus:border-blue-500 resize-none"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-950/30 border border-red-500/20 rounded px-3 py-2">
              {error}
            </div>
          )}

          {debugLogs.length > 0 && (
            <div className="bg-slate-950/50 border border-blue-500/20 rounded p-3 max-h-48 overflow-y-auto">
              <div className="text-xs text-blue-400 font-semibold mb-2">Αρχείο Καταγραφής:</div>
              <div className="text-xs text-white/80 font-mono space-y-1">
                {debugLogs.map((log, idx) => (
                  <div key={idx} className="whitespace-pre-wrap">{log}</div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-white/70 hover:text-white border border-white/20 rounded hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Ακύρωση
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
            >
              {isSubmitting ? "Εφαρμογή..." : "Εφαρμογή Προσαρμογής"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StageStandingsMini({
  stageIdx,
  kind,
  showLogos = true,
  stageIdOverride, // ← NEW
}: {
  stageIdx: number;
  kind: Kind;
  /** if your store can resolve team logos, leave true; otherwise set false where you use it */
  showLogos?: boolean;
  /** Explicit DB stage id to use (preferred if provided) */
  stageIdOverride?: number;
}) {
  // store slices
  const standings = useTournamentStore((s) => s.entities.standings) as StandingRow[] | undefined;
  const stageIdByIndex = useTournamentStore((s) => s.ids.stageIdByIndex);
  const groupIdByStage = useTournamentStore((s) => s.ids.groupIdByStage);
  const getTeamName = useTournamentStore((s) => s.getTeamName);
  // optional: some stores expose a logo getter; fall back gracefully
  const getTeamLogo =
    useTournamentStore((s: any) => (s.getTeamLogo as ((id: number) => string | null) | undefined)) ??
    (() => null);

  // Phone layout (compact): fewer columns below sm.
  const { compact } = useEditorLayout();
  const phoneHide = compact ? "hidden sm:table-cell" : "";

  // Modal state for point adjustments
  const [editingTeam, setEditingTeam] = React.useState<{
    teamId: number;
    teamName: string;
    currentPoints: number;
    groupId: number | null;
  } | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  // Prefer the explicit DB id when provided
  const stageId = stageIdOverride ?? stageIdByIndex?.[stageIdx];
  const hasStage = typeof stageId === "number" && Number.isFinite(stageId);

  // 🔧 Sanitize to satisfy Record<number, number>
  const groupMap: Record<number, number> = React.useMemo(() => {
    if (!hasStage) return {};
    const raw = groupIdByStage?.[stageIdx] ?? {};
    const out: Record<number, number> = {};
    for (const k in (raw as Record<number, number | undefined>)) {
      const v = (raw as Record<string, number | undefined>)[k];
      if (typeof v === "number") out[Number(k)] = v;
    }
    return out;
  }, [groupIdByStage, hasStage, stageIdx]);

  const groupIdxs = React.useMemo(
    () =>
      Object.keys(groupMap)
        .map(Number)
        .sort((a, b) => a - b),
    [groupMap]
  );

  // slice standings to this stage and index by group
  const byGroup = React.useMemo(() => {
    const m = new Map<number, StandingRow[]>();
    (standings ?? []).forEach((r) => {
      if (!hasStage || r.stage_id !== stageId) return;
      const g = kind === "groups" ? Number(r.group_id ?? -1) : 0; // league = single table
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(r);
    });
    return m;
  }, [standings, hasStage, stageId, kind]);

  // empty / not hydrated
  if (!hasStage || byGroup.size === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-white/5 p-2 text-xs text-white/60">
        Δεν υπάρχουν καταγεγραμμένες βαθμολογίες για αυτό το στάδιο ακόμη.
      </div>
    );
  }

  // robust sort:
  // 1) if rank provided, asc rank
  // 2) else points desc, gd desc, gf desc
  // 3) then name asc (stable)
  const sortRows = (rows: StandingRow[]) => {
    const safeName = (id: number) => getTeamName?.(id) ?? `Team #${id}`;
    return rows
      .slice()
      .map((r) => ({
        ...r,
        gd: typeof r.gd === "number" ? r.gd : (Number(r.gf) || 0) - (Number(r.ga) || 0),
      }))
      .sort((a, b) => {
        const ar = a.rank ?? null;
        const br = b.rank ?? null;
        if (ar != null && br != null) return Number(ar) - Number(br);
        if (ar != null) return -1;
        if (br != null) return 1;

        const pd = (Number(b.points) || 0) - (Number(a.points) || 0);
        if (pd !== 0) return pd;
        const gdd = (Number(b.gd) || 0) - (Number(a.gd) || 0);
        if (gdd !== 0) return gdd;
        const gfd = (Number(b.gf) || 0) - (Number(a.gf) || 0);
        if (gfd !== 0) return gfd;
        return safeName(a.team_id).localeCompare(safeName(b.team_id));
      });
  };

  const TeamCell: React.FC<{ teamId: number }> = ({ teamId }) => {
    const name = getTeamName?.(teamId) ?? `Team #${teamId}`;
    const logo = showLogos ? getTeamLogo?.(teamId) : null;

    return (
      <div className={`flex items-center gap-2 ${compact ? "max-w-[7.5rem] sm:max-w-none" : ""}`}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt=""
            className="h-5 w-5 rounded-sm object-cover border border-white/10"
          />
        ) : null}
        <span className="min-w-0 truncate" title={name}>{name}</span>
      </div>
    );
  };

  const Table: React.FC<{ rows: StandingRow[] }> = ({ rows }) => {
    const sorted = sortRows(rows);

    const handleEditClick = (r: StandingRow) => {
      setEditingTeam({
        teamId: r.team_id,
        teamName: getTeamName?.(r.team_id) ?? `Team #${r.team_id}`,
        currentPoints: r.points,
        groupId: r.group_id ?? null,
      });
    };

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-white/90">
          <thead className="text-white/70">
            <tr className="[&>th]:px-2 [&>th]:py-1 border-b border-white/10">
              <th className={`${compact ? "w-6" : "w-10"} sm:w-10 text-right`}>#</th>
              <th className="text-left">Ομάδα</th>
              <th className="w-10 text-right" title="Αγώνες">
                {compact ? (
                  <>
                    <span className="sm:hidden">Αγ</span>
                    <span className="hidden sm:inline">Αγώνες</span>
                  </>
                ) : (
                  "Αγώνες"
                )}
              </th>
              <th className={`w-10 text-right ${phoneHide}`} title="Νίκες">Νίκες</th>
              <th className={`w-10 text-right ${phoneHide}`} title="Ισοπαλίες">Ισοπαλίες</th>
              <th className={`w-10 text-right ${phoneHide}`} title="Ήττες">Ήττες</th>
              <th className={`w-12 text-right ${phoneHide}`} title="Γκολ Υπέρ">Γκολ Υπέρ</th>
              <th className={`w-12 text-right ${phoneHide}`} title="Γκολ Κατά">Γκολ Κατά</th>
              <th className="w-12 text-right" title="Διαφορά τερμάτων">GD</th>
              <th className="w-12 text-right" title="Βαθμοί">
                {compact ? (
                  <>
                    <span className="sm:hidden">Β</span>
                    <span className="hidden sm:inline">Βαθμοί</span>
                  </>
                ) : (
                  "Βαθμοί"
                )}
              </th>
              <th className={`${compact ? "w-8" : "w-20"} sm:w-20 text-center`}>
                {compact ? <span className="hidden sm:inline">Ενέργειες</span> : "Ενέργειες"}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const rank = r.rank ?? "—";
              const gd = typeof r.gd === "number" ? r.gd : (Number(r.gf) || 0) - (Number(r.ga) || 0);
              return (
                <tr
                  key={`${r.team_id}-${r.group_id ?? "0"}`}
                  className="[&>td]:px-2 [&>td]:py-1 border-b border-white/5 hover:bg-white/5"
                >
                  <td className="text-right">{rank}</td>
                  <td className="text-left">
                    <TeamCell teamId={r.team_id} />
                  </td>
                  <td className="text-right">{r.played}</td>
                  <td className={`text-right ${phoneHide}`}>{r.won}</td>
                  <td className={`text-right ${phoneHide}`}>{r.drawn}</td>
                  <td className={`text-right ${phoneHide}`}>{r.lost}</td>
                  <td className={`text-right ${phoneHide}`}>{r.gf}</td>
                  <td className={`text-right ${phoneHide}`}>{r.ga}</td>
                  <td className="text-right">{gd}</td>
                  <td className="text-right font-semibold">{r.points}</td>
                  <td className="text-center">
                    <button
                      onClick={() => handleEditClick(r)}
                      className="px-2 py-1 text-xs bg-blue-600/80 hover:bg-blue-600 text-white rounded transition-colors"
                      title="Επεξεργασία Βαθμών"
                      aria-label="Επεξεργασία Βαθμών"
                    >
                      {compact ? (
                        <>
                          <span className="sm:hidden">✎</span>
                          <span className="hidden sm:inline">Επεξ.</span>
                        </>
                      ) : (
                        "Επεξ."
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (kind === "league") {
    const rows = byGroup.get(0) ?? [];
    return (
      <>
        <section className={`rounded-lg border border-white/10 bg-slate-950/50 ${compact ? "p-2" : "p-3"} sm:p-3 space-y-2`}>
          <header className="text-sm text-white/80 font-medium">Βαθμολογία (League)</header>
          <Table rows={rows} />
        </section>
        {editingTeam && hasStage && (
          <PointAdjustmentModal
            isOpen={true}
            onClose={() => setEditingTeam(null)}
            teamId={editingTeam.teamId}
            teamName={editingTeam.teamName}
            currentPoints={editingTeam.currentPoints}
            stageId={stageId!}
            groupId={editingTeam.groupId}
            onSuccess={() => {
              setRefreshKey((k) => k + 1);
              // Trigger a store refresh if needed
              window.location.reload();
            }}
          />
        )}
      </>
    );
  }

  // groups
  // Prefer configured UI group order (groupMap). If missing, fall back to the
  // actual group_ids we found in standings, labeling them 1..N by order.
  const groupsForRender =
    groupIdxs.length > 0
      ? groupIdxs
          .map((gi) => {
            const dbGroupId = groupMap[gi];
            return {
              label: `Όμιλος ${gi + 1}`,
              key: `ui-${gi}`,
              rows: dbGroupId != null ? byGroup.get(dbGroupId) ?? [] : [],
            };
          })
          .filter((g) => g.rows.length > 0)
      : Array.from(byGroup.entries())
          .filter(([gId]) => gId >= 0)
          .sort(([a], [b]) => a - b)
          .map(([_, rows], i) => ({
            label: `Όμιλος ${i + 1}`,
            key: `auto-${i}`,
            rows,
          }));

  return (
    <>
      <section className={`rounded-lg border border-white/10 bg-slate-950/50 ${compact ? "p-2" : "p-3"} sm:p-3 space-y-3`}>
        <header className="text-sm text-white/80 font-medium">Βαθμολογίες Ομίλων</header>
        <div className="grid gap-3 md:grid-cols-2">
          {groupsForRender.map((g) => (
            <div key={g.key} className="rounded-md border border-white/10 bg-white/5 p-2">
              <div className="text-xs text-white/70 mb-2">{g.label}</div>
              <Table rows={g.rows} />
            </div>
          ))}
        </div>
      </section>
      {editingTeam && hasStage && (
        <PointAdjustmentModal
          isOpen={true}
          onClose={() => setEditingTeam(null)}
          teamId={editingTeam.teamId}
          teamName={editingTeam.teamName}
          currentPoints={editingTeam.currentPoints}
          stageId={stageId!}
          groupId={editingTeam.groupId}
          onSuccess={() => {
            setRefreshKey((k) => k + 1);
            // Trigger a store refresh if needed
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
