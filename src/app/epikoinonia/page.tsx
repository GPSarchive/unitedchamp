// app/epikoinonia/page.tsx
import type { Metadata } from "next";
import VantaBg from "@/app/lib/VantaBg";
import ContactContent from "./ContactContent";

export const metadata: Metadata = {
  title: "Επικοινωνία | UltraChamp.gr",
  description:
    "Επικοινωνήστε με την UltraChamp για ερωτήσεις σχετικά με τα πρωταθλήματα mini football, εγγραφές ομάδων και συνεργασίες.",
};

export default function EpikoinoniaPage() {
  return (
    <section className="relative min-h-screen text-slate-50 overflow-x-hidden">
      {/* Fixed Vanta background */}
      <VantaBg className="fixed inset-0 -z-10" mode="eco" />

      {/* Page content */}
      <ContactContent />
    </section>
  );
}
