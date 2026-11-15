// app/dashboard/protathlites/page.tsx — «Πρωταθλητές»: special card skins
// for whole teams or single players, with the photo framing of every card.
// Admin-only: the dashboard layout lets editors in, the proxy keeps them out
// of this section (it is not in EDITOR_DASHBOARD_SECTIONS), and every server
// action re-checks the role.

import { loadProtathlitesData } from "./data";
import ProtathlitesClient from "./ProtathlitesClient";

export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await loadProtathlitesData();
  return <ProtathlitesClient {...data} />;
}
