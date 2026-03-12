import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  description?: ReactNode
  alignTop?: boolean
}

export function Switch({
  id,
  label,
  description,
  className = '',
  disabled,
  alignTop = false,
  ...props
}: SwitchProps) {
  const generatedId = useId()
  const switchId = id ?? generatedId

  return (
    <label
      htmlFor={switchId}
      className={[
        'inline-flex gap-2.5',
        alignTop ? 'items-start' : 'items-center',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
      ].join(' ')}
    >
      <input
        id={switchId}
        type="checkbox"
        className="peer sr-only"
        disabled={disabled}
        {...props}
      />

      <span
        aria-hidden="true"
        className={[
          'relative inline-flex h-6 w-11 shrink-0 rounded-full bg-[#D4D4D8] transition-colors',
          "before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:shadow-[0_1px_2px_rgba(0,0,0,0.22)] before:transition-transform before:content-['']",
          'peer-checked:bg-(--color-primary)',
          'peer-checked:before:translate-x-5',
          'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-(--color-primary) peer-focus-visible:ring-offset-2',
          'peer-disabled:opacity-70',
          className,
        ].join(' ')}
      />

      {(label || description) && (
        <span className="leading-tight">
          {label ? <span className="block text-[13px] font-medium text-(--text-primary)">{label}</span> : null}
          {description ? <span className="block text-[11px] text-(--text-tertiary)">{description}</span> : null}
        </span>
      )}
    </label>
  )
}
