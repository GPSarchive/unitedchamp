// app/tournoua/[slug]/components/teams/KnockoutTreeComponents/status.ts
export function getStatusText(lang: "en" | "el" = "en") {
    return (s?: string) => {
      const v = (s || "").toLowerCase();
      if (v === "finished") return lang === "el" ? "Ολοκληρώθηκε" : "Finished";
      if (v === "live") return lang === "el" ? "Σε εξέλιξη" : "Live";
      return lang === "el" ? "Προγραμματισμένο" : "Scheduled";
    };
  }
  
  export function getStatusClasses(s?: string) {
    const v = (s || "").toLowerCase();
    if (v === "finished") {
      return {
        chip: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/40",
        card: "border-emerald-400/40 shadow-emerald-400/10",
      };
    }
    if (v === "live") {
      return {
        chip: "bg-sky-500/10 text-sky-300 ring-sky-400/40",
        card: "border-sky-400/40 shadow-sky-400/10",
      };
    }
    return {
      chip: "bg-amber-400/10 text-amber-200 ring-amber-300/40",
      card: "border-white/10",
    };
  }
  