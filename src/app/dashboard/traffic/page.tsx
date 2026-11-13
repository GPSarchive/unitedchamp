// src/app/dashboard/traffic/page.tsx
// SERVER: «Κίνηση» — requests per IP address over the last 24 hours, built to
// spot programs copying the site.
//
// The signal is NOT timing. It is whether the requests came from a real
// browser: every current browser sends Sec-Fetch-* headers with every request,
// scripts (node, python-requests, curl, axios…) do not. Addresses whose
// requests mostly lack them are listed first, however often they come.
//
// Data: the rate limiter's per-IP hour counters (lib/rate-limit.ts,
// TRAFFIC_*), read by lib/traffic.ts. Kept 26 hours, then gone on their own.
//
// Access: admins. proxy.ts admits only logged-in admins to this path (it is
// not in the editor allow-list, lib/dashboardAccess.ts). Deliberately not in
// the dashboard menu or home cards — reached by direct link.
import { formatInstant } from "@/app/lib/datetime";
import { loadTraffic, TRAFFIC_HOURS } from "@/app/lib/traffic";
import { mostlyNotBrowser } from "@/app/lib/trafficSummary";
import { SEARCH_ENGINE_BOT_RE, SOCIAL_BOT_RE } from "@/app/lib/botAgents";

export const dynamic = "force-dynamic";

const hourLabel = (bucket: number) =>
  formatInstant(new Date(bucket * 3_600_000).toISOString(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

function claimedCrawler(ua: string | undefined): string | null {
  if (!ua) return null;
  if (SEARCH_ENGINE_BOT_RE.test(ua)) return "δηλώνει μηχανή αναζήτησης";
  if (SOCIAL_BOT_RE.test(ua)) return "δηλώνει προεπισκόπηση συνδέσμου";
  return null;
}

export default async function TrafficPage() {
  const snap = await loadTraffic();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold text-white">Κίνηση ανά διεύθυνση IP</h2>
        <p className="max-w-3xl text-sm text-white/70">
          Κάθε γραμμή είναι μία διεύθυνση IP. Πρώτες εμφανίζονται όσες έστειλαν τα
          περισσότερα αιτήματα <strong>χωρίς πρόγραμμα περιήγησης</strong>: κάθε σύγχρονο
          πρόγραμμα περιήγησης (Chrome, Safari, Firefox, Edge) στέλνει με κάθε αίτημα
          συγκεκριμένες κεφαλίδες, ενώ τα προγράμματα αντιγραφής συνήθως όχι. Δεν έχει
          σημασία πότε ή πόσο συχνά ήρθαν.
        </p>
        <p className="max-w-3xl text-xs text-white/50">
          Περιορισμοί: μετριούνται μόνο αιτήματα προς τον ιστότοπο — όποιος διαβάζει
          απευθείας από τη βάση (Supabase) δεν φαίνεται εδώ. Ένα πρόγραμμα που οδηγεί
          κανονικό πρόγραμμα περιήγησης (headless Chrome) μοιάζει με επισκέπτη· τότε βοηθούν
          ο πάροχος (σύνδεσμος στη διεύθυνση) και ο όγκος. Οι διευθύνσεις διαγράφονται
          αυτόματα μετά από 26 ώρες.
        </p>
      </header>

      {snap.state === "off" ? (
        <div className="rounded-2xl border border-dashed border-white/20 p-6 text-sm text-white/70">
          <p className="font-semibold text-white">Δεν υπάρχουν δεδομένα.</p>
          <p className="mt-1">{snap.reason}</p>
        </div>
      ) : snap.rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 p-6 text-sm text-white/70">
          <p className="font-semibold text-white">Δεν έχει καταγραφεί κίνηση ακόμη.</p>
          <p className="mt-1">
            Η καταγραφή ξεκινά με την πρώτη επίσκεψη μετά την ανάρτηση αυτής της έκδοσης. Στο
            τοπικό περιβάλλον (development) είναι απενεργοποιημένη.
          </p>
        </div>
      ) : (
        <>
          <section className="flex flex-wrap gap-3 text-sm">
            <Stat label="Διευθύνσεις (24 ώρες)" value={snap.uniqueIps} />
            <Stat label="Αιτήματα (24 ώρες)" value={snap.totalRequests} />
            <Stat label="Χωρίς πρόγραμμα περιήγησης" value={snap.noBrowserRequests} />
          </section>

          <div className="flex flex-wrap items-center gap-4 text-xs text-white/60">
            <Legend color="rgba(16,185,129,0.9)" label="ώρα μόνο με πρόγραμμα περιήγησης" />
            <Legend color="rgba(245,158,11,0.95)" label="ώρα με αιτήματα χωρίς πρόγραμμα περιήγησης" />
          </div>

          <section className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-xs text-white/50">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2 font-medium">Διεύθυνση IP</th>
                  <th className="px-3 py-2 font-medium">Χωρίς πρόγρ. περιήγησης</th>
                  <th className="px-3 py-2 font-medium">Αιτήματα</th>
                  <th className="px-3 py-2 font-medium">
                    <HourAxis nowBucket={snap.nowBucket} />
                  </th>
                  <th className="px-3 py-2 font-medium">Τι δηλώνει / τι ζήτησε</th>
                </tr>
              </thead>
              <tbody>
                {snap.rows.map((r) => {
                  const suspect = mostlyNotBrowser(r);
                  const claim = claimedCrawler(r.note?.ua);
                  const peak = Math.max(...r.hours);
                  return (
                    <tr
                      key={r.ip}
                      className={`border-b border-white/5 align-top ${suspect ? "bg-amber-500/10" : ""}`}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-white">
                        <a
                          href={`https://ipinfo.io/${encodeURIComponent(r.ip)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline decoration-white/30 hover:decoration-white"
                          title="Ποιος είναι ο πάροχος αυτής της διεύθυνσης (ipinfo.io)"
                        >
                          {r.ip}
                        </a>
                        {suspect && (
                          <div className="mt-1 font-sans text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                            όχι πρόγραμμα περιήγησης
                          </div>
                        )}
                        {claim && (
                          <div className="mt-1 font-sans text-[10px] text-white/50">{claim}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-white">
                        {r.noBrowser}
                        <span className="text-white/40"> ({Math.round((100 * r.noBrowser) / r.total)}%)</span>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-white/80">{r.total}</td>
                      <td className="px-3 py-2">
                        <div className="flex gap-[2px]">
                          {r.hours.map((c, i) => {
                            const nb = r.noBrowserHours[i];
                            const bucket = snap.nowBucket - TRAFFIC_HOURS + 1 + i;
                            const strength = c > 0 ? 0.3 + 0.7 * (c / peak) : 0;
                            return (
                              <span
                                key={i}
                                title={`${hourLabel(bucket)} · ${c} αιτήματα, ${nb} χωρίς πρόγραμμα περιήγησης`}
                                className="h-5 w-3 rounded-[2px]"
                                style={{
                                  background:
                                    c === 0
                                      ? "rgba(255,255,255,0.06)"
                                      : nb > 0
                                        ? `rgba(245,158,11,${strength})`
                                        : `rgba(16,185,129,${strength})`,
                                }}
                              />
                            );
                          })}
                        </div>
                      </td>
                      <td className="max-w-[320px] px-3 py-2 text-xs text-white/70">
                        {r.note ? (
                          <>
                            <div className="break-words font-mono">{r.note.ua || "(κενό)"}</div>
                            <div className="mt-1 break-all font-mono text-white/45">{r.note.path}</div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <p className="text-xs text-white/50">
            Εμφανίζονται έως 100 διευθύνσεις. Η στήλη «Τι δηλώνει» είναι το όνομα που στέλνει ο
            ίδιος ο επισκέπτης και μπορεί να είναι ψεύτικο· όπου υπάρχει αίτημα χωρίς πρόγραμμα
            περιήγησης, δείχνει αυτό. Οι γνήσιες μηχανές αναζήτησης και οι προεπισκοπήσεις
            συνδέσμων (Facebook, WhatsApp κ.λπ.) εμφανίζονται κι αυτές εδώ — ελέγξτε τον πάροχο
            πριν μπλοκάρετε («Google»/«Meta» = γνήσια· «Amazon», «Hetzner» κ.λπ. = server).
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950 px-4 py-3">
      <div className="text-xs text-white/50">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-[2px]" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Hour labels above the strip: one every 6 hours, aligned to the cells. */
function HourAxis({ nowBucket }: { nowBucket: number }) {
  return (
    <div className="flex gap-[2px]">
      {Array.from({ length: TRAFFIC_HOURS }, (_, i) => {
        const bucket = nowBucket - TRAFFIC_HOURS + 1 + i;
        const show = (TRAFFIC_HOURS - 1 - i) % 6 === 0;
        return (
          <span key={i} className="relative w-3">
            {show && (
              <span className="absolute left-0 top-0 whitespace-nowrap text-[10px] font-normal">
                {hourLabel(bucket)}
              </span>
            )}
          </span>
        );
      })}
      <span className="invisible text-[10px]">00:00</span>
    </div>
  );
}
