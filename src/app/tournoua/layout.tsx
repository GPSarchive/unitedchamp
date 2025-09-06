// app/tournoua/layout.tsx
import type { ReactNode } from "react";

export const metadata = {
  title: "Τουρνουά",
};

export default function TournouaLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-black text-white">
      {children}
    </main>
  );
}
