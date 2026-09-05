//PlayerEditorDrawer.tsx
"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { clsx } from "../teams/teamHelpers";
import type { PlayerWithStats, PlayerFormPayload } from "./types";
import PlayerPhoto from "./PlayerPhoto";

type Props = {
  open: boolean;
  onClose: () => void;
  player: PlayerWithStats | null; // αν είναι null => δημιουργία
  onSubmit: (payload: PlayerFormPayload) => Promise<void> | void;
};

// Το τρέχον bucket id
const BUCKET = "GPSarchive's Project";

// Βοηθητική για να δημιουργούμε ασφαλές slug φακέλου
function slugify(input: string) {
  return input
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function UploadButton({
  onUploaded,
  dirName,
}: {
  onUploaded: (path: string) => void;
  dirName: string; // ΝΕΟ: όνομα φακέλου προορισμού (π.χ. "john-doe-42")
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile() {
    inputRef.current?.click();
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // 1) Μόνο για διαχειριστές: πάρε υπογεγραμμένο URL μεταφόρτωσης (με φάκελο)
      const res = await fetch("/api/storage/signed-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          contentType: file.type,
          bucket: BUCKET,
          dirName, // ΝΕΟ: ζήτα από τον server να βάλει το αρχείο κάτω από players/<dirName>/
        }),
      });
      const { signedUrl, path, error } = await res.json();
      if (!res.ok) throw new Error(error || "Αποτυχία λήψης υπογεγραμμένου URL μεταφόρτωσης");

      // 2) Ανέβασε στο storage
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "x-upsert": "false", "content-type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Η μεταφόρτωση απέτυχε");

      // 3) Αποθήκευσε την διαδρομή στο storage
      onUploaded(path);
    } catch (err: any) {
      alert(err?.message || String(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={pickFile}
        className="px-3 py-2 rounded-lg border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60"
      >
        {uploading ? "Μεταφόρτωση…" : "Μεταφόρτωση"}
      </button>
    </>
  );
}

function DeletePhotoButton({
  path,
  onDeleted,
}: {
  path: string;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!path) return;
    const ok = confirm("Να διαγραφεί αυτή η φωτογραφία από την αποθήκευση και να καθαριστεί το πεδίο;");
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/storage/delete-object", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ bucket: BUCKET, path }),
      });
      const { error } = await res.json();
      if (!res.ok) throw new Error(error || "Η διαγραφή απέτυχε");
      onDeleted();
    } catch (err: any) {
      alert(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className="px-3 py-2 rounded-lg border border-red-400/40 text-red-200 bg-red-900/30 hover:bg-red-900/50 disabled:opacity-60"
      title="Διαγραφή αρχείου από την αποθήκευση και εκκαθάριση"
    >
      {busy ? "Διαγραφή…" : "Διαγραφή φωτογραφίας"}
    </button>
  );
}

export default function PlayerEditorDrawer({ open, onClose, player, onSubmit }: Props) {
  const isEdit = !!player?.id;
  const s = player?.player_statistics?.[0];
  // ACTIVE season numbers (read-only here: they come from the matches)
  const ss = player?.season_stats ?? null;

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [age, setAge] = useState<string>("");

  // ΝΕΑ πεδία
  const [photo, setPhoto] = useState(""); // διαδρομή αποθήκευσης (ιδιωτικό bucket)
  const [height, setHeight] = useState("");
  const [position, setPosition] = useState("");
  const [birth, setBirth] = useState("");
  const [playerNumber, setPlayerNumber] = useState("");

  // Υπολογισμός ονόματος φακέλου για μεταφορτώσεις (π.χ. "john-doe-12")
  const dirName = useMemo(() => {
    const name = slugify(`${first} ${last}`.trim());
    return [name, isEdit ? String(player?.id ?? "") : ""].filter(Boolean).join("-");
  }, [first, last, isEdit, player?.id]);

  useEffect(() => {
    if (!open) return;

    // Βασικά στοιχεία
    setFirst(player?.first_name ?? "");
    setLast(player?.last_name ?? "");

    // Ηλικία (χειροκίνητη, legacy). Τα νούμερα δεν επεξεργάζονται εδώ.
    setAge(s?.age == null ? "" : String(s.age));

    // Εκτεταμένα πεδία παίκτη
    setPhoto(player?.photo ?? ""); // διαδρομή
    setHeight(player?.height_cm == null ? "" : String(player.height_cm));
    setPosition(player?.position ?? "");
    setBirth(player?.birth_date ? String(player.birth_date).slice(0, 10) : "");
    setPlayerNumber(player?.player_number == null ? "" : String(player.player_number));
  }, [open, player?.id]);

  const valid = useMemo(() => first.trim() && last.trim(), [first, last]);

  async function handleSave() {
    if (!valid) return;

    const payload: PlayerFormPayload = {
      first_name: first.trim(),
      last_name: last.trim(),
      age: age === "" ? null : Number(age),

      // ΝΕΑ πεδία
      photo: photo.trim() || null, // διαδρομή αποθήκευσης
      height_cm: height === "" ? null : Number(height),
      position: position.trim() || null,
      birth_date: birth ? new Date(birth).toISOString() : null,
      player_number: playerNumber === "" ? null : Number(playerNumber),
    };

    await onSubmit(payload);
    onClose();
  }

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50 transition",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      {/* Φόντο */}
      <div
        className={clsx(
          "absolute inset-0 bg-black/50 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Συρτάρι */}
      <div
        className={clsx(
          "absolute right-0 top-0 h-full w-full sm:w-[520px] bg-zinc-950/95 backdrop-blur border-l border-white/10 shadow-2xl transition-transform",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="font-semibold text-white">
            {isEdit ? "Επεξεργασία παίκτη" : "Δημιουργία παίκτη"}
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded-lg bg-zinc-900 text-white border border-white/10"
          >
            Κλείσιμο
          </button>
        </div>

        {/* Σώμα (Scrollable part) */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[80vh]">
          {/* Ονόματα */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Όνομα</span>
            <input
              value={first}
              onChange={(e) => setFirst(e.target.value)}
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Επώνυμο</span>
            <input
              value={last}
              onChange={(e) => setLast(e.target.value)}
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
            />
          </label>

          {/* Βασικά στατιστικά */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Ηλικία</span>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              inputMode="numeric"
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="π.χ. 23"
            />
          </label>
          <div className="sm:col-span-2 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2 text-sm">
            <div className="text-white/60">
              Στατιστικά σεζόν{ss ? ` ${ss.season_label}` : ""}{" "}
              <span className="text-white/40">(από τους αγώνες· δεν επεξεργάζονται εδώ)</span>
            </div>
            {ss ? (
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-white/85">
                <span>Αγ. {ss.matches}</span>
                <span>Γκολ {ss.goals}</span>
                <span>Ασίστ {ss.assists}</span>
                <span>ΚΚ {ss.yellow_cards}</span>
                <span>ΚΟΚ {ss.red_cards}</span>
                <span>ΜΠΛ {ss.blue_cards}</span>
                <span>MVP {ss.mvp_count}</span>
              </div>
            ) : (
              <div className="mt-1 text-white/45">Χωρίς συμμετοχή στην τρέχουσα σεζόν.</div>
            )}
          </div>

          {/* Εκτεταμένο βιογραφικό & μεταδεδομένα */}
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-sm text-white/80">Φωτογραφία</span>

            {/* προεπισκόπηση μέσω signed URL (ιδιωτικό bucket) */}
            {photo ? (
              <PlayerPhoto
                bucket={BUCKET}
                path={photo}
                alt="Προεπισκόπηση"
                className="h-24 w-24 object-cover rounded-lg border border-white/10 mb-2"
              />
            ) : null}

            <div className="flex items-center gap-2">
              <input
                value={photo}
                onChange={(e) => setPhoto(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
                placeholder="players/john-doe-12/uuid.jpg"
              />
              {/* περνάμε το dirName ώστε οι μεταφορτώσεις να πηγαίνουν κάτω από players/<dirName>/ */}
              <UploadButton onUploaded={(path) => setPhoto(path)} dirName={dirName} />
              {photo ? (
                <DeletePhotoButton path={photo} onDeleted={() => setPhoto("")} />
              ) : null}
            </div>

            <p className="text-xs text-white/50">
              Οι μεταφορτώσεις θα αποθηκεύονται κάτω από <span className="font-mono">players/{dirName || "&lt;auto&gt;"}/</span>.
            </p>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Ύψος (cm)</span>
            <input
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              inputMode="numeric"
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="π.χ. 178"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Θέση</span>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="π.χ. RW"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Ημερομηνία γέννησης</span>
            <input
              type="date"
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Αριθμός φανέλας</span>
            <input
              value={playerNumber}
              onChange={(e) => setPlayerNumber(e.target.value)}
              inputMode="numeric"
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="π.χ. 10"
            />
          </label>

          {/* Ενέργειες */}
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-white/15 text-white bg-transparent hover:bg-white/5"
            >
              Άκυρο
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!valid}
              className={clsx(
                "px-3 py-2 rounded-lg border text-white",
                valid
                  ? "border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50"
                  : "border-white/15 bg-zinc-900 opacity-60"
              )}
            >
              {isEdit ? "Αποθήκευση αλλαγών" : "Δημιουργία παίκτη"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
