// The backdrop of the sign-in screen: the site's flat layered look at page
// size. One flat panel on the ground, with two sheets in the yellow of the
// crest showing under its bottom edge. Pure CSS (login.css), no motion.
// Decorative: hidden from assistive technology.
export default function AuthBackdrop() {
  return (
    <div className="auth-backdrop" aria-hidden="true">
      <div className="auth-panel" />
    </div>
  );
}
