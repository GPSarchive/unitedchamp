// src/app/dashboard/preview/player-list-mobile/page.tsx
import MobilePlayersView from "./MobilePlayersView";

export const dynamic = "force-dynamic";

export default function PlayerListMobilePreviewPage() {
  return (
    <div className="-mx-4 -my-6 sm:mx-0 sm:my-0">
      <MobilePlayersView />
    </div>
  );
}
