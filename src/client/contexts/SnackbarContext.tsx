import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Alert, type AlertTone } from '@drillman/dashboard-ui';

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

const TONES: Record<SnackbarType, AlertTone> = {
  success: 'success',
  error: 'danger',
  warning: 'warning',
  info: 'info',
};

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

  return (
    <SnackbarContext.Provider value={{ showSnackbar, showSuccess, showError, showWarning, showInfo }}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-60 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {snackbars.map((snackbar) => (
          <Alert
            key={snackbar.id}
            tone={TONES[snackbar.type]}
            onClose={() => removeSnackbar(snackbar.id)}
            className="pointer-events-auto bg-surface shadow-dropdown"
          >
            {snackbar.message}
          </Alert>
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}
