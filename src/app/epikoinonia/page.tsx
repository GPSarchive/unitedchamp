"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  User,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import VantaSection from "@/app/home/VantaSection";
import GridBgSection from "@/app/home/GridBgSection";

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
} satisfies Record<string, unknown>;

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
} satisfies Record<string, unknown>;

/* ------------------------------------------------------------------ */
/*  Contact-info cards data                                            */
/* ------------------------------------------------------------------ */
const contactCards = [
  {
    icon: Phone,
    title: "Τηλέφωνο",
    lines: ["+30 210 1234 567", "+30 697 1234 567"],
    accent: "from-orange-500/20 to-amber-500/20",
    border: "border-orange-400/25",
    iconBg: "bg-orange-500/15 border-orange-400/30",
  },
  {
    icon: Mail,
    title: "Email",
    lines: ["info@ultrachamp.gr", "support@ultrachamp.gr"],
    accent: "from-amber-500/20 to-yellow-500/20",
    border: "border-amber-400/25",
    iconBg: "bg-amber-500/15 border-amber-400/30",
  },
  {
    icon: MapPin,
    title: "Διεύθυνση",
    lines: ["Λεωφόρος Αλεξάνδρας 12", "Αθήνα, 11473"],
    accent: "from-yellow-500/20 to-orange-500/20",
    border: "border-yellow-400/25",
    iconBg: "bg-yellow-500/15 border-yellow-400/30",
  },
  {
    icon: Clock,
    title: "Ωράριο",
    lines: ["Δευ - Παρ: 09:00 - 21:00", "Σάβ: 10:00 - 18:00"],
    accent: "from-orange-400/20 to-red-500/20",
    border: "border-orange-400/25",
    iconBg: "bg-orange-400/15 border-orange-400/30",
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function EpikoinoniaPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: wire up to your backend / email service
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden bg-zinc-950">
      {/* ============ HERO ============ */}
      <VantaSection
        className="py-20 sm:py-28 text-white"
        overlayClassName="bg-black/30"
      >
        <div className="container mx-auto px-4 text-center">
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="uppercase tracking-[0.25em] text-orange-300/80 text-xs sm:text-sm mb-3"
          >
            Ultra Champ
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl font-bold font-sans tracking-tight"
          >
            Επικοινωνία
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-4 text-white/60 max-w-lg mx-auto text-sm sm:text-base"
          >
            Είμαστε εδώ για εσάς. Στείλτε μας μήνυμα ή επικοινωνήστε μαζί μας
            με οποιονδήποτε τρόπο σας βολεύει.
          </motion.p>
        </div>
      </VantaSection>

      {/* ============ CONTACT CARDS ROW ============ */}
      <GridBgSection className="py-14 sm:py-20 text-white">
        <div className="container mx-auto px-4">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {contactCards.map((card, i) => (
              <motion.div
                key={card.title}
                variants={fadeUp}
                custom={i}
                className={`group relative rounded-2xl border ${card.border} bg-gradient-to-br ${card.accent} backdrop-blur-md p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-orange-500/5`}
              >
                <div
                  className={`w-11 h-11 rounded-xl ${card.iconBg} border flex items-center justify-center mb-4`}
                >
                  <card.icon className="w-5 h-5 text-orange-300" />
                </div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80 mb-2">
                  {card.title}
                </h3>
                {card.lines.map((line) => (
                  <p key={line} className="text-white/60 text-sm leading-relaxed">
                    {line}
                  </p>
                ))}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </GridBgSection>

      {/* ============ FORM + MAP  (side-by-side on lg) ============ */}
      <section className="bg-zinc-950 text-white py-14 sm:py-20">
        <div className="container mx-auto px-4">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
            className="grid lg:grid-cols-5 gap-8 lg:gap-10"
          >
            {/* ---------- FORM (3 cols) ---------- */}
            <motion.div variants={fadeUp} custom={0} className="lg:col-span-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-400/30 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-orange-300" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold">
                      Στείλτε μας μήνυμα
                    </h2>
                    <p className="text-white/50 text-xs mt-0.5">
                      Συμπληρώστε τη φόρμα και θα επικοινωνήσουμε σύντομα μαζί
                      σας
                    </p>
                  </div>
                </div>

                {submitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-16"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mx-auto mb-4">
                      <Send className="w-7 h-7 text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">
                      Ευχαριστούμε!
                    </h3>
                    <p className="text-white/50 text-sm">
                      Το μήνυμά σας εστάλη. Θα επικοινωνήσουμε σύντομα.
                    </p>
                    <button
                      onClick={() => {
                        setSubmitted(false);
                        setForm({ name: "", email: "", subject: "", message: "" });
                      }}
                      className="mt-6 text-sm text-orange-400 hover:text-orange-300 underline underline-offset-4 transition"
                    >
                      Αποστολή νέου μηνύματος
                    </button>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name + Email row */}
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label
                          htmlFor="name"
                          className="block text-xs font-medium text-white/50 mb-1.5"
                        >
                          Ονοματεπώνυμο
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                          <input
                            id="name"
                            name="name"
                            type="text"
                            required
                            value={form.name}
                            onChange={handleChange}
                            placeholder="π.χ. Γιάννης Παπαδόπουλος"
                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-orange-400/50 focus:ring-1 focus:ring-orange-400/20 transition"
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="email"
                          className="block text-xs font-medium text-white/50 mb-1.5"
                        >
                          Email
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                          <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            value={form.email}
                            onChange={handleChange}
                            placeholder="you@example.com"
                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-orange-400/50 focus:ring-1 focus:ring-orange-400/20 transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <label
                        htmlFor="subject"
                        className="block text-xs font-medium text-white/50 mb-1.5"
                      >
                        Θέμα
                      </label>
                      <div className="relative">
                        <ChevronRight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                        <input
                          id="subject"
                          name="subject"
                          type="text"
                          required
                          value={form.subject}
                          onChange={handleChange}
                          placeholder="Θέμα μηνύματος"
                          className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-orange-400/50 focus:ring-1 focus:ring-orange-400/20 transition"
                        />
                      </div>
                    </div>

                    {/* Message */}
                    <div>
                      <label
                        htmlFor="message"
                        className="block text-xs font-medium text-white/50 mb-1.5"
                      >
                        Μήνυμα
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={5}
                        value={form.message}
                        onChange={handleChange}
                        placeholder="Γράψτε το μήνυμά σας εδώ..."
                        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-orange-400/50 focus:ring-1 focus:ring-orange-400/20 transition resize-none"
                      />
                    </div>

                    {/* Submit */}
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-600/20 transition-all duration-300 hover:shadow-orange-600/40 hover:brightness-110 active:scale-[0.98]"
                    >
                      <Send className="w-4 h-4" />
                      Αποστολή
                    </button>
                  </form>
                )}
              </div>
            </motion.div>

            {/* ---------- MAP (2 cols) ---------- */}
            <motion.div variants={fadeUp} custom={1} className="lg:col-span-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden h-full flex flex-col">
                <div className="flex items-center gap-3 p-6 pb-0">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-400/30 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-orange-300" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold">
                      Βρείτε μας
                    </h2>
                    <p className="text-white/50 text-xs mt-0.5">
                      Λεωφόρος Αλεξάνδρας 12, Αθήνα
                    </p>
                  </div>
                </div>

                {/* Google Maps iframe — replace the `src` with your own embed URL or API key */}
                <div className="flex-1 min-h-[350px] lg:min-h-0 p-4">
                  <div className="rounded-xl overflow-hidden h-full min-h-[320px] border border-white/5">
                    <iframe
                      title="Ultra Champ Location"
                      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3144.525306604518!2d23.741674!3d37.988442!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14a1bd3940e17b5b%3A0x400bd2ce68b1080!2sLeoforos%20Alexandras%2C%20Athens!5e0!3m2!1sen!2sgr!4v1700000000000!5m2!1sen!2sgr"
                      width="100%"
                      height="100%"
                      style={{ border: 0, minHeight: 320 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ============ BOTTOM CTA ============ */}
      <VantaSection
        className="py-14 sm:py-20 text-white"
        overlayClassName="bg-black/30"
      >
        <div className="container mx-auto px-4 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-2xl sm:text-3xl font-bold mb-3"
          >
            Ελάτε να παίξουμε μαζί
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="text-white/55 max-w-md mx-auto text-sm sm:text-base mb-6"
          >
            Γίνετε μέλος του Ultra Champ και ζήστε την εμπειρία ενός οργανωμένου
            πρωταθλήματος mini football.
          </motion.p>
          <motion.a
            href="/sign-up"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="inline-block bg-yellow-600 text-white px-8 py-3 rounded-full font-semibold transition hover:bg-black hover:border hover:border-white"
          >
            Εγγραφείτε τώρα
          </motion.a>
        </div>
      </VantaSection>
    </div>
  );
}
