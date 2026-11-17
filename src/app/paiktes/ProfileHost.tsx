// The player profile overlay for any page with the new player cards (the
// match page…), not just the players list. Wrap the page in <ProfileHost> and
// each card in <ProfileTrigger>; clicking a card throws it into the profile,
// exactly as on the players page.
//
// The players page has the whole season in the browser; other pages do not, so
// the profile is fetched on click (and already on hover / touch, so it is
// usually there by the time the click lands) from
// /api/public/player-profile/[id]. While it loads, the clicked card pulses.
//
// The open profile is part of the URL (?player=ID, next to whatever the page
// already has there), so it can be shared, and the browser's back button
// closes it.
"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { PlayerProfile } from "./profile";
import ProfileOverlay from "./ProfileOverlay";

/** Marks the card inside a trigger: the part that flies. Without one, the whole trigger flies. */
export const PROFILE_CARD_ATTR = "data-profile-card";

/** A load slower than this shows the pulse on the clicked card. */
const PENDING_DELAY_MS = 140;
/** A pointer resting this long on a card starts loading its profile. */
const HOVER_INTENT_MS = 90;

type Opener = {
  open: (playerId: number, trigger: HTMLElement) => void;
  prefetch: (playerId: number) => void;
};

const ProfileContext = createContext<Opener | null>(null);

type Shown = {
  profile: PlayerProfile;
  origin: DOMRect | null;
  /** The card that was clicked (hidden while its profile is open), and its link. */
  card: HTMLElement | null;
  trigger: HTMLElement | null;
};

const playerInUrl = (): number | null => {
  const raw = new URLSearchParams(window.location.search).get("player");
  const id = Number(raw);
  return raw && Number.isSafeInteger(id) && id > 0 ? id : null;
};

/** This page's URL with ?player= set or removed; every other parameter stays. */
const urlWith = (playerId: number | null): string => {
  const url = new URL(window.location.href);
  if (playerId == null) url.searchParams.delete("player");
  else url.searchParams.set("player", String(playerId));
  return url.pathname + url.search + url.hash;
};

const cardIn = (trigger: HTMLElement): HTMLElement =>
  trigger.querySelector<HTMLElement>(`[${PROFILE_CARD_ATTR}]`) ?? trigger;

const onScreen = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight;
};

/** A card of this player on the page, to fly back to when the profile was opened by link. */
function findCard(playerId: number): HTMLElement | null {
  const cards = Array.from(document.querySelectorAll<HTMLElement>(`[data-profile-player="${playerId}"]`)).map(cardIn);
  return cards.find(onScreen) ?? cards[0] ?? null;
}

export function ProfileHost({ children }: { children: React.ReactNode }) {
  // Profiles asked for so far. A failed request is forgotten, so a later click retries.
  const requests = useRef(new Map<number, Promise<PlayerProfile | null>>());
  const loaded = useRef(new Map<number, PlayerProfile>());

  const load = useCallback((playerId: number): Promise<PlayerProfile | null> => {
    const known = requests.current.get(playerId);
    if (known) return known;
    const request = fetch(`/api/public/player-profile/${playerId}`)
      .then((res) => (res.ok ? (res.json() as Promise<PlayerProfile>) : null))
      .catch(() => null)
      .then((profile) => {
        if (profile) loaded.current.set(playerId, profile);
        else requests.current.delete(playerId);
        return profile;
      });
    requests.current.set(playerId, request);
    return request;
  }, []);

  const [shown, setShown] = useState<Shown | null>(null);
  const [closing, setClosing] = useState(false);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  /** True when the open profile sits on a history entry of its own. */
  const ownEntryRef = useRef(false);
  /** Bumped by every open and close: a load that finishes after it was overtaken is dropped. */
  const turnRef = useRef(0);

  const show = useCallback((profile: PlayerProfile, trigger: HTMLElement | null) => {
    const card = trigger ? cardIn(trigger) : null;
    const origin = card?.getBoundingClientRect() ?? null;
    // The clicked card leaves its place while it is out flying.
    if (card) card.style.visibility = "hidden";
    setClosing(false);
    setShown({ profile, origin, card, trigger });
  }, []);

  const open = useCallback(
    (playerId: number, trigger: HTMLElement) => {
      if (shownRef.current) return;
      const turn = ++turnRef.current;
      const ready = loaded.current.get(playerId);
      if (ready) {
        show(ready, trigger);
        window.history.pushState(null, "", urlWith(playerId));
        ownEntryRef.current = true;
        return;
      }
      const pulse = window.setTimeout(() => trigger.setAttribute("data-profile-pending", ""), PENDING_DELAY_MS);
      void load(playerId).then((profile) => {
        window.clearTimeout(pulse);
        trigger.removeAttribute("data-profile-pending");
        if (turn !== turnRef.current || shownRef.current) return;
        if (!profile) {
          // No profile to show here: follow the card's link instead — unless
          // it leads back to this very page, which would only reload it.
          const href = trigger.getAttribute("href");
          if (href && new URL(href, window.location.href).pathname !== window.location.pathname) {
            window.location.assign(href);
          }
          return;
        }
        show(profile, trigger);
        window.history.pushState(null, "", urlWith(playerId));
        ownEntryRef.current = true;
      });
    },
    [load, show],
  );

  /** Opened by the URL (a shared link, or the forward button): no card to come from. */
  const openFromUrl = useCallback(
    (playerId: number) => {
      const turn = ++turnRef.current;
      void load(playerId).then((profile) => {
        if (turn !== turnRef.current) return;
        if (profile) show(profile, null);
        else window.history.replaceState(window.history.state, "", urlWith(null));
      });
    },
    [load, show],
  );

  const requestClose = useCallback(() => {
    if (!shownRef.current) return;
    if (ownEntryRef.current) {
      // Back to the page's own entry; `popstate` below starts the way out.
      ownEntryRef.current = false;
      window.history.back();
    } else {
      window.history.replaceState(window.history.state, "", urlWith(null));
      setClosing(true);
    }
  }, []);

  // A profile named in the address when the page loads opens straight away.
  useEffect(() => {
    const id = playerInUrl();
    if (id != null) openFromUrl(id);
  }, [openFromUrl]);

  // Back / forward buttons open and close the profile.
  useEffect(() => {
    const onPopState = () => {
      const id = playerInUrl();
      const current = shownRef.current;
      if (id != null) {
        ownEntryRef.current = true;
        if (current?.profile.player.id === id) setClosing(false);
        else if (!current) openFromUrl(id);
      } else {
        turnRef.current++;
        ownEntryRef.current = false;
        if (current) setClosing(true);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [openFromUrl]);

  const onExited = useCallback(() => {
    const current = shownRef.current;
    if (current?.card) current.card.style.visibility = "";
    setShown(null);
    setClosing(false);
    if (current?.trigger?.isConnected) current.trigger.focus({ preventScroll: true });
  }, []);

  const returnTarget = useCallback(() => {
    const current = shownRef.current;
    if (!current) return null;
    if (current.card?.isConnected) return current.card;
    return findCard(current.profile.player.id);
  }, []);

  const opener = useRef<Opener>({ open, prefetch: (id) => void load(id) });
  opener.current.open = open;

  return (
    <ProfileContext.Provider value={opener.current}>
      {children}
      {shown ? (
        <ProfileOverlay
          key={shown.profile.player.id}
          profile={shown.profile}
          origin={shown.origin}
          originCard={shown.card}
          returnTarget={returnTarget}
          closing={closing}
          onRequestClose={requestClose}
          onExited={onExited}
        />
      ) : null}
    </ProfileContext.Provider>
  );
}

/**
 * A player card (or a row built around one) that opens the player's profile.
 * Mark the card itself with `data-profile-card` so that is what flies; the
 * rest of the trigger (name, numbers) stays put.
 *
 * A real link underneath: "open in new tab" and friends go to `href`, and so
 * does a click when there is no profile to show. Outside a <ProfileHost> it is
 * just that link.
 */
export function ProfileTrigger({
  playerId,
  href,
  className,
  label,
  children,
}: {
  playerId: number;
  href: string;
  className?: string;
  /** Accessible name, when the visible content does not say whose profile this is. */
  label?: string;
  children: React.ReactNode;
}) {
  const opener = useContext(ProfileContext);
  const ref = useRef<HTMLAnchorElement | null>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  if (!opener) {
    return (
      <a href={href} className={className} aria-label={label}>
        {children}
      </a>
    );
  }

  return (
    <a
      ref={ref}
      href={href}
      aria-label={label}
      aria-haspopup="dialog"
      data-profile-player={playerId}
      className={`${className ?? ""} data-[profile-pending]:animate-pulse`}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        window.clearTimeout(hoverTimer.current);
        hoverTimer.current = window.setTimeout(() => opener.prefetch(playerId), HOVER_INTENT_MS);
      }}
      onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
      onPointerDown={() => opener.prefetch(playerId)}
      onClick={(e) => {
        // Let the browser handle "open in new tab" and friends.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        if (ref.current) opener.open(playerId, ref.current);
      }}
    >
      {children}
    </a>
  );
}
