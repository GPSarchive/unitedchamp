"use client";

import { useState, type FormEvent } from "react";

export default function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");

    const form = e.currentTarget;
    const data = new FormData(form);
    data.append("access_key", "c1707899-cb72-4d0d-8bbe-e829e16ede5f");
    data.append("subject", `UltraChamp Επικοινωνία: ${data.get("subject") ?? "Μήνυμα"}`);
    data.append("from_name", "UltraChamp Contact Form");

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      if (json.success) {
        setStatus("sent");
        form.reset();
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
        <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-400/30 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Κάτι πήγε στραβά</h3>
        <p className="text-white/60 text-sm max-w-sm">
          Δεν ήταν δυνατή η αποστολή του μηνύματός σας. Παρακαλώ δοκιμάστε ξανά ή επικοινωνήστε μαζί μας στο info@ultrachamp.gr.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 text-sm text-orange-400 hover:text-orange-300 transition-colors underline underline-offset-4"
        >
          Δοκιμάστε ξανά
        </button>
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
        <div className="w-16 h-16 rounded-full bg-green-500/20 border border-green-400/30 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Ευχαριστούμε!</h3>
        <p className="text-white/60 text-sm max-w-sm">
          Το μήνυμά σας εστάλη με επιτυχία. Θα επικοινωνήσουμε μαζί σας σύντομα.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 text-sm text-orange-400 hover:text-orange-300 transition-colors underline underline-offset-4"
        >
          Αποστολή νέου μηνύματος
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name + Email row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">
            Ονοματεπώνυμο *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="π.χ. Γιάννης Παπαδόπουλος"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-orange-400/50 focus:ring-1 focus:ring-orange-400/30 transition-all"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">
            Email *
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="email@example.com"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-orange-400/50 focus:ring-1 focus:ring-orange-400/30 transition-all"
          />
        </div>
      </div>

      {/* Phone + Subject row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="phone" className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">
            Τηλέφωνο
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            placeholder="+30 69x xxx xxxx"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-orange-400/50 focus:ring-1 focus:ring-orange-400/30 transition-all"
          />
        </div>
        <div>
          <label htmlFor="subject" className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">
            Θέμα *
          </label>
          <select
            id="subject"
            name="subject"
            required
            defaultValue=""
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-orange-400/50 focus:ring-1 focus:ring-orange-400/30 transition-all appearance-none"
          >
            <option value="" disabled className="bg-zinc-900 text-white/50">
              Επιλέξτε θέμα
            </option>
            <option value="general" className="bg-zinc-900 text-white">Γενική Ερώτηση</option>
            <option value="tournament" className="bg-zinc-900 text-white">Πρωτάθλημα / Τουρνουά</option>
            <option value="team" className="bg-zinc-900 text-white">Εγγραφή Ομάδας</option>
            <option value="sponsorship" className="bg-zinc-900 text-white">Χορηγία / Συνεργασία</option>
            <option value="complaint" className="bg-zinc-900 text-white">Παράπονο / Αναφορά</option>
            <option value="other" className="bg-zinc-900 text-white">Άλλο</option>
          </select>
        </div>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className="block text-xs text-white/50 uppercase tracking-wider mb-1.5">
          Μήνυμα *
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          placeholder="Γράψτε το μήνυμά σας εδώ..."
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-orange-400/50 focus:ring-1 focus:ring-orange-400/30 transition-all resize-none"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-white/30 text-xs">* Υποχρεωτικά πεδία</p>
        <button
          type="submit"
          disabled={status === "sending"}
          className="relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3 text-sm font-bold text-black shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {status === "sending" ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Αποστολή...
            </>
          ) : (
            <>
              Αποστολή
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
