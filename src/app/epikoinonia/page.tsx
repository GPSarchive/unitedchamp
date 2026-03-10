import type { Metadata } from "next";
import Image from "next/image";
import VantaBg from "@/app/lib/VantaBg";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Επικοινωνία | UltraChamp.gr",
  description: "Επικοινωνήστε μαζί μας για οποιαδήποτε απορία σχετικά με τα πρωταθλήματα mini football.",
};

export default function EpikoinoniaPage() {
  return (
    <section className="relative min-h-screen text-slate-50 overflow-x-hidden">
      {/* Fixed Vanta background */}
      <VantaBg className="fixed inset-0 -z-10" mode="eco" />

      <div className="relative z-10">
        {/* ── Hero header ── */}
        <div className="flex flex-col items-center pt-8 pb-12 px-4">
          <div className="relative w-24 h-24 mb-4">
            <Image
              src="/UltraChampLogo.png"
              alt="UltraChamp Logo"
              fill
              className="object-contain drop-shadow-[0_0_15px_rgba(251,146,60,0.3)]"
              priority
            />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-center text-white tracking-tight">
            Επικοινωνία
          </h1>
          <p className="mt-3 text-white/60 text-center max-w-lg text-sm sm:text-base">
            Είμαστε εδώ για εσάς. Στείλτε μας μήνυμα ή επικοινωνήστε μαζί μας
            μέσω τηλεφώνου και email.
          </p>
        </div>

        {/* ── Main content grid ── */}
        <div className="container mx-auto px-4 pb-16 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
            {/* ─── Left column: Contact details + Map ─── */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              {/* Contact details card */}
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl">
                <h2 className="text-xl font-bold text-orange-400 mb-6 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Στοιχεία Επικοινωνίας
                </h2>

                <div className="space-y-5">
                  {/* Address */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-400/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Διεύθυνση</p>
                      <p className="text-white/90 text-sm leading-relaxed">
                        Αθήνα, Ελλάδα
                      </p>
                    </div>
                  </div>

                  {/* Phone */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-400/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Τηλέφωνο</p>
                      <a href="tel:+306900000000" className="text-white/90 text-sm hover:text-orange-400 transition-colors">
                        +30 690 000 0000
                      </a>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-400/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Email</p>
                      <a href="mailto:info@ultrachamp.gr" className="text-white/90 text-sm hover:text-orange-400 transition-colors">
                        info@ultrachamp.gr
                      </a>
                    </div>
                  </div>

                  {/* Hours */}
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-400/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Ώρες Λειτουργίας</p>
                      <p className="text-white/90 text-sm">Δευτέρα – Παρασκευή: 10:00 – 20:00</p>
                      <p className="text-white/90 text-sm">Σάββατο: 10:00 – 15:00</p>
                    </div>
                  </div>

                  {/* Social */}
                  <div className="pt-4 border-t border-white/10">
                    <p className="text-white/50 text-xs uppercase tracking-wider mb-3">Social Media</p>
                    <div className="flex gap-3">
                      {/* Instagram */}
                      <a
                        href="#"
                        aria-label="Instagram"
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-orange-500/20 hover:border-orange-400/30 transition-all duration-300"
                      >
                        <svg className="w-5 h-5 text-white/70 hover:text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                        </svg>
                      </a>
                      {/* Facebook */}
                      <a
                        href="#"
                        aria-label="Facebook"
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-orange-500/20 hover:border-orange-400/30 transition-all duration-300"
                      >
                        <svg className="w-5 h-5 text-white/70 hover:text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                      </a>
                      {/* TikTok */}
                      <a
                        href="#"
                        aria-label="TikTok"
                        className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-orange-500/20 hover:border-orange-400/30 transition-all duration-300"
                      >
                        <svg className="w-5 h-5 text-white/70 hover:text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map card */}
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-white/10">
                  <h2 className="text-lg font-bold text-orange-400 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Τοποθεσία
                  </h2>
                </div>
                {/* OpenStreetMap embed — no API key required */}
                <div className="aspect-[4/3] w-full">
                  <iframe
                    title="Τοποθεσία UltraChamp"
                    src="https://www.openstreetmap.org/export/embed.html?bbox=23.7000%2C37.9600%2C23.7600%2C37.9900&layer=mapnik&marker=37.9750%2C23.7300"
                    className="w-full h-full border-0"
                    loading="lazy"
                    allowFullScreen
                  />
                </div>
                <div className="p-3 text-center">
                  <a
                    href="https://www.openstreetmap.org/?mlat=37.9750&mlon=23.7300#map=14/37.9750/23.7300"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white/50 hover:text-orange-400 transition-colors"
                  >
                    Προβολή μεγαλύτερου χάρτη &rarr;
                  </a>
                </div>
              </div>
            </div>

            {/* ─── Right column: Contact form ─── */}
            <div className="lg:col-span-3">
              <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl h-full">
                <h2 className="text-xl font-bold text-orange-400 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Στείλτε μας Μήνυμα
                </h2>
                <p className="text-white/50 text-sm mb-6">
                  Συμπληρώστε τη φόρμα και θα επικοινωνήσουμε μαζί σας το
                  συντομότερο δυνατό.
                </p>

                <ContactForm />
              </div>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="pb-8 text-center">
          <p className="text-white/40 text-sm">
            &copy; 2025 Ultra Champ. Όλα τα δικαιώματα διατηρούνται.
          </p>
        </div>
      </div>
    </section>
  );
}
