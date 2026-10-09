import { ToastProvider } from '@/components/ui/toast/toast-provider';

export function AppProvider({ children }) {
  return <ToastProvider>{children}</ToastProvider>;
}
