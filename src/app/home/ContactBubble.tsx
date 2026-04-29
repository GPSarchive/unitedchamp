"use client";

import { useState } from "react";
import { X, MessageCircle } from "lucide-react";
import ContactForm from "@/app/epikoinonia/ContactForm";

export default function ContactBubble() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Επικοινωνία"
        className="group fixed bottom-6 right-4 sm:right-6 z-50 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-full bg-black/80 ring-1 ring-black hover:ring-white/25 backdrop-blur-2xl shadow-xl shadow-black/40 transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-400 group-hover:text-orange-300 transition-colors" />
        <span className="text-xs sm:text-sm font-medium text-white/90 group-hover:text-white transition-colors">
          Επικοινωνία
        </span>
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          {/* Modal panel */}
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-900/95 border border-white/10 shadow-2xl shadow-black/60 backdrop-blur-2xl">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-zinc-900/95 backdrop-blur-sm rounded-t-2xl">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-orange-400 mb-0.5">
                  UltraChamp
                </p>
                <h2 className="text-lg font-bold text-white">Επικοινωνία</h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Κλείσιμο"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form body */}
            <div className="px-6 py-6">
              <ContactForm />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
