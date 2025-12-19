//components/DashboardPageComponents/teams/Logo.tsx
import TeamLogo from "@/app/components/TeamLogo";

export default function Logo({ src, alt }: { src: string | null; alt: string }) {
    return (
      <TeamLogo
        src={src}
        alt={alt}
        size="xs"
        borderStyle="subtle"
        animate={false}
      />
    );
  }
  