import { Check } from 'lucide-react'
import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  description?: ReactNode
  alignTop?: boolean
}

export function Checkbox({
  id,
  label,
  description,
  className = '',
  disabled,
  alignTop = false,
  ...props
}: CheckboxProps) {
  const generatedId = useId()
  const checkboxId = id ?? generatedId

  return (
    <label
      htmlFor={checkboxId}
      className={[
        'inline-flex gap-2.5',
        alignTop ? 'items-start' : 'items-center',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer',
      ].join(' ')}
    >
      <input
        id={checkboxId}
        type="checkbox"
        className="peer sr-only"
        disabled={disabled}
        {...props}
      />

      <span
        aria-hidden="true"
        className={[
          'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-[#D4D4D8] bg-white text-transparent transition-colors',
          'peer-checked:border-(--color-primary) peer-checked:bg-(--color-primary)',
          'peer-checked:text-white',
          'peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-(--color-primary) peer-focus-visible:ring-offset-2',
          'peer-disabled:opacity-70',
          className,
        ].join(' ')}
      >
        <Check className="h-3.5 w-3.5" />
      </span>

      {(label || description) && (
        <span className="leading-tight">
          {label ? <span className="block text-[13px] font-medium text-(--text-primary)">{label}</span> : null}
          {description ? <span className="block text-[11px] text-(--text-tertiary)">{description}</span> : null}
        </span>
      )}
    </label>
  )
}
