"use client";

import { helperText } from "./tokens";

export default function Field({
  label,
  helper,
  error,
  children,
  className = "",
}: {
  label: string;
  helper?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-zinc-300">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-rose-400">{error}</span>
      ) : helper ? (
        <span className={`${helperText} block`}>{helper}</span>
      ) : null}
    </label>
  );
}
