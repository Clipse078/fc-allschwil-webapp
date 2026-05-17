type SettingsFieldProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
};

export default function SettingsField({
  label,
  htmlFor,
  hint,
  required,
  children,
}: SettingsFieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500"
      >
        {label}
        {required ? <span className="ml-1 text-rose-400">*</span> : null}
      </label>
      {children}
      {hint ? (
        <p className="mt-1.5 text-[0.72rem] text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
