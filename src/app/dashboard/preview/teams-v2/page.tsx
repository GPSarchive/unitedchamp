// src/app/dashboard/preview/teams-v2/page.tsx
import MobileTeamsView from "./MobileTeamsView";

export const dynamic = "force-dynamic";

export default function TeamsV2PreviewPage() {
  return (
    <div className="-mx-4 -my-6 sm:mx-0 sm:my-0">
      <MobileTeamsView />
    </div>
  );
}
