"use client";

import { motion } from "framer-motion";
import { Calendar, Clock } from "lucide-react";

/**
 * WelcomeMessage - Friendly Greek message for unplayed matches
 * Shows when match is scheduled and no participants/scores are available
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
      className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-8 text-center backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="mb-4 flex justify-center"
      >
        <div className="rounded-full bg-white/10 p-4">
          <Calendar className="h-12 w-12 text-white/80" />
        </div>
      </motion.div>

      <h2 className="mb-3 text-2xl font-bold text-white">
        Ο Αγώνας Δεν Έχει Διεξαχθεί Ακόμα
      </h2>

      <p className="mx-auto mb-4 max-w-md text-white/70">
        Αυτός ο αγώνας είναι προγραμματισμένος και περιμένουμε με ανυπομονησία να
        ξεκινήσει! Θα ενημερωθείτε μόλις ολοκληρωθεί και τα αποτελέσματα
        δημοσιευτούν.
      </p>

      {matchDate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm text-white/60"
        >
          <Clock className="h-4 w-4" />
          <span>
            Προγραμματισμένο: {new Date(matchDate).toLocaleDateString("el-GR", { timeZone: "UTC" })}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}