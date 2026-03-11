"use client";

export default function AuroraBg({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-0 -z-10 bg-zinc-900">
        <div
          className="absolute inset-0 animate-aurora opacity-30"
          style={{
            background: `
              linear-gradient(135deg, transparent 20%, rgba(249,115,22,0.15) 35%, transparent 50%),
              linear-gradient(225deg, transparent 20%, rgba(234,179,8,0.12) 40%, transparent 55%),
              linear-gradient(315deg, transparent 30%, rgba(59,130,246,0.08) 50%, transparent 65%)
            `,
            backgroundSize: "200% 200%",
          }}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </section>
  );
}
