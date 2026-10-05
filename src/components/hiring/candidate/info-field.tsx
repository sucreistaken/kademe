/**
 * One details field. The label wraps only its text and the input, so the
 * input's accessible name is the label alone; the problem sits after the
 * label (outside it) and is linked with aria-describedby. While the field is
 * invalid its border keeps the danger colour, focused or not.
 */
export function InfoField({
  id,
  label,
  error,
  type = "text",
  value,
  autoComplete,
  maxLength,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  error: string | null;
  type?: "text" | "email";
  value: string;
  autoComplete?: string;
  maxLength?: number;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const base = "mt-2 h-12 w-full rounded-[10px] border bg-surface px-3.5 text-[16px] text-ink outline-none";
  return (
    <div>
      <label className="block">
        <span className="text-[16px] font-medium text-ink">{label}</span>
        <input
          id={id}
          className={error ? `${base} border-danger` : `${base} border-line-strong focus:border-ink/40`}
          type={type}
          value={value}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
        />
      </label>
      {error ? (
        <p id={`${id}-error`} className="mt-2 text-[14px] leading-[22px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
