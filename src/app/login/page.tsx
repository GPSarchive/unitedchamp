// /login. Google is the only way in. Signed out: the sign-in screen. Signed in as staff: on to the
// dashboard (or `next`). Signed in as anyone else: the teaser, since players
// have no area of their own yet. The OAuth callback sends a fresh non-staff
// sign-in here too.
import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseRSCClient } from "@/app/lib/supabase/supabaseServer";
import { isStaff } from "@/app/lib/supabase/apiAuth";
import { safeNextUrl } from "@/app/lib/safe-redirect";
import AuthBackdrop from "./AuthBackdrop";
import { authFontClass } from "./fonts";
import LoginScreen from "./LoginScreen";
import "./login.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Σύνδεση | UltraChamp",
  robots: { index: false, follow: false },
};

/** In-app browsers, where Google answers disallowed_useragent. */
const IN_APP_BROWSER = /Instagram|FBAN|FBAV|FB_IAB|Messenger|Viber|Line\/|musical_ly|BytedanceWebview|TikTok|Snapchat|; wv\)/i;

/** The auth routes report errors in English; show the known ones in Greek. */
const ERROR_TEXT: Record<string, string> = {
  "Authentication failed": "Η σύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.",
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = first(params.next) ?? "";

  const supabase = await createSupabaseRSCClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isStaff(user)) redirect(safeNextUrl(next, "/dashboard"));

  const rawError = first(params.error)?.slice(0, 200) ?? null;
  const userAgent = (await headers()).get("user-agent") ?? "";

  return (
    <div className={`auth lv2 ${authFontClass}`}>
      <AuthBackdrop />
      {user ? (
        <LoginScreen signedIn />
      ) : (
        <LoginScreen
          signedIn={false}
          next={next}
          error={rawError ? (ERROR_TEXT[rawError] ?? rawError) : null}
          inAppBrowser={IN_APP_BROWSER.test(userAgent)}
        />
      )}
    </div>
  );
}
