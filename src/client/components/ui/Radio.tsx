import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  description?: ReactNode
  alignTop?: boolean
}

export function Radio({
  id,
  label,
  description,
  className = '',
  disabled,
  alignTop = false,
  ...props
}: RadioProps) {
  const generatedId = useId()
  const radioId = id ?? generatedId

  return (
    <label
      htmlFor={radioId}
      className={[
        'inline-flex gap-2.5',
        alignTop ? 'items-start' : 'items-center',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
      ].join(' ')}
    >
      <input
        id={radioId}
        type="radio"
        className="peer sr-only"
        disabled={disabled}
        {...props}
      />

      <span
        aria-hidden="true"
        className={[
          'relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#D4D4D8] bg-white transition-colors',
          "before:h-2 before:w-2 before:rounded-full before:bg-white before:opacity-0 before:transition-opacity before:content-['']",
          'peer-disabled:border-[#E4E4E7] peer-disabled:bg-[#F4F4F5] peer-disabled:opacity-50',
          'peer-checked:border-(--color-primary) peer-checked:bg-(--color-primary)',
          'peer-checked:before:opacity-100',
          'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-(--color-primary) peer-focus-visible:ring-offset-2',
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
