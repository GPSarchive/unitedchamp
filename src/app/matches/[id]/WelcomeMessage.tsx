"use client";

import { motion } from "framer-motion";
import { Calendar, Clock } from "lucide-react";

/**
 * WelcomeMessage - Elegant message for unplayed matches
 * Shows when match is scheduled with no participants/scores
 */
export default function WelcomeMessage({
  matchDate,
}: {
  matchDate: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-white/[0.08] bg-zinc-900/80 backdrop-blur-sm p-8 text-center shadow-xl shadow-black/20"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        className="mb-5 flex justify-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <Calendar className="h-8 w-8 text-emerald-400" />
        </div>
      </motion.div>

      <h2 className="mb-3 text-2xl font-bold text-white">
        Ο Αγώνας Δεν Έχει Διεξαχθεί Ακόμα
      </h2>

      <p className="mx-auto mb-5 max-w-md text-white/60">
        Αυτός ο αγώνας είναι προγραμματισμένος και περιμένουμε με ανυπομονησία να
        ξεκινήσει! Θα ενημερωθείτε μόλις ολοκληρωθεί και τα αποτελέσματα
        δημοσιευτούν.
      </p>

      {matchDate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/[0.08] px-4 py-2 text-sm text-white/50"
        >
          <Clock className="h-4 w-4 text-emerald-400/70" />
          <span>
            Προγραμματισμένο:{" "}
            <span className="text-white/70">
              {new Date(matchDate).toLocaleDateString("el-GR", { timeZone: "UTC" })}
            </span>
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
