// app/OMADA/[id]/TeamHeader.tsx
import { Team } from "@/app/lib/types";
import LightRays from "./react-bits/LightRays";

/**
 * Transform external logo URLs to use local CORS-enabled proxy.
 * External URLs (e.g., https://www.ultrachamp.gr/api/public/team-logo/...)
 * need to be proxied through our API to enable CORS for WebGL.
 */
function getProxiedLogoUrl(logoUrl: string | null | undefined): string {
  if (!logoUrl) return "/placeholder-logo.png";

  // If already a relative URL or local, return as-is
  if (logoUrl.startsWith("/")) return logoUrl;

  try {
    const url = new URL(logoUrl);
    // If it's an external ultrachamp.gr URL, extract the path and use local proxy
    if (url.hostname === "www.ultrachamp.gr" || url.hostname === "ultrachamp.gr") {
      // Extract path after /api/public/team-logo/
      const match = url.pathname.match(/\/api\/public\/team-logo\/(.+)/);
      if (match && match[1]) {
        return `/api/public/team-logo/${match[1]}`;
      }
    }
    // For other external URLs, return as-is (might need proxy in future)
    return logoUrl;
  } catch {
    // Invalid URL, return as-is
    return logoUrl;
  }
}

export default function TeamHeader({ team }: { team: Team }) {
  return (
    <div className="relative mb-8 overflow-hidden rounded-2xl border border-zinc-800/50 bg-gradient-to-br from-orange-900/10 to-zinc-900/50 shadow-xl">
      <div className="relative flex flex-col items-center gap-6 p-8 md:p-12 text-center">
        {team.logo && (
          <div
            className="relative overflow-hidden rounded-full border-4 border-orange-500/30 bg-transparent p-4 shadow-2xl ring-2 ring-orange-400/20"
          >
            {/* Full-bleed rays+logo frame */}
            <div className="relative -m-4 md:-m-8">{/* cancel the p-4 / p-8 padding */}
              {/* Larger square rays+logo */}
              <div className="relative">
                <div className="relative aspect-square w-[8rem] md:w-[24rem] 2xl:w-[32rem]">
                  <LightRays

                    className="absolute inset-0 h-full w-full rounded-full pointer-events-none mix-blend-screen"
                    raysOrigin="top-center"
                    raysColor="#ffd700"
                    raysSpeed={1.2}
                    lightSpread={0.9}
                    rayLength={1.5}
                    followMouse
                    mouseInfluence={0.15}
                    noiseAmount={0.08}
                    distortion={0.03}
                    logoSrc={getProxiedLogoUrl(team.logo)}
                    logoStrength={1.8}
                    logoFit="cover"
                    // Note: logoScale in the shader is a zoom-OUT safety (0.1–1). 1.5 will clamp to 1.0.
                    logoScale={1.0}

                    /* New pop-in animation props */
                    popIn

                    popDuration={800}
                    popDelay={100}

                    popScaleFrom={0.85}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col">
          <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600 tracking-tight leading-tight">
            {team.name}
          </h1>
          <p className="mt-3 text-lg font-medium text-zinc-300">
            Established: {team.created_at ? new Date(team.created_at).toLocaleDateString() : "Unknown"}
          </p>
        </div>
      </div>
    </div>
  );
}