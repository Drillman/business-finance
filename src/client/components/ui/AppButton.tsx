import type { ButtonHTMLAttributes, ReactNode } from 'react'

type AppButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger-outline'
type AppButtonSize = 'default' | 'sm' | 'icon-sm'

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AppButtonVariant
  size?: AppButtonSize
  startIcon?: ReactNode
}

const variantClasses: Record<AppButtonVariant, string> = {
  primary:
    'border border-[var(--color-primary)] bg-[var(--color-primary)] text-white hover:bg-[#1D4ED8] hover:border-[#1D4ED8]',
  outline:
    'border-[1.5px] border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-hover)]',
  ghost:
    'border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]',
  'danger-outline':
    'border-[1.5px] border-[#F87171] bg-transparent text-[#DC2626] hover:bg-[#FEE2E2]',
}

const sizeClasses: Record<AppButtonSize, string> = {
  default: 'h-9.5 px-[18px] text-sm',
  sm: 'h-8 px-3 text-sm',
  'icon-sm': 'h-8 w-8 p-0 text-sm',
}

export function AppButton({
  variant = 'primary',
  size = 'default',
  startIcon,
  className = '',
  children,
  type = 'button',
  ...props
}: AppButtonProps) {
  return (
    <button
      type={type}
      className={[
        'inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
      {...props}
    >
      {startIcon}
      {children}
    </button>
  )
}
