"use client";

// Sign-in screen. Signed out: one «Συνέχεια με Google» button, the only way
// in (staff included). Signed in (a player, not staff): a teaser line and the
// way back to the home page; there is no player area yet.
//
// The intro (crest and sheen) plays once and hands over to the screen
// underneath. Any click, tap or key press skips it; with reduced motion it is
// not shown at all.
import { useEffect, useState } from "react";

const INTRO_MS = 1450;

function Crest({ sheen = false }: { sheen?: boolean }) {
  return (
    <div className="lv2-crest">
      <div className="lv2-glow" />
      <div className="lv2-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/UltraChampLogo3.png" alt="" width={1213} height={1400} />
        {sheen ? <div className="lv2-sheen" /> : null}
      </div>
    </div>
  );
}

function useIntro() {
  const [phase, setPhase] = useState<"intro" | "ready">("intro");
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("ready");
      return;
    }
    const finish = () => setPhase("ready");
    const timer = window.setTimeout(finish, INTRO_MS);
    window.addEventListener("pointerdown", finish, { once: true });
    window.addEventListener("keydown", finish, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", finish);
      window.removeEventListener("keydown", finish);
    };
  }, []);
  return phase;
}

export default function LoginScreen(
  props:
    | { signedIn: true }
    | {
        signedIn: false;
        /** Where the visitor was going; passed through untouched, the server routes validate it. */
        next: string;
        error: string | null;
        inAppBrowser: boolean;
      },
) {
  const phase = useIntro();

  return (
    <div className="lv2-root" data-phase={phase}>
      <div className="lv2-intro" aria-hidden="true">
        <Crest sheen />
      </div>

      <main className="lv2-final">
        <div className="lv2-brand">
          <div className="lv2-rise">
            <Crest />
            <h1 className="lv2-sr">{props.signedIn ? "Ultrachamp" : "Σύνδεση στο Ultrachamp"}</h1>
          </div>
        </div>

        {props.signedIn ? <Teaser /> : <SignIn {...props} />}
      </main>
    </div>
  );
}

function Teaser() {
  return (
    <>
      <div className="lv2-tease">
        <p className="lv2-tease-title">Είσαι μέσα.</p>
        <p className="lv2-tease-sub">Η αντίστροφη μέτρηση άρχισε, έρχεται σύντομα.</p>
      </div>

      <div className="lv2-form lv2-rise">
        <a className="lv2-btn" href="/">
          Στην αρχική
        </a>
        <div className="lv2-signout">
          <form method="post" action="/api/auth/sign-out">
            <button type="submit" className="lv2-toggle">
              Αποσύνδεση
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

function SignIn({ next, error, inAppBrowser }: { next: string; error: string | null; inAppBrowser: boolean }) {
  const [copied, setCopied] = useState(false);

  const nextQS = next ? `&next=${encodeURIComponent(next)}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      window.prompt("Αντίγραψε τον σύνδεσμο:", window.location.href);
    }
  };

  return (
    <div className="lv2-form lv2-rise">
      {error ? (
        <p className="lv2-error" role="alert">
          {error}
        </p>
      ) : null}

      {inAppBrowser ? (
        <>
          <p className="lv2-note">
            Η Google δεν επιτρέπει σύνδεση μέσα από εφαρμογές όπως το Instagram ή το Viber. Άνοιξε αυτή τη σελίδα στο
            Safari ή στο Chrome: αντίγραψε τον σύνδεσμο και επικόλλησέ τον εκεί.
          </p>
          <button type="button" className="lv2-btn" onClick={copyLink}>
            Αντιγραφή συνδέσμου
          </button>
          <p className="lv2-msg" role="status">
            {copied ? "Ο σύνδεσμος αντιγράφηκε." : ""}
          </p>
        </>
      ) : (
        <a className="lv2-btn" href={`/api/auth/oauth?provider=google${nextQS}`}>
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
            <path
              fill="#FFC107"
              d="M44.5 20H24v8.5h11.8C34.4 32.9 30 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l6-6C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.3-.1-2.3-.5-4z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l7 5.1C14.9 16.3 19.1 12 24 12c3.1 0 5.9 1.2 8 3.1l6-6C34.6 5.1 29.6 3 24 3 16 3 8.8 7.6 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 45c5.4 0 10.4-2.1 14.1-5.6l-6.5-5.3C29.4 36 26.9 37 24 37c-6 0-10.9-4.1-12.3-9.6l-7.2 5.6C7.9 40.4 15.4 45 24 45z"
            />
            <path
              fill="#1976D2"
              d="M44.5 20H24v8.5h11.8c-.6 2.9-2.4 5.4-4.9 7.1l6.5 5.3c-.5.5 7.6-5 7.6-16.9 0-1.3-.1-2.3-.5-4z"
            />
          </svg>
          Συνέχεια με Google
        </a>
      )}
    </div>
  );
}
