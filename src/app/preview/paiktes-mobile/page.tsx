// Preview route — /paiktes with the phone layout (PaiktesLayoutProvider compact).
// Renders the live page component itself, so data loading, filters and
// pagination are identical; only the phone layout differs. Promote by enabling
// compact on /paiktes and deleting this route.
import type { Metadata } from "next";
import PaiktesPage from "@/app/paiktes/page";
import { PaiktesLayoutProvider } from "@/app/paiktes/paiktesLayout";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Παίκτες · προεπισκόπηση κινητού",
  robots: { index: false, follow: false },
};

export default function PaiktesMobilePreviewPage(props: Parameters<typeof PaiktesPage>[0]) {
  return (
    <PaiktesLayoutProvider compact>
      <PaiktesPage {...props} />
    </PaiktesLayoutProvider>
  );
}
