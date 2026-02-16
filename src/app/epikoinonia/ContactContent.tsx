"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Instagram,
  Facebook,
  Send,
  ChevronRight,
  Map,
  CheckCircle2,
} from "lucide-react";

/* ─── env ─────────────────────────────────────────────────── */
const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MAP_QUERY = "Αθήνα, Ελλάδα"; // Replace with exact address once key is provided

/* ─── animation presets ───────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09 } },
};

/* ─── contact detail rows ─────────────────────────────────── */
const CONTACT_DETAILS = [
  {
    icon: MapPin,
    label: "Διεύθυνση",
    value: "Οδός Παραδείγματος 1\nΑθήνα, 10000",
    href: null,
  },
  {
    icon: Phone,
    label: "Τηλέφωνο",
    value: "+30 210 000 0000",
    href: "tel:+302100000000",
  },
  {
    icon: Mail,
    label: "Email",
    value: "info@unitedchamp.gr",
    href: "mailto:info@unitedchamp.gr",
  },
  {
    icon: Clock,
    label: "Ώρες Επικοινωνίας",
    value: "Δευτ – Παρ:  09:00 – 18:00\nΣάββατο:  10:00 – 14:00",
    href: null,
  },
];

/* ─── shared input class ──────────────────────────────────── */
const inputBase =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-orange-500/40 focus:bg-white/[0.07] transition-all duration-200";

/* ═══════════════════════════════════════════════════════════ */
export default function ContactContent() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Placeholder — wire up real endpoint later
    await new Promise((r) => setTimeout(r, 1100));
    setLoading(false);
    setSubmitted(true);
  };

  const resetForm = () => {
    setSubmitted(false);
    setForm({ name: "", email: "", phone: "", subject: "", message: "" });
  };

  return (
    <div className="relative z-10">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden pt-12 pb-14 px-4 text-center">
        {/* soft orange glow from top */}
        <div className="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-gradient-to-b from-orange-500/8 via-orange-500/3 to-transparent" />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mx-auto max-w-3xl"
        >
          {/* eyebrow */}
          <motion.p
            variants={fadeUp}
            className="mb-4 text-xs font-semibold uppercase tracking-[0.32em] text-orange-400"
          >
            UltraChamp.gr
          </motion.p>

          {/* main title */}
          <motion.h1
            variants={fadeUp}
            className="mb-5 text-5xl font-black uppercase tracking-tight text-white sm:text-6xl md:text-7xl"
          >
            ΕΠΙΚΟΙΝΩ
            <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              ΝΙΑ
            </span>
          </motion.h1>

          {/* orange rule */}
          <motion.div
            variants={fadeUp}
            className="mx-auto mb-6 h-[3px] w-20 rounded-full bg-gradient-to-r from-orange-500 to-orange-500/0"
          />

          <motion.p
            variants={fadeUp}
            className="mx-auto max-w-lg text-base leading-relaxed text-white/55 sm:text-lg"
          >
            Είμαστε εδώ για εσάς. Στείλτε μας ένα μήνυμα και θα επικοινωνήσουμε
            μαζί σας το συντομότερο δυνατό.
          </motion.p>
        </motion.div>
      </div>

      {/* ── MAIN GRID ─────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-4 pb-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 lg:gap-8">

          {/* ─ LEFT: Contact Details ─────────────────────────── */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, x: -32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur-md sm:p-8">
              {/* section heading */}
              <div className="mb-8">
                <h2 className="text-[0.8rem] font-bold uppercase tracking-[0.2em] text-white">
                  Στοιχεία Επικοινωνίας
                </h2>
                <div className="mt-2 h-[2px] w-10 rounded-full bg-orange-500" />
              </div>

              {/* detail rows */}
              <div className="space-y-6">
                {CONTACT_DETAILS.map(({ icon: Icon, label, value, href }, i) => {
                  const inner = (
                    <div className="group flex items-start gap-4">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-orange-400/25 bg-orange-500/10 text-orange-400 transition-all duration-300 group-hover:border-orange-400/50 group-hover:bg-orange-500/20">
                        <Icon size={17} />
                      </span>
                      <div>
                        <p className="mb-0.5 text-[0.7rem] uppercase tracking-wider text-white/40">
                          {label}
                        </p>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-white/85">
                          {value}
                        </p>
                      </div>
                    </div>
                  );

                  return href ? (
                    <a key={i} href={href} className="block">
                      {inner}
                    </a>
                  ) : (
                    <div key={i}>{inner}</div>
                  );
                })}
              </div>

              {/* divider */}
              <div className="my-7 border-t border-white/10" />

              {/* social */}
              <div>
                <p className="mb-3 text-[0.7rem] uppercase tracking-wider text-white/40">
                  Ακολουθήστε μας
                </p>
                <div className="flex gap-3">
                  {[
                    { href: "#", label: "Facebook", Icon: Facebook },
                    { href: "#", label: "Instagram", Icon: Instagram },
                  ].map(({ href, label, Icon }) => (
                    <a
                      key={label}
                      href={href}
                      aria-label={label}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/45 transition-all duration-300 hover:border-orange-400/35 hover:bg-orange-500/10 hover:text-orange-400"
                    >
                      <Icon size={17} />
                    </a>
                  ))}
                </div>
              </div>

              {/* response badge */}
              <div className="mt-auto pt-7">
                <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-green-400/80" />
                  <span className="text-xs text-white/35">
                    Συνήθως απαντάμε εντός 24 ωρών
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ─ RIGHT: Contact Form ───────────────────────────── */}
          <motion.div
            className="lg:col-span-3"
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex h-full flex-col rounded-2xl border border-white/10 bg-black/40 p-6 shadow-2xl backdrop-blur-md sm:p-8">
              {/* section heading */}
              <div className="mb-8">
                <h2 className="text-[0.8rem] font-bold uppercase tracking-[0.2em] text-white">
                  Στείλτε μας Μήνυμα
                </h2>
                <div className="mt-2 h-[2px] w-10 rounded-full bg-orange-500" />
              </div>

              {/* ── Success State ── */}
              {submitted ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-1 flex-col items-center justify-center py-12 text-center"
                >
                  <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-orange-400/30 bg-orange-500/15 text-orange-400">
                    <CheckCircle2 size={30} />
                  </div>
                  <h3 className="mb-2 text-2xl font-bold text-white">Το μήνυμά σας εστάλη!</h3>
                  <p className="mb-8 max-w-xs text-sm leading-relaxed text-white/50">
                    Σας ευχαριστούμε. Θα επικοινωνήσουμε μαζί σας σύντομα.
                  </p>
                  <button
                    onClick={resetForm}
                    className="flex items-center gap-1.5 text-sm text-orange-400 transition-colors hover:text-orange-300"
                  >
                    Αποστολή νέου μηνύματος
                    <ChevronRight size={15} />
                  </button>
                </motion.div>
              ) : (
                /* ── Form ── */
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {/* row 1 */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[0.7rem] uppercase tracking-wider text-white/40">
                        Ονοματεπώνυμο <span className="text-orange-400">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        required
                        placeholder="Γιώργης Παπαδόπουλος"
                        className={inputBase}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[0.7rem] uppercase tracking-wider text-white/40">
                        Email <span className="text-orange-400">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        required
                        placeholder="email@example.com"
                        className={inputBase}
                      />
                    </div>
                  </div>

                  {/* row 2 */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[0.7rem] uppercase tracking-wider text-white/40">
                        Τηλέφωνο
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        placeholder="+30 6900 000 000"
                        className={inputBase}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[0.7rem] uppercase tracking-wider text-white/40">
                        Θέμα <span className="text-orange-400">*</span>
                      </label>
                      <select
                        name="subject"
                        value={form.subject}
                        onChange={handleChange}
                        required
                        style={{ colorScheme: "dark" }}
                        className={inputBase + " cursor-pointer"}
                      >
                        <option value="">Επιλέξτε θέμα…</option>
                        <option value="general">Γενική Ερώτηση</option>
                        <option value="tournaments">Πρωταθλήματα & Τουρνουά</option>
                        <option value="registration">Εγγραφή Ομάδας</option>
                        <option value="technical">Τεχνική Υποστήριξη</option>
                        <option value="media">Συνεργασίες & Media</option>
                        <option value="other">Άλλο</option>
                      </select>
                    </div>
                  </div>

                  {/* message */}
                  <div>
                    <label className="mb-1.5 block text-[0.7rem] uppercase tracking-wider text-white/40">
                      Μήνυμα <span className="text-orange-400">*</span>
                    </label>
                    <textarea
                      name="message"
                      value={form.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      placeholder="Γράψτε το μήνυμά σας εδώ…"
                      className={inputBase + " resize-none"}
                    />
                  </div>

                  {/* submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-1 flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-3.5 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-orange-500/20 transition-all duration-300 hover:from-orange-600 hover:to-orange-700 hover:shadow-orange-500/30 disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Αποστολή…
                      </>
                    ) : (
                      <>
                        <Send size={15} />
                        Αποστολή Μηνύματος
                      </>
                    )}
                  </button>

                  <p className="text-center text-[0.7rem] text-white/25">
                    Τα πεδία με <span className="text-orange-400">*</span> είναι υποχρεωτικά
                  </p>
                </form>
              )}
            </div>
          </motion.div>
        </div>

        {/* ── MAP ───────────────────────────────────────────────── */}
        <motion.div
          className="mt-6 lg:mt-8"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.48, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl backdrop-blur-md">
            {/* map card header */}
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
              <div>
                <h2 className="text-[0.8rem] font-bold uppercase tracking-[0.2em] text-white">
                  Βρείτε μας
                </h2>
                <div className="mt-2 h-[2px] w-10 rounded-full bg-orange-500" />
              </div>
              <div className="flex items-center gap-2 text-[0.7rem] text-white/35">
                <Map size={13} />
                <span>UltraChamp · Αθήνα, Ελλάδα</span>
              </div>
            </div>

            {/* map body */}
            <div className="relative h-[420px] sm:h-[480px]">
              {GOOGLE_MAPS_KEY ? (
                <iframe
                  src={`https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_KEY}&q=${encodeURIComponent(
                    MAP_QUERY
                  )}&zoom=15&language=el`}
                  width="100%"
                  height="100%"
                  style={{
                    border: 0,
                    /* dark-mode filter so the map blends with the site */
                    filter:
                      "invert(90%) hue-rotate(180deg) saturate(0.85) brightness(0.88)",
                  }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Χάρτης UltraChamp"
                />
              ) : (
                /* ── Map placeholder ── */
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/60">
                  {/* subtle grid overlay */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
                      backgroundSize: "48px 48px",
                    }}
                  />

                  {/* decorative ping dots */}
                  <span className="absolute left-[22%] top-[18%] h-2 w-2 animate-pulse rounded-full bg-orange-400/20" />
                  <span
                    className="absolute bottom-[20%] right-[20%] h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400/20"
                    style={{ animationDelay: "0.6s" }}
                  />
                  <span
                    className="absolute right-[12%] top-[38%] h-1.5 w-1.5 animate-pulse rounded-full bg-white/10"
                    style={{ animationDelay: "1.2s" }}
                  />

                  {/* centre content */}
                  <div className="relative z-10 flex max-w-sm flex-col items-center px-6 text-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-orange-400/35 bg-orange-500/15 text-orange-400 shadow-lg shadow-orange-500/15">
                      <MapPin size={28} />
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-white">
                      Ο χάρτης θα εμφανιστεί εδώ
                    </h3>
                    <p className="text-sm leading-relaxed text-white/40">
                      Απαιτείται Google Maps API Key. Ορίστε{" "}
                      <code className="rounded bg-orange-500/10 px-1 py-0.5 text-xs text-orange-400/80">
                        NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                      </code>{" "}
                      στο{" "}
                      <code className="rounded bg-orange-500/10 px-1 py-0.5 text-xs text-orange-400/80">
                        .env
                      </code>
                      .
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* bottom breathing room */}
        <div className="pb-14" />
      </div>
    </div>
  );
}
