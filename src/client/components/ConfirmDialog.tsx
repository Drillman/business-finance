import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
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
  if (!isOpen) return null;

  const variantStyles = {
    danger: 'btn-error',
    warning: 'btn-warning',
    info: 'btn-info',
  };

  const iconColors = {
    danger: 'text-error',
    warning: 'text-warning',
    info: 'text-info',
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm">
        <div className="flex flex-col items-center text-center">
          <div className={`mb-4 ${iconColors[variant]}`}>
            <AlertTriangle size={48} />
          </div>
          <h3 className="font-bold text-lg mb-2">{title}</h3>
          <p className="text-base-content/70 mb-6">{message}</p>
          <div className="flex gap-3 w-full">
            <button
              type="button"
              className="btn flex-1"
              onClick={onCancel}
              disabled={isLoading}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={`btn ${variantStyles[variant]} flex-1`}
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading && <span className="loading loading-spinner loading-sm"></span>}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={onCancel}></div>
    </div>
  );
}
