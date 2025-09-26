"use client";
import React, { useEffect, useState } from "react";

export default function PlayerPhoto({
  bucket = "GPSarchive's Project",
  path,
  alt,
  className,
}: {
  bucket?: string;
  path: string | null | undefined; // storage object path, e.g. "players/uuid.jpg"
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function run() {
      if (!path) return;
      const u = new URL("/api/storage/sign", window.location.origin);
      u.searchParams.set("bucket", bucket);
      u.searchParams.set("path", path);
      const res = await fetch(u.toString(), { credentials: "include" });
      const data = await res.json();
      if (!ignore) setUrl(data?.signedUrl ?? null);
    }
    run();
    return () => {
      ignore = true;
    };
  }, [bucket, path]);

  if (!path || !url) return null;
  return <img src={url} alt={alt} className={className} />;
}
