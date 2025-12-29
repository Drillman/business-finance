import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type SnackbarType = 'success' | 'error' | 'warning' | 'info';

interface Snackbar {
  id: string;
  message: string;
  type: SnackbarType;
}

interface SnackbarContextType {
  showSnackbar: (message: string, type?: SnackbarType) => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

const SnackbarContext = createContext<SnackbarContextType | null>(null);

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
}

interface SnackbarProviderProps {
  children: ReactNode;
}

export function SnackbarProvider({ children }: SnackbarProviderProps) {
  const [snackbars, setSnackbars] = useState<Snackbar[]>([]);

  const removeSnackbar = useCallback((id: string) => {
    setSnackbars((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const showSnackbar = useCallback((message: string, type: SnackbarType = 'info') => {
    const id = crypto.randomUUID();
    setSnackbars((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeSnackbar(id), 4000);
  }, [removeSnackbar]);

  const showSuccess = useCallback((message: string) => showSnackbar(message, 'success'), [showSnackbar]);
  const showError = useCallback((message: string) => showSnackbar(message, 'error'), [showSnackbar]);
  const showWarning = useCallback((message: string) => showSnackbar(message, 'warning'), [showSnackbar]);
  const showInfo = useCallback((message: string) => showSnackbar(message, 'info'), [showSnackbar]);

  const iconMap = {
    success: <CheckCircle size={20} />,
    error: <XCircle size={20} />,
    warning: <AlertTriangle size={20} />,
    info: <Info size={20} />,
  };

  const alertStyles = {
    success: 'alert-success',
    error: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info',
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar, showSuccess, showError, showWarning, showInfo }}>
      {children}
      <div className="toast toast-end toast-bottom z-50">
        {snackbars.map((snackbar) => (
          <div
            key={snackbar.id}
            className={`alert ${alertStyles[snackbar.type]} shadow-lg flex items-center gap-2 animate-fade-in`}
          >
            {iconMap[snackbar.type]}
            <span className="flex-1">{snackbar.message}</span>
            <button
              className="btn btn-ghost btn-xs btn-square"
              onClick={() => removeSnackbar(snackbar.id)}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}
