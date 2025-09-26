// app/components/common/ConfirmDialog.tsx
"use client";

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl">
        <h4 className="text-lg font-semibold text-white">{title}</h4>
        <p className="mt-2 text-sm text-white/70">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/30"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm rounded-md bg-amber-600 hover:bg-amber-500 text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
