// The backdrop of the sign-in screen: black under three slow colour fields
// (amber top-left, maroon low in the centre, a warm haze on the right), a
// vignette and film grain. Pure CSS (login.css), so it renders on the server
// and stays still under prefers-reduced-motion. Decorative: hidden from
// assistive technology.
export default function AuthBackdrop() {
  return (
    <div className="auth-backdrop" aria-hidden="true">
      <div className="auth-field auth-field-amber" />
      <div className="auth-field auth-field-maroon" />
      <div className="auth-field auth-field-haze" />
      <div className="auth-vignette" />
      <div className="auth-grain" />
    </div>
  );
}
