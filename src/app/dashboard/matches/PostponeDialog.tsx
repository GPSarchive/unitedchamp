"use client";

import React, { useState } from "react";
import { X, Clock, Calendar, AlertCircle } from "lucide-react";
import type { MatchRow } from "@/app/lib/types";

interface PostponeDialogProps {
  match: MatchRow & {
    teamA?: { name: string } | { name: string }[] | null;
    teamB?: { name: string } | { name: string }[] | null;
  };
  onCancel: () => void;
  onSuccess: () => void;
}

const POSTPONEMENT_REASONS = [
  { value: "none", label: "(Χωρίς λόγο)" },
  { value: "weather", label: "Κακές καιρικές συνθήκες" },
  { value: "venue", label: "Έλλειψη γηπέδου" },
  { value: "team_request", label: "Αίτημα ομάδας" },
  { value: "other", label: "Άλλο" },
];

export default function PostponeDialog({
  match,
  onCancel,
  onSuccess,
}: PostponeDialogProps) {
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("20:00");
  const [reasonType, setReasonType] = useState("none");
  const [customReason, setCustomReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Extract team names
  const getTeamName = (team: typeof match.teamA): string => {
    if (!team) return "Unknown";
    return Array.isArray(team) ? team[0]?.name ?? "Unknown" : team.name;
  };

  const teamAName = getTeamName(match.teamA);
  const teamBName = getTeamName(match.teamB);

  // Format current date for display
  const formatCurrentDate = () => {
    if (!match.match_date) return "No date set";
    const d = new Date(match.match_date);
    return d.toLocaleString("el-GR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get minimum date (tomorrow)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate future date if provided
    let newDateTime: string | null = null;
    if (newDate) {
      newDateTime = `${newDate}T${newTime}:00.000Z`;
      const selectedDate = new Date(newDateTime);
      const now = new Date();
      if (selectedDate <= now) {
        setError("New date must be in the future");
        return;
      }
    }

    // Get reason text (optional)
    let reason: string | null = null;
    if (reasonType === "none") {
      reason = null;
    } else if (reasonType === "other") {
      reason = customReason.trim() || null;
    } else {
      reason = POSTPONEMENT_REASONS.find((r) => r.value === reasonType)?.label ?? null;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/matches/${match.id}/postpone`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          new_match_date: newDateTime,
          postponement_reason: reason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      // Success!
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to postpone match");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-gradient-to-b from-zinc-900 to-black border border-orange-500/30 rounded-2xl shadow-2xl shadow-orange-500/20">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Clock className="h-5 w-5 text-orange-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Αναβολή Αγώνα</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            disabled={isSubmitting}
          >
            <X className="h-5 w-5 text-white/70" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {/* Match Info */}
          <div className="p-4 bg-white/5 rounded-lg border border-white/10">
            <div className="text-sm text-white/60 mb-1">Match</div>
            <div className="text-lg font-semibold text-white">
              {teamAName} vs {teamBName}
            </div>
            <div className="flex items-center gap-2 mt-2 text-sm text-white/70">
              <Calendar className="h-4 w-4" />
              <span>Current: {formatCurrentDate()}</span>
            </div>
          </div>

          {/* New Date */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/90">
              📅 Νέα Ημερομηνία (προαιρετικό)
            </label>
            <p className="text-xs text-white/60">
              Αφήστε κενό αν η νέα ημερομηνία δεν έχει καθοριστεί ακόμα
            </p>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                min={getMinDate()}
                disabled={isSubmitting}
                className="px-4 py-3 bg-zinc-950 text-white rounded-lg border border-white/20 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/50 disabled:opacity-50"
              />
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                disabled={isSubmitting || !newDate}
                className="px-4 py-3 bg-zinc-950 text-white rounded-lg border border-white/20 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/50 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-white/90">
              📝 Λόγος Αναβολής (προαιρετικό)
            </label>
            <select
              value={reasonType}
              onChange={(e) => setReasonType(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-zinc-950 text-white rounded-lg border border-white/20 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/50 disabled:opacity-50"
            >
              {POSTPONEMENT_REASONS.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {reason.label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Reason Input */}
          {reasonType === "other" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-white/90">
                Άλλος λόγος
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Εισάγετε τον λόγο..."
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-zinc-950 text-white rounded-lg border border-white/20 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/50 placeholder:text-white/40 disabled:opacity-50"
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-300">{error}</div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 rounded-lg border border-white/20 text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Ακύρωση
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-orange-600 to-orange-500 text-white font-semibold hover:from-orange-500 hover:to-orange-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/30"
            >
              {isSubmitting ? "Αναβολή..." : "Αναβολή Αγώνα"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
