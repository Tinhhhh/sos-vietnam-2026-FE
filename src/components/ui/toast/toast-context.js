import { createContext, useContext } from 'react';

export const ToastContext = createContext(null);

/** `const toast = useToast(); toast.show('...', { tone: 'success' })` */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
