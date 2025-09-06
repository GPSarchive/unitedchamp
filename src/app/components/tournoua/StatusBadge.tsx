// components/tournaments/StatusBadge.tsx

type Props = {
    status?: "scheduled" | "running" | "completed" | "archived" | string | null;
    className?: string;
  };
  
  export default function StatusBadge({ status, className }: Props) {
    const s = (status ?? "").toLowerCase();
  
    const styles: Record<string, string> = {
      scheduled: "bg-blue-500/15 text-blue-300 border-blue-500/30",
      running: "bg-green-500/15 text-green-300 border-green-500/30",
      completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
      archived: "bg-zinc-600/20 text-zinc-300 border-zinc-500/30",
    };
  
    const style = styles[s] ?? "bg-white/10 text-white/70 border-white/20";
  
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${style} ${className ?? ""}`}>
        {status ?? "—"}
      </span>
    );
  }
  