import type { ReactNode } from 'react'
import { CircleCheck, LogOut, Send, Trash2, TriangleAlert, X } from 'lucide-react'
import { AppButton } from './AppButton'

type ActionModalVariant = 'danger' | 'warning' | 'validation'

interface ActionModalProps {
  isOpen: boolean
  title: string
  message: string
  variant?: ActionModalVariant
  confirmLabel?: string
  cancelLabel?: string
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
  confirmIcon?: ReactNode
  icon?: ReactNode
}

interface VariantConfig {
  circleClassName: string
  iconClassName: string
  confirmButtonClassName: string
  defaultIcon: ReactNode
  defaultConfirmIcon: ReactNode
}

const variantConfig: Record<ActionModalVariant, VariantConfig> = {
  danger: {
    circleClassName: 'bg-[#FEE2E2]',
    iconClassName: 'text-[#DC2626]',
    confirmButtonClassName: '!border-[#DC2626] !bg-[#DC2626] !text-white hover:!border-[#B91C1C] hover:!bg-[#B91C1C]',
    defaultIcon: <Trash2 className="h-6.5 w-6.5" />,
    defaultConfirmIcon: <Trash2 className="h-4 w-4" />,
  },
  warning: {
    circleClassName: 'bg-[#FEF3C7]',
    iconClassName: 'text-[#F59E0B]',
    confirmButtonClassName: '!border-[#F59E0B] !bg-[#F59E0B] !text-white hover:!border-[#D97706] hover:!bg-[#D97706]',
    defaultIcon: <TriangleAlert className="h-6.5 w-6.5" />,
    defaultConfirmIcon: <LogOut className="h-4 w-4" />,
  },
  validation: {
    circleClassName: 'bg-[#DCFCE7]',
    iconClassName: 'text-[#16A34A]',
    confirmButtonClassName: '!border-[#16A34A] !bg-[#16A34A] !text-white hover:!border-[#15803D] hover:!bg-[#15803D]',
    defaultIcon: <CircleCheck className="h-6.5 w-6.5" />,
    defaultConfirmIcon: <Send className="h-4 w-4" />,
  },
}

export function ActionModal({
  isOpen,
  title,
  message,
  variant = 'danger',
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  isLoading = false,
  onConfirm,
  onCancel,
  confirmIcon,
  icon,
}: ActionModalProps) {
  if (!isOpen) return null

  const config = variantConfig[variant]

  return (
    <div className="modal modal-open">
      <div className="modal-box w-[calc(100%-1.5rem)] max-w-105 overflow-hidden rounded-2xl border border-(--border-default) bg-(--card-bg) p-0 shadow-[0_8px_32px_rgba(0,0,0,0.16)] sm:w-[calc(100%-2rem)]">
        <div className="flex flex-col items-center gap-4 px-8 pb-6 pt-8 text-center">
          <div
            className={[
              'flex h-14 w-14 items-center justify-center rounded-full',
              config.circleClassName,
              config.iconClassName,
            ].join(' ')}
          >
            {icon ?? config.defaultIcon}
          </div>
          <h3 className="font-['Space_Grotesk'] text-xl font-semibold leading-tight tracking-[-0.015em] text-(--text-primary)">
            {title}
          </h3>
          <p className="max-w-85 text-sm leading-6 text-(--text-secondary)">{message}</p>
        </div>

        <div className="h-px bg-(--border-default)" />

        <div className="flex items-center justify-end gap-3 px-7 pb-6 pt-4">
          <AppButton type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </AppButton>
          <AppButton
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={config.confirmButtonClassName}
            startIcon={!isLoading ? (confirmIcon ?? config.defaultConfirmIcon) : undefined}
          >
            {isLoading ? <span className="loading loading-spinner loading-sm" /> : confirmLabel}
          </AppButton>
        </div>

        <AppButton
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          title="Fermer"
          className="absolute right-4 top-4 h-7 w-7 text-(--text-tertiary)"
        >
          <X className="h-4 w-4" />
        </AppButton>
      </div>
      <div className="modal-backdrop bg-[#0F172A]/50 backdrop-blur-[1px]" onClick={onCancel}></div>
    </div>
  )
}
