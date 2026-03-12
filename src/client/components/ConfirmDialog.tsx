import { CircleAlert } from 'lucide-react'
import { ActionModal } from './ui/ActionModal'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  isLoading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  variant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (variant === 'info') {
    return (
      <ActionModal
        isOpen={isOpen}
        title={title}
        message={message}
        variant="validation"
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        isLoading={isLoading}
        onConfirm={onConfirm}
        onCancel={onCancel}
        icon={<CircleAlert className="h-6.5 w-6.5" />}
      />
    )
  }

  return (
    <ActionModal
      isOpen={isOpen}
      title={title}
      message={message}
      variant={variant}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      isLoading={isLoading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}
