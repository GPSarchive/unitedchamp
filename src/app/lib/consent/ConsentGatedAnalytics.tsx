"use client";

import dynamic from "next/dynamic";
import { useConsent } from "./use-consent";

// Defer loading the Vercel SDK bundles entirely until consent is granted.
// Using dynamic() with ssr:false guarantees the modules aren't evaluated
// during SSR either — so no cookies or requests happen without consent.
const Analytics = dynamic(
  () => import("@vercel/analytics/next").then((m) => m.Analytics),
  { ssr: false }
);
const SpeedInsights = dynamic(
  () =>
    import("@vercel/speed-insights/next").then((m) => m.SpeedInsights),
  { ssr: false }
);

/**
 * Renders Vercel Analytics + Speed Insights only after the user grants
 * analytics consent. When consent is revoked, the components are unmounted
 * (not merely hidden) so the SDKs stop running.
 */
export default function ConsentGatedAnalytics() {
  const { state, ready } = useConsent();
  if (!ready || !state.analytics) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
