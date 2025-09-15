export type Option = {
  id: number | null;
  label: string;
  disabled: boolean;
  reason?: string;
};

export default function SelectRow({
  value,
  options,
  placeholder,
  onChange,
  selectedSeed,         // optional: show seed chip
  selectedName,         // optional: show name in placeholder/chip if you use it elsewhere
  selectedLogo,         // optional: show logo if you render it
  disabled = false,     // ✅ NEW
}: {
  value: number | null;
  options: Option[];
  placeholder: string;
  onChange: (v: number | null) => void;
  selectedSeed?: number | null;
  selectedName?: string;
  selectedLogo?: string | null;
  disabled?: boolean;   // ✅ NEW
}) {
  const uiValue = value == null ? "" : String(value);

  return (
    <div className="flex items-center gap-2">
      {/* If you render a logo, add an <img> here using selectedLogo */}
      <select
        className="flex-1 bg-slate-950 border border-white/15 rounded-md px-2 py-1.5 text-sm text-white/90 disabled:opacity-50"
        value={uiValue}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
        disabled={disabled}  // ✅ NEW
      >
        <option value="">
          {selectedName ?? placeholder}
        </option>
        {options.map((o) => (
          <option
            key={String(o.id ?? "null")}
            value={o.id == null ? "" : String(o.id)}
            disabled={o.disabled}
            title={o.reason}
          >
            {o.label}
          </option>
        ))}
      </select>

      <span className="px-1.5 py-0.5 text-[10px] rounded-full border border-white/10 text-white/70 bg-white/5 min-w-[2.25rem] text-center">
        {selectedSeed != null ? `#${selectedSeed}` : "—"}
      </span>
    </div>
  );
}
