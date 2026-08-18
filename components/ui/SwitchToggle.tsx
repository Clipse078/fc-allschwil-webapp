/**
 * SwitchToggle — SCE-standard boolean toggle switch.
 *
 * Use for on/off settings (Person ist aktiv, Spieler/in, Trainer/in, …).
 * Do NOT use checkboxes for these controls.
 * Checkboxes remain appropriate for genuine multi-row selection and bulk actions.
 *
 * Accessibility:
 *   - Uses role="switch" with aria-checked
 *   - Keyboard: Space/Enter toggles
 *   - Fully keyboard-navigable via htmlFor on the wrapping label
 */

"use client";

type SwitchToggleProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
};

/**
 * The visual track+thumb toggle. Used internally and exported for
 * inline usage (e.g. inside a row where the label is separately placed).
 */
export function SwitchThumb({
  id,
  checked,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
}: SwitchToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 ease-in-out",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2",
        checked
          ? "bg-[var(--sce-primary)]"
          : "bg-[var(--border-strong)]",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0",
          "transition-transform duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

export type SwitchToggleProps2 = SwitchToggleProps & {
  label: string;
  description?: string;
};

/**
 * Full SwitchToggle row: label (+ optional description) + thumb.
 * Drop-in replacement for <Toggle> in PersonForm and similar forms.
 */
export function SwitchToggle({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: SwitchToggleProps2) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3"
    >
      <div className="min-w-0">
        <span className="block text-sm font-medium text-[var(--foreground)]">{label}</span>
        {description ? (
          <span className="block text-xs text-[var(--muted)]">{description}</span>
        ) : null}
      </div>
      <SwitchThumb
        id={id}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={label}
      />
    </label>
  );
}
