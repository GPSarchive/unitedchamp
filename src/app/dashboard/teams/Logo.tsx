//components/DashboardPageComponents/teams/Logo.tsx
export default function Logo({ src, alt }: { src: string | null; alt: string }) {
    if (!src)
      return (
        <div
          className="h-7 w-7 grid place-items-center rounded-full bg-zinc-800 text-[10px] text-white/60"
          title="No logo"
        >
          —
        </div>
      );
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src ?? ""}
        alt={alt}
        className="h-7 w-7 rounded-full object-contain ring-1 ring-white/10 bg-white/5"
        loading="lazy"
      />
    );
  }
  