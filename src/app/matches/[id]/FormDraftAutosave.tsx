// src/app/matches/[id]/FormDraftAutosave.tsx
"use client";

import * as React from "react";

type Props = { formId: string; matchId: number };

const KEY = (id: number) => `match:${id}:stats-draft:v1`;

function formToPairs(form: HTMLFormElement) {
  const fd = new FormData(form);
  const out: [string, string][] = [];
  for (const [k, v] of fd.entries()) {
    // ignore files
    if (v instanceof File) continue;
    out.push([k, v]);
  }
  return out;
}

function applyPairs(form: HTMLFormElement, pairs: [string, string][]) {
  const byName = new Map<string, HTMLInputElement[]>();
  form
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input, textarea, select"
    )
    .forEach((el) => {
      const n = el.getAttribute("name");
      if (!n) return;
      if (!byName.has(n)) byName.set(n, []);
      (byName.get(n) as any).push(el);
    });

  for (const [name, value] of pairs) {
    const els = byName.get(name);
    if (!els) continue;

    for (const el of els) {
      const t = (el as HTMLInputElement).type;
      if (t === "checkbox") {
        const checked = value === "true" || value === "on" || value === "1";
        (el as HTMLInputElement).checked = checked;
        el.dispatchEvent(new Event("input", { bubbles: true })); // keep controlled bits in sync
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (t === "radio") {
        (el as HTMLInputElement).checked = (el as HTMLInputElement).value === value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
        (el as HTMLInputElement).value = value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  }
}

export default function FormDraftAutosave({ formId, matchId }: Props) {
  const key = React.useMemo(() => KEY(matchId), [matchId]);

  React.useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    // Restore (if any)
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const pairs = JSON.parse(raw) as [string, string][];
        applyPairs(form, pairs);
      }
    } catch {}

    let t = 0 as number;
    const onAnyInput = () => {
      if (t) cancelAnimationFrame(t);
      t = requestAnimationFrame(() => {
        try {
          const pairs = formToPairs(form);
          localStorage.setItem(key, JSON.stringify(pairs));
        } catch {}
      });
    };

    form.addEventListener("input", onAnyInput);
    form.addEventListener("change", onAnyInput);

    // Clear draft after a successful submit navigation
    const onSubmit = () => {
      // leave a one-shot backup for the next load in case of server error
      try { sessionStorage.setItem(`${key}:backup`, localStorage.getItem(key) || ""); } catch {}
      // optimistic clear; if needed we restore from backup on next mount
      try { localStorage.removeItem(key); } catch {}
    };
    form.addEventListener("submit", onSubmit);

    // If we re-mounted after submit and still on the same page,
    // drop the backup; if an error page used it, it can rehydrate.
    try { sessionStorage.removeItem(`${key}:backup`); } catch {}

    return () => {
      form.removeEventListener("input", onAnyInput);
      form.removeEventListener("change", onAnyInput);
      form.removeEventListener("submit", onSubmit);
      if (t) cancelAnimationFrame(t);
    };
  }, [key, formId]);

  return null;
}
